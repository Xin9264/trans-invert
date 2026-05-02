"""本地数据持久化服务（SQLite）"""
import json
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List

from app.schemas.text import PracticeHistoryRecord


class DataPersistenceService:
    """本地数据持久化服务类。"""

    def __init__(self, data_dir: str | None = None):
        """
        初始化数据持久化服务。

        Args:
            data_dir: 数据存储目录
        """
        if data_dir is None:
            data_dir = os.getenv("DATA_DIR", "data")

        self.data_dir = Path(data_dir)
        self.db_file = self.data_dir / "trans_invert.sqlite3"

        # 旧版 JSON 文件仅用于首次迁移，不再作为运行时存储。
        self.practice_history_file = self.data_dir / "practice_history.json"
        self.texts_data_file = self.data_dir / "texts_data.json"
        self.analyses_data_file = self.data_dir / "analyses_data.json"
        self.folders_data_file = self.data_dir / "folders_data.json"

        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._init_db()
        self._migrate_json_if_needed()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_file, timeout=30)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """创建 SQLite 表。"""
        with self._connect() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS practice_history (
                    id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    text_title TEXT NOT NULL,
                    text_content TEXT NOT NULL,
                    chinese_translation TEXT NOT NULL,
                    user_input TEXT NOT NULL,
                    ai_evaluation TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    review_count INTEGER NOT NULL DEFAULT 0,
                    last_reviewed TEXT,
                    error_patterns TEXT NOT NULL DEFAULT '[]'
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS texts (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analyses (
                    text_id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS folders (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
                """
            )

    def _table_count(self, table_name: str) -> int:
        with self._connect() as conn:
            row = conn.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()
            return int(row["count"] if row else 0)

    def _database_has_data(self) -> bool:
        return any(
            self._table_count(table) > 0
            for table in ("practice_history", "texts", "analyses", "folders")
        )

    def _read_json_payload(self, path: Path) -> Dict[str, Any]:
        if not path.exists():
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as exc:
            print(f"⚠️ 读取旧 JSON 文件失败，已跳过 {path}: {exc}")
            return {}

    def _load_practice_history_json(self) -> List[PracticeHistoryRecord]:
        data = self._read_json_payload(self.practice_history_file)
        records = data.get("records", [])
        practice_records: List[PracticeHistoryRecord] = []
        for record in records:
            try:
                practice_records.append(PracticeHistoryRecord(**record))
            except Exception as exc:
                print(f"⚠️ 跳过无效的旧历史记录: {exc}")
        return practice_records

    def _load_texts_data_json(self) -> Dict[str, Dict[str, Any]]:
        data = self._read_json_payload(self.texts_data_file)
        texts = data.get("texts", {})
        if not isinstance(texts, dict):
            return {}
        self._normalize_texts(texts)
        return texts

    def _load_analyses_data_json(self) -> Dict[str, Dict[str, Any]]:
        data = self._read_json_payload(self.analyses_data_file)
        analyses = data.get("analyses", {})
        return analyses if isinstance(analyses, dict) else {}

    def _load_folders_data_json(self) -> Dict[str, Dict[str, Any]]:
        data = self._read_json_payload(self.folders_data_file)
        folders = data.get("folders", {})
        return folders if isinstance(folders, dict) else {}

    def _migrate_json_if_needed(self) -> None:
        """首次启动时把旧 JSON 数据导入 SQLite。"""
        legacy_files = [
            self.practice_history_file,
            self.texts_data_file,
            self.analyses_data_file,
            self.folders_data_file,
        ]
        if self._database_has_data() or not any(path.exists() for path in legacy_files):
            return

        practice_history = self._load_practice_history_json()
        texts_storage = self._load_texts_data_json()
        analyses_storage = self._load_analyses_data_json()
        folders_storage = self._load_folders_data_json()

        if not any([practice_history, texts_storage, analyses_storage, folders_storage]):
            return

        if self.save_all_data(practice_history, texts_storage, analyses_storage, folders_storage):
            print(f"✅ 已将旧 JSON 数据迁移到 SQLite: {self.db_file}")

    def _serialize_record(self, record: PracticeHistoryRecord | Dict[str, Any]) -> Dict[str, Any]:
        if hasattr(record, "model_dump"):
            return record.model_dump()
        return dict(record)

    def _normalize_texts(self, texts: Dict[str, Dict[str, Any]]) -> None:
        """兼容旧数据缺失字段。"""
        for text_id, text_info in texts.items():
            if not isinstance(text_info, dict):
                continue

            if text_info.get("created_at") == "now":
                text_info["created_at"] = "2025-08-27T00:00:00.000000"
                print(f"🔧 修复文本 {text_id} 的时间戳")

            if "folder_id" not in text_info:
                text_info["folder_id"] = None
                print(f"🔧 为文本 {text_id} 添加folder_id字段")

            if "practice_type" not in text_info:
                text_info["practice_type"] = "translation"
                print(f"🔧 为文本 {text_id} 添加practice_type字段")

            if "topic" not in text_info:
                text_info["topic"] = None
                print(f"🔧 为文本 {text_id} 添加topic字段")

    def save_practice_history(self, practice_history: List[PracticeHistoryRecord]) -> bool:
        """
        保存练习历史记录到 SQLite。

        Args:
            practice_history: 练习历史记录列表
        Returns:
            bool: 保存是否成功
        """
        try:
            rows = [self._serialize_record(record) for record in practice_history]
            with self._connect() as conn:
                conn.execute("DELETE FROM practice_history")
                conn.executemany(
                    """
                    INSERT OR REPLACE INTO practice_history (
                        id, timestamp, text_title, text_content, chinese_translation,
                        user_input, ai_evaluation, score, review_count, last_reviewed,
                        error_patterns
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            row["id"],
                            row["timestamp"],
                            row["text_title"],
                            row["text_content"],
                            row["chinese_translation"],
                            row["user_input"],
                            json.dumps(row.get("ai_evaluation", {}), ensure_ascii=False),
                            int(row.get("score", 0)),
                            int(row.get("review_count", 0) or 0),
                            row.get("last_reviewed"),
                            json.dumps(row.get("error_patterns", []), ensure_ascii=False),
                        )
                        for row in rows
                    ],
                )
            print(f"✅ 练习历史已保存到 SQLite: {self.db_file}")
            return True
        except Exception as e:
            print(f"❌ 保存练习历史失败: {e}")
            return False

    def load_practice_history(self) -> List[PracticeHistoryRecord]:
        """
        从 SQLite 加载练习历史记录。

        Returns:
            List[PracticeHistoryRecord]: 练习历史记录列表
        """
        try:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT id, timestamp, text_title, text_content, chinese_translation,
                           user_input, ai_evaluation, score, review_count, last_reviewed,
                           error_patterns
                    FROM practice_history
                    ORDER BY timestamp DESC
                    """
                ).fetchall()

            practice_records: List[PracticeHistoryRecord] = []
            for row in rows:
                try:
                    practice_records.append(
                        PracticeHistoryRecord(
                            id=row["id"],
                            timestamp=row["timestamp"],
                            text_title=row["text_title"],
                            text_content=row["text_content"],
                            chinese_translation=row["chinese_translation"],
                            user_input=row["user_input"],
                            ai_evaluation=json.loads(row["ai_evaluation"] or "{}"),
                            score=int(row["score"]),
                            review_count=int(row["review_count"] or 0),
                            last_reviewed=row["last_reviewed"],
                            error_patterns=json.loads(row["error_patterns"] or "[]"),
                        )
                    )
                except Exception as exc:
                    print(f"⚠️ 跳过无效的历史记录: {exc}")

            print(f"✅ 成功从 SQLite 加载 {len(practice_records)} 条练习历史记录")
            return practice_records
        except Exception as e:
            print(f"❌ 加载练习历史失败: {e}")
            return []

    def save_texts_data(self, texts_storage: Dict[str, Dict[str, Any]]) -> bool:
        """
        保存文本数据到 SQLite。

        Args:
            texts_storage: 文本存储字典
        Returns:
            bool: 保存是否成功
        """
        try:
            with self._connect() as conn:
                conn.execute("DELETE FROM texts")
                conn.executemany(
                    "INSERT OR REPLACE INTO texts (id, data) VALUES (?, ?)",
                    [
                        (
                            text_id,
                            json.dumps(text_info, ensure_ascii=False),
                        )
                        for text_id, text_info in texts_storage.items()
                    ],
                )
            print(f"✅ 文本数据已保存到 SQLite: {self.db_file}")
            return True
        except Exception as e:
            print(f"❌ 保存文本数据失败: {e}")
            return False

    def load_texts_data(self) -> Dict[str, Dict[str, Any]]:
        """
        从 SQLite 加载文本数据。

        Returns:
            Dict[str, Dict[str, Any]]: 文本存储字典
        """
        try:
            with self._connect() as conn:
                rows = conn.execute("SELECT id, data FROM texts").fetchall()

            texts: Dict[str, Dict[str, Any]] = {}
            for row in rows:
                try:
                    text_info = json.loads(row["data"])
                    if isinstance(text_info, dict):
                        texts[row["id"]] = text_info
                except Exception as exc:
                    print(f"⚠️ 跳过无效的文本数据 {row['id']}: {exc}")

            self._normalize_texts(texts)
            print(f"✅ 成功从 SQLite 加载 {len(texts)} 个文本数据")
            return texts
        except Exception as e:
            print(f"❌ 加载文本数据失败: {e}")
            return {}

    def save_analyses_data(self, analyses_storage: Dict[str, Dict[str, Any]]) -> bool:
        """
        保存分析数据到 SQLite。

        Args:
            analyses_storage: 分析结果存储字典
        Returns:
            bool: 保存是否成功
        """
        try:
            with self._connect() as conn:
                conn.execute("DELETE FROM analyses")
                conn.executemany(
                    "INSERT OR REPLACE INTO analyses (text_id, data) VALUES (?, ?)",
                    [
                        (
                            text_id,
                            json.dumps(analysis_info, ensure_ascii=False),
                        )
                        for text_id, analysis_info in analyses_storage.items()
                    ],
                )
            print(f"✅ 分析数据已保存到 SQLite: {self.db_file}")
            return True
        except Exception as e:
            print(f"❌ 保存分析数据失败: {e}")
            return False

    def load_analyses_data(self) -> Dict[str, Dict[str, Any]]:
        """
        从 SQLite 加载分析数据。

        Returns:
            Dict[str, Dict[str, Any]]: 分析结果存储字典
        """
        try:
            with self._connect() as conn:
                rows = conn.execute("SELECT text_id, data FROM analyses").fetchall()

            analyses: Dict[str, Dict[str, Any]] = {}
            for row in rows:
                try:
                    analysis_info = json.loads(row["data"])
                    if isinstance(analysis_info, dict):
                        analyses[row["text_id"]] = analysis_info
                except Exception as exc:
                    print(f"⚠️ 跳过无效的分析数据 {row['text_id']}: {exc}")

            print(f"✅ 成功从 SQLite 加载 {len(analyses)} 个分析结果")
            return analyses
        except Exception as e:
            print(f"❌ 加载分析数据失败: {e}")
            return {}

    def save_folders_data(self, folders_storage: Dict[str, Dict[str, Any]]) -> bool:
        """
        保存文件夹数据到 SQLite。

        Args:
            folders_storage: 文件夹存储字典
        Returns:
            bool: 保存是否成功
        """
        try:
            with self._connect() as conn:
                conn.execute("DELETE FROM folders")
                conn.executemany(
                    "INSERT OR REPLACE INTO folders (id, data) VALUES (?, ?)",
                    [
                        (
                            folder_id,
                            json.dumps(folder_info, ensure_ascii=False),
                        )
                        for folder_id, folder_info in folders_storage.items()
                    ],
                )
            print(f"✅ 文件夹数据已保存到 SQLite: {self.db_file}")
            return True
        except Exception as e:
            print(f"❌ 保存文件夹数据失败: {e}")
            return False

    def load_folders_data(self) -> Dict[str, Dict[str, Any]]:
        """
        从 SQLite 加载文件夹数据。

        Returns:
            Dict[str, Dict[str, Any]]: 文件夹存储字典
        """
        try:
            with self._connect() as conn:
                rows = conn.execute("SELECT id, data FROM folders").fetchall()

            folders: Dict[str, Dict[str, Any]] = {}
            for row in rows:
                try:
                    folder_info = json.loads(row["data"])
                    if isinstance(folder_info, dict):
                        folders[row["id"]] = folder_info
                except Exception as exc:
                    print(f"⚠️ 跳过无效的文件夹数据 {row['id']}: {exc}")

            print(f"✅ 成功从 SQLite 加载 {len(folders)} 个文件夹")
            return folders
        except Exception as e:
            print(f"❌ 加载文件夹数据失败: {e}")
            return {}

    def save_all_data(
        self,
        practice_history: List[PracticeHistoryRecord],
        texts_storage: Dict[str, Dict[str, Any]],
        analyses_storage: Dict[str, Dict[str, Any]],
        folders_storage: Dict[str, Dict[str, Any]] | None = None,
    ) -> bool:
        """
        保存所有数据到 SQLite。

        Args:
            practice_history: 练习历史记录列表
            texts_storage: 文本存储字典
            analyses_storage: 分析结果存储字典
            folders_storage: 文件夹存储字典（可选）
        Returns:
            bool: 保存是否成功
        """
        success = True
        success &= self.save_practice_history(practice_history)
        success &= self.save_texts_data(texts_storage)
        success &= self.save_analyses_data(analyses_storage)
        if folders_storage is not None:
            success &= self.save_folders_data(folders_storage)
        return success

    def load_all_data(self) -> tuple:
        """
        从 SQLite 加载所有数据。

        Returns:
            tuple: (practice_history, texts_storage, analyses_storage, folders_storage)
        """
        practice_history = self.load_practice_history()
        texts_storage = self.load_texts_data()
        analyses_storage = self.load_analyses_data()
        folders_storage = self.load_folders_data()
        return practice_history, texts_storage, analyses_storage, folders_storage


# 创建全局实例（目录可通过环境变量 DATA_DIR 覆盖）
data_persistence = DataPersistenceService(None)
