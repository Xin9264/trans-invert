"""Refactored practice routes using DDD architecture"""
import json
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from ..application.dtos import PracticeSubmissionCommand
from ..application.practice_use_cases import (
    SubmitPracticeUseCase, SubmitPracticeStreamUseCase,
    GetPracticeHistoryUseCase, GetTextPracticeHistoryUseCase
)
from ..schemas.text import APIResponse
from ..infrastructure.container import DIContainer


class PracticeController:
    """Controller for practice session operations"""

    def __init__(self, container: DIContainer):
        self.container = container
        self.router = APIRouter(prefix="/api/texts", tags=["practice"])
        self._setup_routes()

    def _setup_routes(self):
        """Setup route handlers"""
        self.router.post("/practice/submit", response_model=APIResponse)(self.submit_practice)
        self.router.post("/practice/submit-stream")(self.submit_practice_stream)
        self.router.get("/practice/history", response_model=APIResponse)(self.get_practice_history)
        self.router.get("/{text_id}/practice/history", response_model=APIResponse)(self.get_text_practice_history)

    def _get_user_ai_config(self, request: Request) -> Dict[str, str]:
        """Extract user AI configuration from request headers"""
        headers = request.headers

        provider = headers.get('x-ai-provider')
        api_key = headers.get('x-ai-key')
        base_url = headers.get('x-ai-base-url')
        model = headers.get('x-ai-model')

        if not provider or not api_key:
            raise HTTPException(
                status_code=400,
                detail="Please configure AI service (provider and API key) in browser first"
            )

        return {
            'provider': provider,
            'api_key': api_key,
            'base_url': base_url,
            'model': model
        }

    async def submit_practice(self, request_data: dict, http_request: Request):
        """Submit practice answer and get evaluation"""
        try:
            # Validate user AI configuration
            user_config = self._get_user_ai_config(http_request)

            # Create command
            command = PracticeSubmissionCommand(
                text_id=request_data.get("text_id"),
                user_input=request_data.get("user_input")
            )

            # Execute use case
            evaluation = await self.container.submit_practice_use_case.execute(command)

            # Save data
            await self.container.save_all_data()

            return APIResponse(
                success=True,
                data=evaluation,
                message="Evaluation completed"
            )

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Practice evaluation failed: {str(e)}")

    async def submit_practice_stream(self, request_data: dict, http_request: Request):
        """Submit practice answer with streaming evaluation"""
        try:
            # Validate user AI configuration
            user_config = self._get_user_ai_config(http_request)

            # Create command
            command = PracticeSubmissionCommand(
                text_id=request_data.get("text_id"),
                user_input=request_data.get("user_input")
            )

            async def generate_stream():
                """Generate streaming response"""
                try:
                    async for chunk in self.container.submit_practice_stream_use_case.execute(command):
                        yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"

                    # Save data after completion
                    await self.container.save_all_data()

                    # Send completion marker
                    yield "data: [DONE]\n\n"

                except Exception as e:
                    # Send error information
                    error_chunk = {
                        "type": "error",
                        "error": str(e),
                        "progress": 0
                    }
                    yield f"data: {json.dumps(error_chunk, ensure_ascii=False)}\n\n"

            return StreamingResponse(
                generate_stream(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "*"
                }
            )

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Practice submission failed: {str(e)}")

    async def get_practice_history(self):
        """Get practice history records"""
        try:
            history = await self.container.get_practice_history_use_case.execute()

            return APIResponse(
                success=True,
                data=history,
                message=f"Retrieved {len(history)} history records"
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get history: {str(e)}")

    async def get_text_practice_history(self, text_id: str):
        """Get practice history for specific text"""
        try:
            history = await self.container.get_text_practice_history_use_case.execute(text_id)

            return APIResponse(
                success=True,
                data=history,
                message=f"Retrieved {len(history)} practice records for this text"
            )

        except ValueError as e:
            raise HTTPException(status_code=404, detail=str(e))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get text practice history: {str(e)}")


def create_practice_router(container: DIContainer) -> APIRouter:
    """Factory function to create practice router"""
    controller = PracticeController(container)
    return controller.router