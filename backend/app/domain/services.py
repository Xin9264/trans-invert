"""Domain services for business logic that doesn't belong to a single entity"""
from typing import List, Dict, Any
from .entities import PracticeRecord, ReviewStats
from .value_objects import Score, Timestamp


class ReviewAnalysisService:
    """Domain service for analyzing practice records and generating review insights"""

    def analyze_error_patterns(self, records: List[PracticeRecord]) -> Dict[str, int]:
        """Analyze common error patterns across practice records"""
        error_patterns = {}

        for record in records:
            for pattern in record.error_patterns:
                error_patterns[pattern] = error_patterns.get(pattern, 0) + 1

        return dict(sorted(error_patterns.items(), key=lambda x: x[1], reverse=True))

    def identify_focus_areas(self, records: List[PracticeRecord]) -> List[str]:
        """Identify areas that need more focus based on practice history"""
        error_patterns = self.analyze_error_patterns(records)

        # Return top 5 most common error patterns as focus areas
        return list(error_patterns.keys())[:5]

    def calculate_mastery_level(self, records: List[PracticeRecord]) -> Dict[str, int]:
        """Calculate mastery levels for different aspects"""
        total_practiced = len(records)
        if total_practiced == 0:
            return {"total_practiced": 0, "need_review": 0, "mastered": 0}

        need_review = sum(1 for record in records if record.needs_review)
        mastered = total_practiced - need_review

        return {
            "total_practiced": total_practiced,
            "need_review": need_review,
            "mastered": mastered
        }

    def get_recent_errors(self, records: List[PracticeRecord], limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent error summaries"""
        recent_records = sorted(
            [r for r in records if r.session.evaluation and r.session.evaluation.score.value < 80],
            key=lambda x: x.session.submitted_at.value,
            reverse=True
        )[:limit]

        errors = []
        for record in recent_records:
            if record.session.evaluation:
                errors.append({
                    "text_title": record.text_title,
                    "score": record.session.evaluation.score.value,
                    "corrections_count": len(record.session.evaluation.corrections),
                    "timestamp": record.session.submitted_at.to_iso_string()
                })

        return errors


class ScoreCalculationService:
    """Domain service for calculating and validating scores"""

    def validate_score(self, score: int) -> Score:
        """Validate and create a Score value object"""
        return Score(max(0, min(100, score)))

    def calculate_weighted_score(self, base_score: int, corrections_count: int) -> Score:
        """Calculate weighted score based on base score and number of corrections"""
        # Reduce score based on number of corrections
        penalty = min(corrections_count * 2, 20)  # Max 20 point penalty
        adjusted_score = max(0, base_score - penalty)
        return Score(adjusted_score)


class TextValidationService:
    """Domain service for validating text content and related operations"""

    def validate_text_similarity(self, original: str, user_input: str) -> float:
        """Calculate similarity score between original and user input"""
        original_words = set(original.lower().split())
        user_words = set(user_input.lower().split())

        if not original_words:
            return 0.0

        intersection = original_words.intersection(user_words)
        union = original_words.union(user_words)

        return len(intersection) / len(union) if union else 0.0

    def extract_key_differences(self, original: str, user_input: str) -> List[str]:
        """Extract key differences between original and user input"""
        original_words = set(original.lower().split())
        user_words = set(user_input.lower().split())

        missing_words = original_words - user_words
        extra_words = user_words - original_words

        differences = []
        if missing_words:
            differences.append(f"Missing words: {', '.join(missing_words)}")
        if extra_words:
            differences.append(f"Extra words: {', '.join(extra_words)}")

        return differences