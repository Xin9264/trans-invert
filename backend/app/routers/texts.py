"""Refactored text management routes using DDD architecture"""
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse, Response

from ..application.dtos import TextUploadCommand, TextAnalysisQuery, MoveTextCommand
from ..application.text_use_cases import (
    UploadTextUseCase, GetTextAnalysisUseCase, ListTextMaterialsUseCase,
    MoveTextToFolderUseCase, DeleteTextMaterialUseCase, GetTextContentUseCase
)
from ..schemas.text import APIResponse, TextUploadRequest
from ..infrastructure.container import DIContainer


class TextController:
    """Controller for text management operations"""

    def __init__(self, container: DIContainer):
        self.container = container
        self.router = APIRouter(prefix="/api/texts", tags=["texts"])
        self._setup_routes()

    def _setup_routes(self):
        """Setup route handlers"""
        self.router.post("/upload", response_model=APIResponse)(self.upload_text)
        self.router.get("/{text_id}/analysis", response_model=APIResponse)(self.get_text_analysis)
        self.router.get("/{text_id}", response_model=APIResponse)(self.get_text)
        self.router.post("/{text_id}/move", response_model=APIResponse)(self.move_text_to_folder)
        self.router.delete("/{text_id}", response_model=APIResponse)(self.delete_text)
        self.router.get("/", response_model=APIResponse)(self.list_texts)

    def _get_user_ai_config(self, request: Request) -> Optional[Dict[str, str]]:
        """Extract user AI configuration from request headers"""
        headers = request.headers

        provider = headers.get('x-ai-provider')
        api_key = headers.get('x-ai-key')
        base_url = headers.get('x-ai-base-url')
        model = headers.get('x-ai-model')

        if not provider or not api_key:
            return None

        return {
            'provider': provider,
            'api_key': api_key,
            'base_url': base_url,
            'model': model
        }

    async def upload_text(self, request_data: TextUploadRequest, http_request: Request, background_tasks: BackgroundTasks):
        """Upload English text and trigger AI analysis"""
        try:
            # Validate user AI configuration
            user_config = self._get_user_ai_config(http_request)
            if not user_config:
                raise HTTPException(
                    status_code=400,
                    detail="Please configure AI service (provider and API key) in browser first"
                )

            # Create command
            command = TextUploadCommand(
                content=request_data.content,
                title=request_data.title,
                practice_type=getattr(request_data, 'practice_type', 'translation'),
                topic=getattr(request_data, 'topic', None),
                folder_id=getattr(request_data, 'folder_id', None)
            )

            # Execute use case
            text_id = await self.container.upload_text_use_case.execute(command)

            # Save data
            await self.container.save_all_data()

            # Calculate word count
            word_count = len(command.content.strip().split())

            return APIResponse(
                success=True,
                data={"text_id": text_id, "word_count": word_count},
                message="Text uploaded successfully, AI analysis in progress..."
            )

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Text upload failed: {str(e)}")

    async def get_text_analysis(self, text_id: str):
        """Get text analysis results"""
        try:
            query = TextAnalysisQuery(text_id=text_id)
            analysis = await self.container.get_text_analysis_use_case.execute(query)

            if not analysis:
                return APIResponse(
                    success=False,
                    message="Text analysis in progress, please wait"
                )

            # Save data after updating last opened
            await self.container.save_all_data()

            return APIResponse(
                success=True,
                data=analysis,
                message="Analysis results retrieved successfully"
            )

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get analysis: {str(e)}")

    async def get_text(self, text_id: str, include_content: bool = False):
        """Get text information"""
        try:
            text_info = await self.container.get_text_content_use_case.execute(
                text_id, include_content
            )

            if not text_info:
                raise HTTPException(status_code=404, detail="Text not found")

            return APIResponse(
                success=True,
                data=text_info,
                message="Text information retrieved successfully"
            )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get text: {str(e)}")

    async def move_text_to_folder(self, text_id: str, folder_data: Dict[str, Any]):
        """Move text to specified folder"""
        try:
            command = MoveTextCommand(
                text_id=text_id,
                folder_id=folder_data.get("folder_id")
            )

            await self.container.move_text_to_folder_use_case.execute(command)

            # Save data
            await self.container.save_all_data()

            # Prepare response message
            if command.folder_id:
                # Get folder name for message
                folder = await self.container.get_folder_use_case.execute(command.folder_id)
                folder_name = folder.name if folder else "unknown folder"
                message = f"Text moved to folder '{folder_name}'"
            else:
                message = "Text moved to root directory"

            return APIResponse(
                success=True,
                data={"text_id": text_id, "folder_id": command.folder_id},
                message=message
            )

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to move text: {str(e)}")

    async def delete_text(self, text_id: str):
        """Delete text material"""
        try:
            title = await self.container.delete_text_material_use_case.execute(text_id)

            # Save data
            await self.container.save_all_data()

            return APIResponse(
                success=True,
                data={"text_id": text_id, "title": title},
                message=f"Text material '{title}' deleted successfully"
            )

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete text: {str(e)}")

    async def list_texts(self, folder_id: Optional[str] = None):
        """List all text materials, optionally filtered by folder"""
        try:
            texts = await self.container.list_text_materials_use_case.execute(folder_id)

            filter_msg = f"folder filtered " if folder_id else ""

            return APIResponse(
                success=True,
                data=texts,
                message=f"Retrieved {filter_msg}{len(texts)} texts"
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to list texts: {str(e)}")


def create_text_router(container: DIContainer) -> APIRouter:
    """Factory function to create text router"""
    controller = TextController(container)
    return controller.router