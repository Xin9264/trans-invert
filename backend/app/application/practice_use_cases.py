"""Use cases for practice session bounded context"""
import uuid
from typing import List, Optional, AsyncGenerator
from datetime import datetime

from ..domain.entities import PracticeSession, PracticeEvaluation, PracticeRecord
from ..domain.value_objects import (
    PracticeId, TextId, Score, Correction, Timestamp, TextContent, Translation
)
from ..domain.repositories import (
    TextMaterialRepository, TextAnalysisRepository, PracticeRecordRepository
)
from ..domain.services import ScoreCalculationService
from .dtos import PracticeSubmissionCommand, PracticeEvaluationDto, PracticeRecordDto
from .interfaces import AIServiceInterface


class SubmitPracticeUseCase:
    """Use case for submitting practice and getting evaluation"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        analysis_repository: TextAnalysisRepository,
        practice_repository: PracticeRecordRepository,
        ai_service: AIServiceInterface,
        score_service: ScoreCalculationService
    ):
        self.text_repository = text_repository
        self.analysis_repository = analysis_repository
        self.practice_repository = practice_repository
        self.ai_service = ai_service
        self.score_service = score_service

    async def execute(self, command: PracticeSubmissionCommand) -> PracticeEvaluationDto:
        """Submit practice and get AI evaluation"""
        text_id = TextId(command.text_id)

        # Validate text exists
        text_material = await self.text_repository.find_by_id(text_id)
        if not text_material:
            raise ValueError("Text not found")

        # Validate analysis exists
        analysis = await self.analysis_repository.find_by_text_id(text_id)
        if not analysis:
            raise ValueError("Text analysis not completed yet")

        # Create practice session
        session_id = PracticeId(str(uuid.uuid4()))
        session = PracticeSession(
            id=session_id,
            text_id=text_id,
            user_input=command.user_input,
            submitted_at=Timestamp.now()
        )

        # Get AI evaluation
        evaluation_data = await self.ai_service.evaluate_practice(
            original_text=text_material.content.content,
            translation=analysis.translation.content,
            user_input=command.user_input
        )

        # Create corrections list
        corrections = [
            Correction(
                original=correction.get("original", ""),
                corrected=correction.get("corrected", ""),
                explanation=correction.get("explanation", "")
            )
            for correction in evaluation_data.get("corrections", [])
        ]

        # Calculate final score
        base_score = evaluation_data.get("score", 70)
        final_score = self.score_service.calculate_weighted_score(
            base_score, len(corrections)
        )

        # Create evaluation
        evaluation = PracticeEvaluation(
            score=final_score,
            corrections=corrections,
            overall_feedback=evaluation_data.get("overall_feedback", ""),
            is_acceptable=evaluation_data.get("is_acceptable", True),
            evaluated_at=Timestamp.now()
        )

        # Set evaluation to session
        session.set_evaluation(evaluation)

        # Create practice record
        practice_record = PracticeRecord(
            id=session_id,
            session=session,
            text_title=text_material.title,
            text_content=text_material.content,
            chinese_translation=analysis.translation
        )

        # Save practice record
        await self.practice_repository.save(practice_record)

        # Return evaluation DTO
        return PracticeEvaluationDto(
            score=final_score.value,
            corrections=[
                {
                    "original": c.original,
                    "corrected": c.corrected,
                    "explanation": c.explanation
                }
                for c in corrections
            ],
            overall_feedback=evaluation.overall_feedback,
            is_acceptable=evaluation.is_acceptable
        )


class SubmitPracticeStreamUseCase:
    """Use case for streaming practice evaluation"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        analysis_repository: TextAnalysisRepository,
        practice_repository: PracticeRecordRepository,
        ai_service: AIServiceInterface,
        score_service: ScoreCalculationService
    ):
        self.text_repository = text_repository
        self.analysis_repository = analysis_repository
        self.practice_repository = practice_repository
        self.ai_service = ai_service
        self.score_service = score_service

    async def execute(self, command: PracticeSubmissionCommand) -> AsyncGenerator[dict, None]:
        """Submit practice and get streaming AI evaluation"""
        text_id = TextId(command.text_id)

        # Validate text and analysis exist
        text_material = await self.text_repository.find_by_id(text_id)
        if not text_material:
            raise ValueError("Text not found")

        analysis = await self.analysis_repository.find_by_text_id(text_id)
        if not analysis:
            raise ValueError("Text analysis not completed yet")

        # Create practice session
        session_id = PracticeId(str(uuid.uuid4()))
        session = PracticeSession(
            id=session_id,
            text_id=text_id,
            user_input=command.user_input,
            submitted_at=Timestamp.now()
        )

        evaluation_result = None

        # Stream AI evaluation
        async for chunk in self.ai_service.evaluate_practice_stream(
            original_text=text_material.content.content,
            translation=analysis.translation.content,
            user_input=command.user_input
        ):
            yield chunk

            # Capture final result
            if chunk.get("type") == "complete":
                evaluation_result = chunk.get("result")

        # Save practice record if evaluation completed
        if evaluation_result:
            corrections = [
                Correction(
                    original=correction.get("original", ""),
                    corrected=correction.get("corrected", ""),
                    explanation=correction.get("explanation", "")
                )
                for correction in evaluation_result.get("corrections", [])
            ]

            final_score = self.score_service.validate_score(evaluation_result.get("score", 70))

            evaluation = PracticeEvaluation(
                score=final_score,
                corrections=corrections,
                overall_feedback=evaluation_result.get("overall_feedback", ""),
                is_acceptable=evaluation_result.get("is_acceptable", True),
                evaluated_at=Timestamp.now()
            )

            session.set_evaluation(evaluation)

            practice_record = PracticeRecord(
                id=session_id,
                session=session,
                text_title=text_material.title,
                text_content=text_material.content,
                chinese_translation=analysis.translation
            )

            await self.practice_repository.save(practice_record)


class GetPracticeHistoryUseCase:
    """Use case for getting practice history"""

    def __init__(self, practice_repository: PracticeRecordRepository):
        self.practice_repository = practice_repository

    async def execute(self) -> List[PracticeRecordDto]:
        """Get all practice history records"""
        records = await self.practice_repository.find_all()

        return [
            PracticeRecordDto(
                id=record.id.value,
                timestamp=record.session.submitted_at.to_iso_string(),
                text_title=record.text_title,
                text_content=record.text_content.content,
                chinese_translation=record.chinese_translation.content,
                user_input=record.session.user_input,
                ai_evaluation={
                    "score": record.session.evaluation.score.value,
                    "corrections": [
                        {
                            "original": c.original,
                            "corrected": c.corrected,
                            "explanation": c.explanation
                        }
                        for c in record.session.evaluation.corrections
                    ],
                    "overall_feedback": record.session.evaluation.overall_feedback,
                    "is_acceptable": record.session.evaluation.is_acceptable
                } if record.session.evaluation else {},
                score=record.session.evaluation.score.value if record.session.evaluation else 0,
                review_count=record.review_count,
                last_reviewed=record.last_reviewed.to_iso_string() if record.last_reviewed else None,
                error_patterns=record.error_patterns
            )
            for record in records
        ]


class GetTextPracticeHistoryUseCase:
    """Use case for getting practice history for specific text"""

    def __init__(
        self,
        text_repository: TextMaterialRepository,
        practice_repository: PracticeRecordRepository
    ):
        self.text_repository = text_repository
        self.practice_repository = practice_repository

    async def execute(self, text_id: str) -> List[PracticeRecordDto]:
        """Get practice history for specific text"""
        text_id_obj = TextId(text_id)

        # Validate text exists
        text_material = await self.text_repository.find_by_id(text_id_obj)
        if not text_material:
            raise ValueError("Text not found")

        # Get practice records for this text content
        records = await self.practice_repository.find_by_text_content(
            text_material.content.content
        )

        return [
            PracticeRecordDto(
                id=record.id.value,
                timestamp=record.session.submitted_at.to_iso_string(),
                text_title=record.text_title,
                text_content=record.text_content.content,
                chinese_translation=record.chinese_translation.content,
                user_input=record.session.user_input,
                ai_evaluation={
                    "score": record.session.evaluation.score.value,
                    "corrections": [
                        {
                            "original": c.original,
                            "corrected": c.corrected,
                            "explanation": c.explanation
                        }
                        for c in record.session.evaluation.corrections
                    ],
                    "overall_feedback": record.session.evaluation.overall_feedback,
                    "is_acceptable": record.session.evaluation.is_acceptable
                } if record.session.evaluation else {},
                score=record.session.evaluation.score.value if record.session.evaluation else 0,
                review_count=record.review_count,
                last_reviewed=record.last_reviewed.to_iso_string() if record.last_reviewed else None,
                error_patterns=record.error_patterns
            )
            for record in records
        ]