"""Adapter for integrating with existing AI service"""
import json
import asyncio
from typing import Dict, Any, AsyncGenerator

from ..application.interfaces import AIServiceInterface, TemplateServiceInterface
from ..domain.entities import TextAnalysis
from ..domain.value_objects import (
    TextId, Translation, DifficultyLevel, DifficultWord, Timestamp
)
from ..domain.repositories import TextAnalysisRepository


class AIServiceAdapter(AIServiceInterface):
    """Adapter for existing AI service"""

    def __init__(
        self,
        ai_service,  # Original AI service
        template_service: TemplateServiceInterface,
        analysis_repository: TextAnalysisRepository
    ):
        self.ai_service = ai_service
        self.template_service = template_service
        self.analysis_repository = analysis_repository

    async def analyze_text_async(self, text_id: str, content: str) -> None:
        """Analyze text content asynchronously and save result"""
        try:
            # Use template service to render prompt
            prompt = self.template_service.render_analyze_text_prompt(content)

            # Call original AI service
            response = await self.ai_service.call_ai_api(prompt)

            # Extract JSON from response
            analysis_result = self.ai_service.extract_json_from_response(response)

            # Validate required fields
            required_fields = ["translation", "difficult_words", "difficulty", "key_points"]
            for field in required_fields:
                if field not in analysis_result:
                    raise Exception(f"AI response missing required field: {field}")

            # Convert to domain entities
            difficult_words = [
                DifficultWord(word=dw.get("word", ""), meaning=dw.get("meaning", ""))
                for dw in analysis_result.get("difficult_words", [])
                if dw.get("word") and dw.get("meaning")
            ]

            analysis = TextAnalysis(
                text_id=TextId(text_id),
                translation=Translation(analysis_result["translation"]),
                difficult_words=difficult_words,
                difficulty=DifficultyLevel(int(analysis_result["difficulty"])),
                key_points=analysis_result.get("key_points", []),
                analyzed_at=Timestamp.now()
            )

            # Save analysis
            await self.analysis_repository.save(analysis)

            print(f"✅ Text {text_id} analysis completed")

        except Exception as e:
            print(f"❌ Text {text_id} analysis failed: {str(e)}")

            # Save failure analysis
            failure_analysis = TextAnalysis(
                text_id=TextId(text_id),
                translation=Translation("Analysis failed, please retry"),
                difficult_words=[DifficultWord(word="Analysis failed", meaning="Please try again later")],
                difficulty=DifficultyLevel(3),
                key_points=["Analysis failed"],
                analyzed_at=Timestamp.now()
            )
            await self.analysis_repository.save(failure_analysis)

    async def evaluate_practice(
        self,
        original_text: str,
        translation: str,
        user_input: str
    ) -> Dict[str, Any]:
        """Evaluate practice submission"""
        # Use template service to render prompt
        prompt = self.template_service.render_evaluate_answer_prompt(
            original_text=original_text,
            translation=translation,
            user_input=user_input
        )

        # Call original AI service
        response = await self.ai_service.call_ai_api(prompt)

        # Extract JSON from response
        evaluation = self.ai_service.extract_json_from_response(response)

        # Validate and clean data
        required_fields = ["score", "corrections", "overall_feedback", "is_acceptable"]
        for field in required_fields:
            if field not in evaluation:
                raise Exception(f"AI response missing required field: {field}")

        # Ensure data types are correct
        evaluation["score"] = max(0, min(100, int(evaluation["score"])))
        if not isinstance(evaluation["corrections"], list):
            evaluation["corrections"] = []
        evaluation["is_acceptable"] = bool(evaluation["is_acceptable"])

        return evaluation

    async def evaluate_practice_stream(
        self,
        original_text: str,
        translation: str,
        user_input: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Evaluate practice submission with streaming response"""
        # Use template service to render prompt
        prompt = self.template_service.render_evaluate_answer_prompt(
            original_text=original_text,
            translation=translation,
            user_input=user_input
        )

        max_retries = 2
        evaluation_result = None

        for attempt in range(max_retries + 1):
            try:
                # Send retry status notification
                if attempt > 0:
                    retry_chunk = {
                        "type": "progress",
                        "progress": 0,
                        "content": f"Retrying (attempt {attempt + 1}/{max_retries + 1})..."
                    }
                    yield retry_chunk
                    await asyncio.sleep(1)

                # Start evaluation
                start_chunk = {
                    "type": "progress",
                    "progress": 10,
                    "content": f"Starting AI evaluation... (attempt {attempt + 1}/{max_retries + 1})"
                }
                yield start_chunk

                # Use streaming API
                collected_content = ""
                chunk_count = 0

                async for content in self.ai_service.call_ai_api_stream(prompt):
                    collected_content += content
                    chunk_count += 1

                    # Calculate progress
                    progress = self._calculate_json_progress(collected_content)
                    progress_chunk = {
                        "type": "progress",
                        "content": content,
                        "progress": min(90, progress),
                        "full_content": collected_content
                    }
                    yield progress_chunk

                # Validate response
                if len(collected_content.strip()) < 10:
                    raise Exception("AI response content is empty or too short")

                if chunk_count == 0:
                    raise Exception("No valid streaming data received")

                # Process complete response
                result = self.ai_service.extract_json_from_response(collected_content)

                # Validate and clean data
                required_fields = ["score", "corrections", "overall_feedback", "is_acceptable"]
                for field in required_fields:
                    if field not in result:
                        raise Exception(f"AI response missing required field: {field}")

                result["score"] = max(0, min(100, int(result["score"])))
                if not isinstance(result["corrections"], list):
                    result["corrections"] = []
                result["is_acceptable"] = bool(result["is_acceptable"])

                chunk = {
                    "type": "complete",
                    "result": result,
                    "progress": 100
                }
                evaluation_result = result
                yield chunk
                break  # Success, exit retry loop

            except Exception as e:
                if attempt < max_retries:
                    error_chunk = {
                        "type": "progress",
                        "progress": 0,
                        "content": f"Network error, retrying... ({attempt + 2}/{max_retries + 1})"
                    }
                    yield error_chunk
                    await asyncio.sleep(2)
                    continue
                else:
                    # All retries failed, return default result
                    chunk = {
                        "type": "complete",
                        "result": {
                            "score": 70,
                            "corrections": [],
                            "overall_feedback": f"Evaluation service temporarily unavailable, please try again later. Error: {str(e)}",
                            "is_acceptable": True
                        },
                        "progress": 100
                    }
                    evaluation_result = chunk["result"]
                    yield chunk

    def _calculate_json_progress(self, content: str) -> int:
        """Calculate progress based on JSON field appearance"""
        progress = 0

        # Define key fields and their weights
        key_fields = {
            '"score"': 25,
            '"corrections"': 25,
            '"overall_feedback"': 25,
            '"is_acceptable"': 25
        }

        for field, weight in key_fields.items():
            if field in content:
                progress += weight

        # If contains complete JSON structure, give extra points
        if content.count('{') > 0 and content.count('}') > 0:
            if content.count('{') == content.count('}'):
                progress = min(100, progress + 10)

        return min(100, progress)


class TemplateServiceAdapter(TemplateServiceInterface):
    """Adapter for existing template service"""

    def __init__(self, template_service):
        self.template_service = template_service

    def render_analyze_text_prompt(self, content: str) -> str:
        """Render prompt for text analysis"""
        return self.template_service.render_analyze_text_prompt(content)

    def render_evaluate_answer_prompt(
        self,
        original_text: str,
        translation: str,
        user_input: str
    ) -> str:
        """Render prompt for answer evaluation"""
        return self.template_service.render_evaluate_answer_prompt(
            original_text=original_text,
            translation=translation,
            user_input=user_input
        )


class DataPersistenceAdapter:
    """Adapter for existing data persistence service"""

    def __init__(self, data_persistence_service):
        self.data_persistence_service = data_persistence_service

    async def save_all_data(
        self,
        practice_history,
        texts_storage,
        analyses_storage,
        folders_storage
    ) -> None:
        """Save all application data"""
        self.data_persistence_service.save_all_data(
            practice_history, texts_storage, analyses_storage, folders_storage
        )

    async def load_all_data(self) -> tuple:
        """Load all application data"""
        return self.data_persistence_service.load_all_data()