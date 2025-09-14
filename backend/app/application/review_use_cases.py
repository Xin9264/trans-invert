"""Use cases for review system bounded context"""
from typing import List

from ..domain.entities import ReviewStats
from ..domain.repositories import PracticeRecordRepository, ReviewStatsRepository
from ..domain.services import ReviewAnalysisService
from .dtos import ReviewStatsDto


class GetReviewStatsUseCase:
    """Use case for getting review statistics"""

    def __init__(
        self,
        practice_repository: PracticeRecordRepository,
        review_stats_repository: ReviewStatsRepository,
        review_analysis_service: ReviewAnalysisService
    ):
        self.practice_repository = practice_repository
        self.review_stats_repository = review_stats_repository
        self.review_analysis_service = review_analysis_service

    async def execute(self) -> ReviewStatsDto:
        """Get review statistics"""
        # Get all practice records
        records = await self.practice_repository.find_all()

        # Calculate statistics using domain service
        mastery_levels = self.review_analysis_service.calculate_mastery_level(records)
        focus_areas = self.review_analysis_service.identify_focus_areas(records)
        recent_errors = self.review_analysis_service.get_recent_errors(records)

        return ReviewStatsDto(
            total_practiced=mastery_levels["total_practiced"],
            need_review=mastery_levels["need_review"],
            mastered=mastery_levels["mastered"],
            focus_areas=focus_areas,
            recent_errors=recent_errors
        )


class GenerateReviewMaterialUseCase:
    """Use case for generating review materials"""

    def __init__(
        self,
        practice_repository: PracticeRecordRepository,
        review_analysis_service: ReviewAnalysisService
    ):
        self.practice_repository = practice_repository
        self.review_analysis_service = review_analysis_service

    async def execute(self) -> dict:
        """Generate review materials based on practice history"""
        # Get records that need review
        records_needing_review = await self.practice_repository.find_needing_review()

        if not records_needing_review:
            return {
                "has_materials": False,
                "message": "No materials need review at this time"
            }

        # Analyze error patterns
        error_patterns = self.review_analysis_service.analyze_error_patterns(records_needing_review)
        focus_areas = self.review_analysis_service.identify_focus_areas(records_needing_review)

        return {
            "has_materials": True,
            "review_count": len(records_needing_review),
            "error_patterns": error_patterns,
            "focus_areas": focus_areas,
            "recommended_materials": [
                {
                    "id": record.id.value,
                    "title": record.text_title,
                    "score": record.session.evaluation.score.value if record.session.evaluation else 0,
                    "last_practiced": record.session.submitted_at.to_iso_string()
                }
                for record in records_needing_review[:10]  # Top 10 recommendations
            ]
        }