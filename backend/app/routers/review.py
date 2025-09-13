"""Refactored review routes using DDD architecture"""
from fastapi import APIRouter, HTTPException

from ..application.review_use_cases import GetReviewStatsUseCase, GenerateReviewMaterialUseCase
from ..schemas.text import APIResponse
from ..infrastructure.container import DIContainer


class ReviewController:
    """Controller for review system operations"""

    def __init__(self, container: DIContainer):
        self.container = container
        self.router = APIRouter(prefix="/api/review", tags=["review"])
        self._setup_routes()

    def _setup_routes(self):
        """Setup route handlers"""
        self.router.get("/stats", response_model=APIResponse)(self.get_review_stats)
        self.router.post("/generate", response_model=APIResponse)(self.generate_review_material)

    async def get_review_stats(self):
        """Get review statistics"""
        try:
            stats = await self.container.get_review_stats_use_case.execute()

            return APIResponse(
                success=True,
                data=stats,
                message="Review statistics retrieved successfully"
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get review stats: {str(e)}")

    async def generate_review_material(self):
        """Generate review materials based on practice history"""
        try:
            review_data = await self.container.generate_review_material_use_case.execute()

            return APIResponse(
                success=True,
                data=review_data,
                message="Review materials generated successfully"
            )

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate review material: {str(e)}")


def create_review_router(container: DIContainer) -> APIRouter:
    """Factory function to create review router"""
    controller = ReviewController(container)
    return controller.router