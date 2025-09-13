"""统一备份/恢复服务（基于文件存储）"""
from __future__ import annotations

import hashlib
from copy import deepcopy
from datetime import datetime
from typing import Dict, Any, Tuple

from app.schemas.backup import (
    BackupSnapshot,
    SnapshotFolder,
    SnapshotText,
    SnapshotAnalysis,
    SnapshotPracticeHistoryRecord,
    BackupImportOptions,
)
from app.schemas.text import PracticeHistoryRecord
from app.services.data_persistence import data_persistence


def _content_hash(text: str) -> str:
    """计算内容哈希用于去重（忽略多余空白）。"""
    normalized = " ".join((text or "").split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


class BackupService:
    """导出/导入统一快照的服务。"""

    def export_snapshot(self) -> BackupSnapshot:
        # 始终从持久层读取，避免路由内存态不一致
        folders = data_persistence.load_folders_data()
        texts = data_persistence.load_texts_data()
        analyses = data_persistence.load_analyses_data()
        history = data_persistence.load_practice_history()

        # 构建快照对象
        now = datetime.now().isoformat()

        folders_out: Dict[str, SnapshotFolder] = {}
        for fid, f in (folders or {}).items():
            try:
                folders_out[fid] = SnapshotFolder(**f)
            except Exception:
                # 容忍局部脏数据
                continue

        texts_out: Dict[str, SnapshotText] = {}
        for tid, t in (texts or {}).items():
            try:
                texts_out[tid] = SnapshotText(**t)
            except Exception:
                continue

        analyses_out: Dict[str, SnapshotAnalysis] = {}
        for tid, a in (analyses or {}).items():
            try:
                analyses_out[tid] = SnapshotAnalysis(**a)
            except Exception:
                continue

        history_out = []
        for r in history or []:
            # 历史中不存 text_id，尝试通过内容反向映射
            text_id_match = None
            if isinstance(r, PracticeHistoryRecord):
                h = _content_hash(r.text_content)
                for tid, t in texts_out.items():
                    if _content_hash(t.content) == h:
                        text_id_match = tid
                        break
                record = SnapshotPracticeHistoryRecord(**r.model_dump(), text_id=text_id_match)
            else:
                # 字典场景
                h = _content_hash(r.get("text_content", ""))
                for tid, t in texts_out.items():
                    if _content_hash(t.content) == h:
                        text_id_match = tid
                        break
                record = SnapshotPracticeHistoryRecord(**r, text_id=text_id_match)
            history_out.append(record)

        snapshot = BackupSnapshot(
            exported_at=now,
            stats={
                "folders": len(folders_out),
                "texts": len(texts_out),
                "analyses": len(analyses_out),
                "practice_history": len(history_out),
            },
            folders=folders_out,
            texts=texts_out,
            analyses=analyses_out,
            practice_history=history_out,
        )
        return snapshot

    def import_snapshot(self, snapshot: BackupSnapshot, options: BackupImportOptions) -> Dict[str, Any]:
        mode = (options.mode or "merge").lower()
        dry_run = bool(options.dry_run)

        # 读取当前数据
        current_folders = data_persistence.load_folders_data()
        current_texts = data_persistence.load_texts_data()
        current_analyses = data_persistence.load_analyses_data()
        current_history = data_persistence.load_practice_history()

        # 工作副本
        folders: Dict[str, Dict[str, Any]] = {} if mode == "replace" else deepcopy(current_folders)
        texts: Dict[str, Dict[str, Any]] = {} if mode == "replace" else deepcopy(current_texts)
        analyses: Dict[str, Dict[str, Any]] = {} if mode == "replace" else deepcopy(current_analyses)
        history = [] if mode == "replace" else deepcopy(current_history)

        # 建立去重索引
        text_id_map: Dict[str, str] = {}  # 导入ID -> 最终ID
        existing_hash_to_id: Dict[str, str] = { _content_hash(t["content"]): tid for tid, t in texts.items() }

        imported_texts = 0
        skipped_texts = 0
        updated_texts = 0

        # 合并文件夹
        imported_folders = 0
        for fid, f in snapshot.folders.items():
            if fid in folders:
                # 简单更新名称/父级，保留ID
                existing = folders[fid]
                if existing.get("name") != f.name or existing.get("parent_id") != f.parent_id:
                    existing["name"] = f.name
                    existing["parent_id"] = f.parent_id
                imported_folders += 1
            else:
                folders[fid] = f.model_dump()
                imported_folders += 1

        # 合并文本
        for tid, t in snapshot.texts.items():
            ch = _content_hash(t.content)
            if tid in texts:
                # 同ID存在：若内容哈希相同，视为已存在；否则保留现有并生成新ID
                if _content_hash(texts[tid].get("content", "")) == ch:
                    text_id_map[tid] = tid
                    skipped_texts += 1
                else:
                    # 生成新的ID，避免覆盖
                    new_tid = f"{tid}-import-{len(texts)+1}"
                    texts[new_tid] = t.model_dump() | {"id": new_tid}
                    text_id_map[tid] = new_tid
                    imported_texts += 1
                    existing_hash_to_id[ch] = new_tid
            else:
                # 按内容去重
                if ch in existing_hash_to_id:
                    text_id_map[tid] = existing_hash_to_id[ch]
                    skipped_texts += 1
                else:
                    texts[tid] = t.model_dump()
                    text_id_map[tid] = tid
                    imported_texts += 1
                    existing_hash_to_id[ch] = tid

        # 合并分析（跟随最终 text_id）
        imported_analyses = 0
        for atid, a in snapshot.analyses.items():
            final_tid = text_id_map.get(atid, atid)
            data = a.model_dump()
            data["text_id"] = final_tid
            analyses[final_tid] = data
            imported_analyses += 1

        # 合并历史：生成 PracticeHistoryRecord，text_id 不保存到现有文件格式，但用于内容对齐
        imported_history = 0
        for r in snapshot.practice_history:
            # 目标文本内容
            final_text_id = text_id_map.get(r.text_id, r.text_id) if r.text_id else None
            if final_text_id and final_text_id in texts:
                target_text = texts[final_text_id]
                record_payload = r.model_dump()
                # 用目标材料内容/标题对齐，保证系统按内容查询能匹配
                record_payload["text_content"] = target_text["content"]
                record_payload["text_title"] = target_text.get("title", record_payload.get("text_title"))
            else:
                record_payload = r.model_dump()

            # 去重：按 id 避免重复
            if isinstance(history, list) and any(getattr(h, "id", None) == record_payload.get("id") for h in history):
                continue

            history.append(PracticeHistoryRecord(**record_payload))
            imported_history += 1

        # 汇总
        summary = {
            "mode": mode,
            "dry_run": dry_run,
            "counts": {
                "folders": len(folders),
                "texts": len(texts),
                "analyses": len(analyses),
                "practice_history": len(history),
            },
            "imported": {
                "folders": imported_folders,
                "texts": imported_texts,
                "analyses": imported_analyses,
                "history": imported_history,
                "skipped_texts": skipped_texts,
                "updated_texts": updated_texts,
            },
        }

        if dry_run:
            return summary

        # 写回磁盘
        data_persistence.save_all_data(history, texts, analyses, folders)

        # 通知内存态刷新（尽量不引入强依赖，容错）
        try:
            from app.routers.texts import initialize_data as reload_texts
            reload_texts()
        except Exception:
            pass
        try:
            from app.routers.folders import initialize_folders_data as reload_folders
            reload_folders()
        except Exception:
            pass

        return summary


backup_service = BackupService()

