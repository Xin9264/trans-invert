"""Refactored folder management routes using DDD architecture"""
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from ..application.dtos import CreateFolderCommand, UpdateFolderCommand
from ..application.folder_use_cases import (
    CreateFolderUseCase, UpdateFolderUseCase, ListFoldersUseCase,
    DeleteFolderUseCase, GetFolderUseCase
)
from ..schemas.text import APIResponse
from ..infrastructure.container import DIContainer


class FolderController:
    """Controller for folder management operations"""

    def __init__(self, container: DIContainer):
        self.container = container
        self.router = APIRouter(prefix="/api/folders", tags=["folders"])
        self._setup_routes()

    def _setup_routes(self):
        """Setup route handlers"""
        self.router.post("/", response_model=APIResponse)(self.create_folder)
        self.router.put("/{folder_id}", response_model=APIResponse)(self.update_folder)
        self.router.get("/", response_model=APIResponse)(self.list_folders)
        self.router.get("/tree/all", response_model=APIResponse)(self.get_folder_tree)
        self.router.get("/{folder_id}", response_model=APIResponse)(self.get_folder)
        self.router.delete("/{folder_id}", response_model=APIResponse)(self.delete_folder)

    async def create_folder(self, request_data: Dict[str, Any]):
        """Create a new folder"""
        try:
            command = CreateFolderCommand(
                name=request_data.get("name"),
                description=request_data.get("description"),
                parent_id=request_data.get("parent_id")
            )

            folder_id = await self.container.create_folder_use_case.execute(command)

            # Save data
            await self.container.save_all_data()

            return APIResponse(
                success=True,
                data={"folder_id": folder_id, "name": command.name},
                message=f"Folder '{command.name}' created successfully"
            )

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to create folder: {str(e)}")

    async def update_folder(self, folder_id: str, request_data: Dict[str, Any]):
        """Update folder information"""
        try:
            command = UpdateFolderCommand(
                folder_id=folder_id,
                name=request_data.get("name"),
                description=request_data.get("description")
            )

            await self.container.update_folder_use_case.execute(command)

            # Save data
            await self.container.save_all_data()

            return APIResponse(
                success=True,
                data={"folder_id": folder_id, "name": command.name},
                message=f"Folder '{command.name}' updated successfully"
            )

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update folder: {str(e)}")

    async def list_folders(self):
        """List all folders"""
        try:
            folders = await self.container.list_folders_use_case.execute()

            return APIResponse(
                success=True,
                data=folders,
                message=f"Retrieved {len(folders)} folders"
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to list folders: {str(e)}")

    async def get_folder_tree(self):
        """Get folder tree structure (same as list_folders for now)"""
        try:
            folders = await self.container.list_folders_use_case.execute()

            return APIResponse(
                success=True,
                data=folders,
                message=f"Retrieved {len(folders)} folders"
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get folder tree: {str(e)}")

    async def get_folder(self, folder_id: str):
        """Get folder by ID"""
        try:
            folder = await self.container.get_folder_use_case.execute(folder_id)

            if not folder:
                raise HTTPException(status_code=404, detail="Folder not found")

            return APIResponse(
                success=True,
                data=folder,
                message="Folder retrieved successfully"
            )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get folder: {str(e)}")

    async def delete_folder(self, folder_id: str):
        """Delete a folder"""
        try:
            folder_name = await self.container.delete_folder_use_case.execute(folder_id)

            # Save data
            await self.container.save_all_data()

            return APIResponse(
                success=True,
                data={"folder_id": folder_id, "name": folder_name},
                message=f"Folder '{folder_name}' deleted successfully"
            )

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete folder: {str(e)}")


def create_folder_router(container: DIContainer) -> APIRouter:
    """Factory function to create folder router"""
    controller = FolderController(container)
    return controller.router