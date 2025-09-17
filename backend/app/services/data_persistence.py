"""本地数据持久化服务"""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

from app.schemas.text import PracticeHistoryRecord


class DataPersistenceService:
    """统一管理文本、分析、练习历史与文件夹数据的持久化。"""

    SCHEMA_VERSION = "2.0"

    def __init__(self, data_dir: str | None = None):
        """初始化数据持久化服务。

        Args:
            data_dir: 数据存储目录，默认读取 DATA_DIR 环境变量或使用 ``data``
        """

        if data_dir is None:
            data_dir = os.getenv("DATA_DIR", "data")

        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)

        self.data_file = self.data_dir / "app_data.json"

        # 兼容旧版的多文件结构，首次加载时会尝试读取并迁移
        self.legacy_files = {
            "practice_history": self.data_dir / "practice_history.json",
            "texts": self.data_dir / "texts_data.json",
            "analyses": self.data_dir / "analyses_data.json",
            "folders": self.data_dir / "folders_data.json",
        }

    # ------------------------------------------------------------------
    # 内部工具方法
    # ------------------------------------------------------------------
    def _default_structure(self) -> Dict[str, Any]:
        """返回默认的数据结构。"""

        return {
            "version": self.SCHEMA_VERSION,
            "metadata": {
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            },
            "texts": {},
            "analyses": {},
            "folders": {},
            "practice_history": [],
        }

    def _ensure_structure(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """确保数据结构完整且包含必须的字段。"""

        if not isinstance(data, dict):
            return self._default_structure()

        data.setdefault("version", self.SCHEMA_VERSION)
        data.setdefault("metadata", {})
        metadata = data["metadata"]
        metadata.setdefault("created_at", datetime.utcnow().isoformat())
        metadata.setdefault("updated_at", datetime.utcnow().isoformat())

        data.setdefault("texts", {})
        data.setdefault("analyses", {})
        data.setdefault("folders", {})
        data.setdefault("practice_history", [])

        return data

    def _read_json_file(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_data(self, data: Dict[str, Any]) -> None:
        """写入统一数据文件。"""

        payload = self._ensure_structure(data)
        payload["version"] = self.SCHEMA_VERSION
        payload.setdefault("metadata", {})
        payload["metadata"]["updated_at"] = datetime.utcnow().isoformat()

        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

    def _serialize_practice_history(
        self, practice_history: List[PracticeHistoryRecord | Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """将练习历史转换为可序列化的列表。"""

        serialized: List[Dict[str, Any]] = []
        for record in practice_history:
            if hasattr(record, "model_dump"):
                serialized.append(record.model_dump())  # Pydantic v2
            elif hasattr(record, "dict"):
                serialized.append(record.dict())  # Pydantic v1 兼容
            else:
                serialized.append(dict(record))
        return serialized

    def _deserialize_practice_history(
        self, payload: List[Dict[str, Any]]
    ) -> List[PracticeHistoryRecord]:
        """将原始列表转换为 ``PracticeHistoryRecord`` 对象列表。"""

        history: List[PracticeHistoryRecord] = []
        for item in payload or []:
            try:
                history.append(PracticeHistoryRecord(**item))
            except Exception as exc:  # 容错：跳过脏数据
                print(f"⚠️ 跳过无效的历史记录: {exc}")
        return history

    def _load_from_legacy_files(self) -> Dict[str, Any]:
        """尝试从旧版多文件结构加载数据。"""

        data = self._default_structure()

        # 练习历史
        practice_payload = self._read_json_file(self.legacy_files["practice_history"])
        if practice_payload:
            records = practice_payload.get("records", [])
            data["practice_history"] = records

        # 文本、分析、文件夹
        for key in ("texts", "analyses", "folders"):
            file_path = self.legacy_files[key]
            payload = self._read_json_file(file_path)
            if payload:
                data[key] = payload.get(key, payload)

        return data

    def _load_data(self) -> Dict[str, Any]:
        """加载统一数据文件，如不存在则尝试迁移旧数据。"""

        if self.data_file.exists():
            try:
                with open(self.data_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return self._ensure_structure(data)
            except Exception as exc:
                print(f"❌ 读取数据文件失败，使用默认结构: {exc}")
                return self._default_structure()

        # 数据文件不存在，尝试从旧结构迁移
        legacy_data = self._load_from_legacy_files()
        self._write_data(legacy_data)
        return legacy_data

    # ------------------------------------------------------------------
    # 对外公开的读写方法
    # ------------------------------------------------------------------
    def save_practice_history(
        self, practice_history: List[PracticeHistoryRecord | Dict[str, Any]]
    ) -> bool:
        try:
            data = self._load_data()
            data["practice_history"] = self._serialize_practice_history(practice_history)
            self._write_data(data)
            print(f"✅ 练习历史已保存到: {self.data_file}")
            return True
        except Exception as exc:
            print(f"❌ 保存练习历史失败: {exc}")
            return False

    def load_practice_history(self) -> List[PracticeHistoryRecord]:
        data = self._load_data()
        history = self._deserialize_practice_history(data.get("practice_history", []))
        print(f"✅ 成功加载 {len(history)} 条练习历史记录")
        return history

    def save_texts_data(self, texts_storage: Dict[str, Dict[str, Any]]) -> bool:
        try:
            data = self._load_data()
            data["texts"] = texts_storage or {}
            self._write_data(data)
            print(f"✅ 文本数据已保存到: {self.data_file}")
            return True
        except Exception as exc:
            print(f"❌ 保存文本数据失败: {exc}")
            return False

    def load_texts_data(self) -> Dict[str, Dict[str, Any]]:
        data = self._load_data()
        texts = data.get("texts", {}) or {}

        # 修复旧数据缺失字段
        for text_id, text_info in texts.items():
            if text_info.get("created_at") == "now":
                text_info["created_at"] = "2025-08-27T00:00:00.000000"
            text_info.setdefault("folder_id", None)
            text_info.setdefault("practice_type", "translation")
            text_info.setdefault("topic", None)

        print(f"✅ 成功加载 {len(texts)} 个文本数据")
        return texts

    def save_analyses_data(self, analyses_storage: Dict[str, Dict[str, Any]]) -> bool:
        try:
            data = self._load_data()
            data["analyses"] = analyses_storage or {}
            self._write_data(data)
            print(f"✅ 分析数据已保存到: {self.data_file}")
            return True
        except Exception as exc:
            print(f"❌ 保存分析数据失败: {exc}")
            return False

    def load_analyses_data(self) -> Dict[str, Dict[str, Any]]:
        data = self._load_data()
        analyses = data.get("analyses", {}) or {}
        print(f"✅ 成功加载 {len(analyses)} 个分析结果")
        return analyses

    def save_folders_data(self, folders_storage: Dict[str, Dict[str, Any]]) -> bool:
        try:
            data = self._load_data()
            data["folders"] = folders_storage or {}
            self._write_data(data)
            print(f"✅ 文件夹数据已保存到: {self.data_file}")
            return True
        except Exception as exc:
            print(f"❌ 保存文件夹数据失败: {exc}")
            return False

    def load_folders_data(self) -> Dict[str, Dict[str, Any]]:
        data = self._load_data()
        folders = data.get("folders", {}) or {}
        print(f"✅ 成功加载 {len(folders)} 个文件夹")
        return folders

    def save_all_data(
        self,
        practice_history: List[PracticeHistoryRecord | Dict[str, Any]],
        texts_storage: Dict[str, Dict[str, Any]],
        analyses_storage: Dict[str, Dict[str, Any]],
        folders_storage: Dict[str, Dict[str, Any]] | None = None,
    ) -> bool:
        try:
            data = self._load_data()
            data["practice_history"] = self._serialize_practice_history(practice_history)
            data["texts"] = texts_storage or {}
            data["analyses"] = analyses_storage or {}
            if folders_storage is not None:
                data["folders"] = folders_storage or {}
            self._write_data(data)
            return True
        except Exception as exc:
            print(f"❌ 保存全部数据失败: {exc}")
            return False

    def load_all_data(self) -> Tuple[
        List[PracticeHistoryRecord],
        Dict[str, Dict[str, Any]],
        Dict[str, Dict[str, Any]],
        Dict[str, Dict[str, Any]],
    ]:
        data = self._load_data()
        practice_history = self._deserialize_practice_history(data.get("practice_history", []))
        texts = data.get("texts", {}) or {}
        analyses = data.get("analyses", {}) or {}
        folders = data.get("folders", {}) or {}
        return practice_history, texts, analyses, folders

    # ------------------------------------------------------------------
    # 数据导出 / 导入
    # ------------------------------------------------------------------
    def export_data(self) -> Dict[str, Any]:
        """导出当前全部数据的深拷贝。"""

        data = self._load_data()
        export_payload = json.loads(json.dumps(data))  # 深拷贝
        export_payload.setdefault("metadata", {})
        export_payload["metadata"]["exported_at"] = datetime.utcnow().isoformat()
        return export_payload

    def import_data(self, payload: Dict[str, Any], mode: str = "merge") -> Dict[str, int]:
        """导入数据文件。

        Args:
            payload: 需要导入的数据
            mode: ``merge`` 合并模式 或 ``replace`` 全量覆盖

        Returns:
            导入各模块的数量统计
        """

        base = self._load_data() if mode == "merge" else self._default_structure()

        imported_counts = {
            "texts": 0,
            "analyses": 0,
            "folders": 0,
            "practice_history": 0,
        }

        if not isinstance(payload, dict):
            raise ValueError("导入数据格式无效，应为JSON对象")

        for key in ("texts", "analyses", "folders"):
            incoming = payload.get(key)
            if isinstance(incoming, dict):
                imported_counts[key] = len(incoming)
                if mode == "replace":
                    base[key] = incoming
                else:
                    base[key].update(incoming)

        # 练习历史：按ID去重
        incoming_history = payload.get("practice_history", []) or []
        if not isinstance(incoming_history, list):
            raise ValueError("practice_history 字段必须是列表")

        if mode == "replace":
            base_history = []
        else:
            base_history = self._serialize_practice_history(
                self._deserialize_practice_history(base.get("practice_history", []))
            )

        existing_ids = {item.get("id") for item in base_history}

        merged_history: List[Dict[str, Any]] = list(base_history)
        for record in incoming_history:
            if not isinstance(record, dict):
                continue
            record_id = record.get("id")
            if record_id and record_id in existing_ids and mode == "merge":
                continue
            merged_history.append(record)
            if record_id:
                existing_ids.add(record_id)

        imported_counts["practice_history"] = len(incoming_history)
        base["practice_history"] = merged_history

        self._write_data(base)
        return imported_counts


# 创建全局实例（目录可通过环境变量 DATA_DIR 覆盖）
data_persistence = DataPersistenceService(None)

