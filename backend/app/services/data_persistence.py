"""本地数据持久化服务"""
import json
import os
from pathlib import Path
from typing import Dict, List, Any
from app.schemas.text import PracticeHistoryRecord

class DataPersistenceService:
    """本地数据持久化服务类"""
    
    def __init__(self, data_dir: str = "backend"):
        """
        初始化数据持久化服务
        Args:
            data_dir: 数据存储目录
        """
        self.data_dir = Path(data_dir)
        self.practice_history_file = self.data_dir / "practice_history.json"
        self.texts_data_file = self.data_dir / "texts_data.json"
        self.analyses_data_file = self.data_dir / "analyses_data.json"
        self.folders_data_file = self.data_dir / "folders_data.json"
        
        # 确保数据目录存在
        self.data_dir.mkdir(exist_ok=True)
    
    def save_practice_history(self, practice_history: List[PracticeHistoryRecord]) -> bool:
        """
        保存练习历史记录到本地文件
        Args:
            practice_history: 练习历史记录列表
        Returns:
            bool: 保存是否成功
        """
        try:
            # 转换为可序列化的格式
            serializable_history = []
            for record in practice_history:
                if hasattr(record, 'model_dump'):
                    # Pydantic模型
                    serializable_history.append(record.model_dump())
                else:
                    # 普通字典
                    serializable_history.append(record)
            
            with open(self.practice_history_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "version": "1.0",
                    "records": serializable_history
                }, f, ensure_ascii=False, indent=2)
            
            print(f"✅ 练习历史已保存到: {self.practice_history_file}")
            return True
        except Exception as e:
            print(f"❌ 保存练习历史失败: {e}")
            return False
    
    def load_practice_history(self) -> List[PracticeHistoryRecord]:
        """
        从本地文件加载练习历史记录
        Returns:
            List[PracticeHistoryRecord]: 练习历史记录列表
        """
        try:
            if not self.practice_history_file.exists():
                print("📁 练习历史文件不存在，返回空列表")
                return []
            
            with open(self.practice_history_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            records = data.get("records", [])
            
            # 转换为PracticeHistoryRecord对象
            practice_records = []
            for record in records:
                try:
                    practice_record = PracticeHistoryRecord(**record)
                    practice_records.append(practice_record)
                except Exception as e:
                    print(f"⚠️ 跳过无效的历史记录: {e}")
                    continue
            
            print(f"✅ 成功加载 {len(practice_records)} 条练习历史记录")
            return practice_records
            
        except Exception as e:
            print(f"❌ 加载练习历史失败: {e}")
            return []
    
    def save_texts_data(self, texts_storage: Dict[str, Dict[str, Any]]) -> bool:
        """
        保存文本数据到本地文件
        Args:
            texts_storage: 文本存储字典
        Returns:
            bool: 保存是否成功
        """
        try:
            with open(self.texts_data_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "version": "1.0",
                    "texts": texts_storage
                }, f, ensure_ascii=False, indent=2)
            
            print(f"✅ 文本数据已保存到: {self.texts_data_file}")
            return True
        except Exception as e:
            print(f"❌ 保存文本数据失败: {e}")
            return False
    
    def load_texts_data(self) -> Dict[str, Dict[str, Any]]:
        """
        从本地文件加载文本数据
        Returns:
            Dict[str, Dict[str, Any]]: 文本存储字典
        """
        try:
            if not self.texts_data_file.exists():
                print("📁 文本数据文件不存在，返回空字典")
                return {}
            
            with open(self.texts_data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            texts = data.get("texts", {})
            
            # 修复遗留的无效时间戳和缺失的字段
            from datetime import datetime
            for text_id, text_info in texts.items():
                if text_info.get("created_at") == "now":
                    # 将无效的"now"替换为默认时间戳
                    text_info["created_at"] = "2025-08-27T00:00:00.000000"
                    print(f"🔧 修复文本 {text_id} 的时间戳")
                
                # 为旧数据添加缺失的folder_id字段
                if "folder_id" not in text_info:
                    text_info["folder_id"] = None
                    print(f"🔧 为文本 {text_id} 添加folder_id字段")
                
                # 为旧数据添加缺失的practice_type字段
                if "practice_type" not in text_info:
                    text_info["practice_type"] = "translation"
                    print(f"🔧 为文本 {text_id} 添加practice_type字段")
                
                # 为旧数据添加缺失的topic字段
                if "topic" not in text_info:
                    text_info["topic"] = None
                    print(f"🔧 为文本 {text_id} 添加topic字段")
            
            print(f"✅ 成功加载 {len(texts)} 个文本数据")
            return texts
            
        except Exception as e:
            print(f"❌ 加载文本数据失败: {e}")
            return {}
    
    def save_analyses_data(self, analyses_storage: Dict[str, Dict[str, Any]]) -> bool:
        """
        保存分析数据到本地文件
        Args:
            analyses_storage: 分析结果存储字典
        Returns:
            bool: 保存是否成功
        """
        try:
            with open(self.analyses_data_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "version": "1.0",
                    "analyses": analyses_storage
                }, f, ensure_ascii=False, indent=2)
            
            print(f"✅ 分析数据已保存到: {self.analyses_data_file}")
            return True
        except Exception as e:
            print(f"❌ 保存分析数据失败: {e}")
            return False
    
    def load_analyses_data(self) -> Dict[str, Dict[str, Any]]:
        """
        从本地文件加载分析数据
        Returns:
            Dict[str, Dict[str, Any]]: 分析结果存储字典
        """
        try:
            if not self.analyses_data_file.exists():
                print("📁 分析数据文件不存在，返回空字典")
                return {}
            
            with open(self.analyses_data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            analyses = data.get("analyses", {})
            print(f"✅ 成功加载 {len(analyses)} 个分析结果")
            return analyses
            
        except Exception as e:
            print(f"❌ 加载分析数据失败: {e}")
            return {}
    
    def save_folders_data(self, folders_storage: Dict[str, Dict[str, Any]]) -> bool:
        """
        保存文件夹数据到本地文件
        Args:
            folders_storage: 文件夹存储字典
        Returns:
            bool: 保存是否成功
        """
        try:
            with open(self.folders_data_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "version": "1.0",
                    "folders": folders_storage
                }, f, ensure_ascii=False, indent=2)
            
            print(f"✅ 文件夹数据已保存到: {self.folders_data_file}")
            return True
        except Exception as e:
            print(f"❌ 保存文件夹数据失败: {e}")
            return False
    
    def load_folders_data(self) -> Dict[str, Dict[str, Any]]:
        """
        从本地文件加载文件夹数据
        Returns:
            Dict[str, Dict[str, Any]]: 文件夹存储字典
        """
        try:
            if not self.folders_data_file.exists():
                print("📁 文件夹数据文件不存在，返回空字典")
                return {}
            
            with open(self.folders_data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            folders = data.get("folders", {})
            print(f"✅ 成功加载 {len(folders)} 个文件夹")
            return folders
            
        except Exception as e:
            print(f"❌ 加载文件夹数据失败: {e}")
            return {}
    
    def save_all_data(self, practice_history: List[PracticeHistoryRecord], 
                     texts_storage: Dict[str, Dict[str, Any]], 
                     analyses_storage: Dict[str, Dict[str, Any]],
                     folders_storage: Dict[str, Dict[str, Any]] = None) -> bool:
        """
        保存所有数据到本地文件
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
        从本地文件加载所有数据
        Returns:
            tuple: (practice_history, texts_storage, analyses_storage, folders_storage)
        """
        practice_history = self.load_practice_history()
        texts_storage = self.load_texts_data()
        analyses_storage = self.load_analyses_data()
        folders_storage = self.load_folders_data()
        return practice_history, texts_storage, analyses_storage, folders_storage


# 创建全局实例
data_persistence = DataPersistenceService("data")