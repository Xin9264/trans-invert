"""Interface definitions for application layer dependencies"""
from abc import ABC, abstractmethod
from typing import Dict, Any, AsyncGenerator


class AIServiceInterface(ABC):
    """Interface for AI service operations"""

    @abstractmethod
    async def analyze_text_async(self, text_id: str, content: str) -> None:
        """Analyze text content asynchronously"""
        pass

    @abstractmethod
    async def analyze_text_stream(
        self, text_id: str, content: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Analyze text content with streaming response"""
        pass

    @abstractmethod
    async def evaluate_practice(
        self,
        original_text: str,
        translation: str,
        user_input: str
    ) -> Dict[str, Any]:
        """Evaluate practice submission"""
        pass

    @abstractmethod
    async def evaluate_practice_stream(
        self,
        original_text: str,
        translation: str,
        user_input: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Evaluate practice submission with streaming response"""
        pass


class TemplateServiceInterface(ABC):
    """Interface for template rendering operations"""

    @abstractmethod
    def render_analyze_text_prompt(self, content: str) -> str:
        """Render prompt for text analysis"""
        pass

    @abstractmethod
    def render_evaluate_answer_prompt(
        self,
        original_text: str,
        translation: str,
        user_input: str
    ) -> str:
        """Render prompt for answer evaluation"""
        pass


class DataPersistenceInterface(ABC):
    """Interface for data persistence operations"""

    @abstractmethod
    async def save_all_data(self, *args) -> None:
        """Save all application data"""
        pass

    @abstractmethod
    async def load_all_data(self) -> tuple:
        """Load all application data"""
        pass


class BackupServiceInterface(ABC):
    """Interface for backup operations"""

    @abstractmethod
    async def export_practice_history(self) -> bytes:
        """Export practice history as JSON"""
        pass

    @abstractmethod
    async def import_practice_history(self, data: Dict[str, Any]) -> Dict[str, int]:
        """Import practice history from JSON"""
        pass

    @abstractmethod
    async def export_practice_materials(self) -> bytes:
        """Export practice materials as JSON"""
        pass

    @abstractmethod
    async def import_practice_materials(self, data: Dict[str, Any]) -> Dict[str, int]:
        """Import practice materials from JSON"""
        pass