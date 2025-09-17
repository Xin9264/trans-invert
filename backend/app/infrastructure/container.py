"""Dependency injection container for DDD architecture"""
from typing import Dict, Any, List

from ..domain.services import ReviewAnalysisService, ScoreCalculationService, TextValidationService
from ..infrastructure.repositories import (
    FileTextMaterialRepository, FileTextAnalysisRepository,
    FilePracticeRecordRepository, FileFolderRepository, FileReviewStatsRepository
)
from ..infrastructure.adapters import AIServiceAdapter, TemplateServiceAdapter, DataPersistenceAdapter
from ..application.text_use_cases import (
    UploadTextUseCase, UploadTextStreamUseCase, GetTextAnalysisUseCase, ListTextMaterialsUseCase,
    MoveTextToFolderUseCase, DeleteTextMaterialUseCase, GetTextContentUseCase
)
from ..application.practice_use_cases import (
    SubmitPracticeUseCase, SubmitPracticeStreamUseCase,
    GetPracticeHistoryUseCase, GetTextPracticeHistoryUseCase
)
from ..application.folder_use_cases import (
    CreateFolderUseCase, UpdateFolderUseCase, ListFoldersUseCase,
    DeleteFolderUseCase, GetFolderUseCase
)
from ..application.review_use_cases import GetReviewStatsUseCase, GenerateReviewMaterialUseCase


class DIContainer:
    """Dependency injection container"""

    def __init__(
        self,
        texts_storage: Dict[str, Any],
        analyses_storage: Dict[str, Any],
        practice_history: List[Dict[str, Any]],
        folders_storage: Dict[str, Any],
        ai_service,
        template_service,
        data_persistence_service
    ):
        # Data stores
        self.texts_storage = texts_storage
        self.analyses_storage = analyses_storage
        self.practice_history = practice_history
        self.folders_storage = folders_storage

        # External services
        self.ai_service = ai_service
        self.template_service = template_service
        self.data_persistence_service = data_persistence_service

        # Initialize components
        self._init_domain_services()
        self._init_repositories()
        self._init_adapters()
        self._init_use_cases()

    def _init_domain_services(self):
        """Initialize domain services"""
        self.review_analysis_service = ReviewAnalysisService()
        self.score_calculation_service = ScoreCalculationService()
        self.text_validation_service = TextValidationService()

    def _init_repositories(self):
        """Initialize repositories"""
        self.text_material_repository = FileTextMaterialRepository(self.texts_storage)
        self.text_analysis_repository = FileTextAnalysisRepository(self.analyses_storage)
        self.practice_record_repository = FilePracticeRecordRepository(self.practice_history)
        self.folder_repository = FileFolderRepository(self.folders_storage)
        self.review_stats_repository = FileReviewStatsRepository(self.review_analysis_service)

    def _init_adapters(self):
        """Initialize adapters"""
        self.template_service_adapter = TemplateServiceAdapter(self.template_service)
        self.ai_service_adapter = AIServiceAdapter(
            self.ai_service,
            self.template_service_adapter,
            self.text_analysis_repository
        )
        self.data_persistence_adapter = DataPersistenceAdapter(self.data_persistence_service)

    def _init_use_cases(self):
        """Initialize use cases"""
        # Text use cases
        self.upload_text_use_case = UploadTextUseCase(
            self.text_material_repository,
            self.ai_service_adapter
        )
        self.upload_text_stream_use_case = UploadTextStreamUseCase(
            self.text_material_repository,
            self.ai_service_adapter
        )
        self.get_text_analysis_use_case = GetTextAnalysisUseCase(
            self.text_material_repository,
            self.text_analysis_repository
        )
        self.list_text_materials_use_case = ListTextMaterialsUseCase(
            self.text_material_repository,
            self.text_analysis_repository
        )
        self.move_text_to_folder_use_case = MoveTextToFolderUseCase(
            self.text_material_repository
        )
        self.delete_text_material_use_case = DeleteTextMaterialUseCase(
            self.text_material_repository,
            self.text_analysis_repository
        )
        self.get_text_content_use_case = GetTextContentUseCase(
            self.text_material_repository
        )

        # Practice use cases
        self.submit_practice_use_case = SubmitPracticeUseCase(
            self.text_material_repository,
            self.text_analysis_repository,
            self.practice_record_repository,
            self.ai_service_adapter,
            self.score_calculation_service
        )
        self.submit_practice_stream_use_case = SubmitPracticeStreamUseCase(
            self.text_material_repository,
            self.text_analysis_repository,
            self.practice_record_repository,
            self.ai_service_adapter,
            self.score_calculation_service
        )
        self.get_practice_history_use_case = GetPracticeHistoryUseCase(
            self.practice_record_repository
        )
        self.get_text_practice_history_use_case = GetTextPracticeHistoryUseCase(
            self.text_material_repository,
            self.practice_record_repository
        )

        # Folder use cases
        self.create_folder_use_case = CreateFolderUseCase(
            self.folder_repository
        )
        self.update_folder_use_case = UpdateFolderUseCase(
            self.folder_repository
        )
        self.list_folders_use_case = ListFoldersUseCase(
            self.folder_repository
        )
        self.delete_folder_use_case = DeleteFolderUseCase(
            self.folder_repository
        )
        self.get_folder_use_case = GetFolderUseCase(
            self.folder_repository
        )

        # Review use cases
        self.get_review_stats_use_case = GetReviewStatsUseCase(
            self.practice_record_repository,
            self.review_stats_repository,
            self.review_analysis_service
        )
        self.generate_review_material_use_case = GenerateReviewMaterialUseCase(
            self.practice_record_repository,
            self.review_analysis_service
        )

    async def save_all_data(self):
        """Save all data using persistence adapter"""
        await self.data_persistence_adapter.save_all_data(
            self.practice_history,
            self.texts_storage,
            self.analyses_storage,
            self.folders_storage
        )