"""Use cases for folder management bounded context"""
import uuid
from typing import List, Optional

from ..domain.entities import Folder
from ..domain.value_objects import FolderId, Timestamp
from ..domain.repositories import FolderRepository
from .dtos import CreateFolderCommand, UpdateFolderCommand, FolderDto


class CreateFolderUseCase:
    """Use case for creating folders"""

    def __init__(self, folder_repository: FolderRepository):
        self.folder_repository = folder_repository

    async def execute(self, command: CreateFolderCommand) -> str:
        """Create a new folder"""
        folder_id = FolderId(str(uuid.uuid4()))

        # Create parent folder ID if provided
        parent_id = FolderId(command.parent_id) if command.parent_id else None

        # Create folder entity
        folder = Folder(
            id=folder_id,
            name=command.name,
            description=command.description,
            created_at=Timestamp.now(),
            parent_id=parent_id
        )

        # Save folder
        await self.folder_repository.save(folder)

        return folder_id.value


class UpdateFolderUseCase:
    """Use case for updating folders"""

    def __init__(self, folder_repository: FolderRepository):
        self.folder_repository = folder_repository

    async def execute(self, command: UpdateFolderCommand) -> None:
        """Update folder information"""
        folder_id = FolderId(command.folder_id)

        # Get existing folder
        folder = await self.folder_repository.find_by_id(folder_id)
        if not folder:
            raise ValueError("Folder not found")

        # Update folder
        folder.update_name(command.name)
        folder.description = command.description

        # Save changes
        await self.folder_repository.save(folder)


class ListFoldersUseCase:
    """Use case for listing folders"""

    def __init__(self, folder_repository: FolderRepository):
        self.folder_repository = folder_repository

    async def execute(self) -> List[FolderDto]:
        """List all folders"""
        folders = await self.folder_repository.find_all()

        return [
            FolderDto(
                id=folder.id.value,
                name=folder.name,
                description=folder.description,
                created_at=folder.created_at.to_iso_string(),
                parent_id=folder.parent_id.value if folder.parent_id else None
            )
            for folder in folders
        ]


class DeleteFolderUseCase:
    """Use case for deleting folders"""

    def __init__(self, folder_repository: FolderRepository):
        self.folder_repository = folder_repository

    async def execute(self, folder_id: str) -> str:
        """Delete a folder"""
        folder_id_obj = FolderId(folder_id)

        # Get folder for name
        folder = await self.folder_repository.find_by_id(folder_id_obj)
        if not folder:
            raise ValueError("Folder not found")

        folder_name = folder.name

        # Delete folder
        success = await self.folder_repository.delete(folder_id_obj)
        if not success:
            raise ValueError("Failed to delete folder")

        return folder_name


class GetFolderUseCase:
    """Use case for getting a specific folder"""

    def __init__(self, folder_repository: FolderRepository):
        self.folder_repository = folder_repository

    async def execute(self, folder_id: str) -> Optional[FolderDto]:
        """Get folder by ID"""
        folder_id_obj = FolderId(folder_id)

        folder = await self.folder_repository.find_by_id(folder_id_obj)
        if not folder:
            return None

        return FolderDto(
            id=folder.id.value,
            name=folder.name,
            description=folder.description,
            created_at=folder.created_at.to_iso_string(),
            parent_id=folder.parent_id.value if folder.parent_id else None
        )