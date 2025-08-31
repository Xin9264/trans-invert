"""文件夹管理路由"""
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, HTTPException
from app.schemas.text import APIResponse
from app.services.data_persistence import data_persistence

router = APIRouter(prefix="/api/folders", tags=["folders"])

# 文件夹存储
folders_storage: Dict[str, Dict[str, Any]] = {}

def initialize_folders_data():
    """初始化文件夹数据，从本地文件加载"""
    global folders_storage
    try:
        print("🔄 正在从本地文件加载文件夹数据...")
        loaded_folders = data_persistence.load_folders_data()
        folders_storage = loaded_folders
        print(f"✅ 文件夹数据加载完成: {len(folders_storage)} 个文件夹")
    except Exception as e:
        print(f"❌ 文件夹数据加载失败: {e}")

def save_folders_data():
    """保存文件夹数据到本地文件"""
    try:
        data_persistence.save_folders_data(folders_storage)
        print("💾 文件夹数据已自动保存到本地文件")
    except Exception as e:
        print(f"❌ 文件夹数据保存失败: {e}")

# 启动时自动加载文件夹数据
initialize_folders_data()

@router.get("/", response_model=APIResponse)
async def get_all_folders():
    """获取所有文件夹"""
    try:
        folders_list = []
        for folder_id, folder_info in folders_storage.items():
            folders_list.append({
                "id": folder_info["id"],
                "name": folder_info["name"],
                "parent_id": folder_info.get("parent_id"),
                "created_at": folder_info.get("created_at", datetime.now().isoformat())
            })
        
        # 按创建时间排序（最新的在前面）
        folders_list.sort(key=lambda x: x["created_at"], reverse=True)
        
        return APIResponse(
            success=True,
            data=folders_list,
            message=f"获取到 {len(folders_list)} 个文件夹"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件夹列表失败: {str(e)}")

@router.post("/", response_model=APIResponse)
async def create_folder(folder_data: Dict[str, Any]):
    """创建新文件夹"""
    try:
        # 验证必要字段
        if "name" not in folder_data or not folder_data["name"].strip():
            raise HTTPException(status_code=400, detail="文件夹名称不能为空")
        
        # 生成唯一ID
        folder_id = str(uuid.uuid4())
        
        # 验证父文件夹是否存在（如果指定了）
        parent_id = folder_data.get("parent_id")
        if parent_id and parent_id not in folders_storage:
            raise HTTPException(status_code=400, detail="指定的父文件夹不存在")
        
        # 检查同级文件夹中是否已存在同名文件夹
        folder_name = folder_data["name"].strip()
        for existing_folder in folders_storage.values():
            if (existing_folder["name"] == folder_name and 
                existing_folder.get("parent_id") == parent_id):
                raise HTTPException(status_code=400, detail="同级目录下已存在同名文件夹")
        
        # 创建文件夹
        new_folder = {
            "id": folder_id,
            "name": folder_name,
            "parent_id": parent_id,
            "created_at": datetime.now().isoformat()
        }
        
        folders_storage[folder_id] = new_folder
        
        # 保存数据
        save_folders_data()
        
        return APIResponse(
            success=True,
            data=new_folder,
            message=f"文件夹 '{folder_name}' 创建成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建文件夹失败: {str(e)}")

@router.put("/{folder_id}", response_model=APIResponse)
async def update_folder(folder_id: str, folder_data: Dict[str, Any]):
    """更新文件夹信息"""
    try:
        if folder_id not in folders_storage:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        folder = folders_storage[folder_id]
        
        # 更新文件夹名称
        if "name" in folder_data:
            new_name = folder_data["name"].strip()
            if not new_name:
                raise HTTPException(status_code=400, detail="文件夹名称不能为空")
            
            # 检查同级文件夹中是否已存在同名文件夹
            for existing_folder_id, existing_folder in folders_storage.items():
                if (existing_folder_id != folder_id and
                    existing_folder["name"] == new_name and 
                    existing_folder.get("parent_id") == folder.get("parent_id")):
                    raise HTTPException(status_code=400, detail="同级目录下已存在同名文件夹")
            
            folder["name"] = new_name
        
        # 更新父文件夹（移动文件夹）
        if "parent_id" in folder_data:
            new_parent_id = folder_data["parent_id"]
            
            # 验证新父文件夹是否存在（如果指定了）
            if new_parent_id and new_parent_id not in folders_storage:
                raise HTTPException(status_code=400, detail="指定的父文件夹不存在")
            
            # 防止循环引用（文件夹不能移动到自己的子文件夹中）
            if new_parent_id:
                current_parent = new_parent_id
                while current_parent:
                    if current_parent == folder_id:
                        raise HTTPException(status_code=400, detail="不能将文件夹移动到自己的子文件夹中")
                    current_parent = folders_storage.get(current_parent, {}).get("parent_id")
            
            folder["parent_id"] = new_parent_id
        
        # 保存数据
        save_folders_data()
        
        return APIResponse(
            success=True,
            data=folder,
            message=f"文件夹 '{folder['name']}' 更新成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新文件夹失败: {str(e)}")

@router.delete("/{folder_id}", response_model=APIResponse)
async def delete_folder(folder_id: str, force: bool = False):
    """删除文件夹"""
    try:
        if folder_id not in folders_storage:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        folder = folders_storage[folder_id]
        
        # 检查是否有子文件夹
        child_folders = [f for f in folders_storage.values() if f.get("parent_id") == folder_id]
        if child_folders and not force:
            raise HTTPException(
                status_code=400, 
                detail=f"文件夹 '{folder['name']}' 包含 {len(child_folders)} 个子文件夹，请先删除子文件夹或使用强制删除"
            )
        
        # 检查是否有文本材料（需要从texts_storage中检查）
        # 这里先暂时跳过，在后续实现材料关联时处理
        
        # 如果是强制删除，递归删除所有子文件夹
        if force:
            def delete_folder_recursive(fid: str):
                # 删除所有子文件夹
                children = [f["id"] for f in folders_storage.values() if f.get("parent_id") == fid]
                for child_id in children:
                    delete_folder_recursive(child_id)
                # 删除当前文件夹
                if fid in folders_storage:
                    del folders_storage[fid]
            
            delete_folder_recursive(folder_id)
            deleted_count = len(child_folders) + 1
            
            # 保存数据
            save_folders_data()
            
            return APIResponse(
                success=True,
                data={"deleted_count": deleted_count},
                message=f"文件夹 '{folder['name']}' 及其 {len(child_folders)} 个子文件夹已删除"
            )
        else:
            # 普通删除
            del folders_storage[folder_id]
            
            # 保存数据
            save_folders_data()
            
            return APIResponse(
                success=True,
                data={"folder_id": folder_id},
                message=f"文件夹 '{folder['name']}' 已删除"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除文件夹失败: {str(e)}")

@router.get("/{folder_id}", response_model=APIResponse)
async def get_folder(folder_id: str):
    """获取单个文件夹信息"""
    try:
        if folder_id not in folders_storage:
            raise HTTPException(status_code=404, detail="文件夹不存在")
        
        folder = folders_storage[folder_id]
        
        # 获取子文件夹
        child_folders = [
            f for f in folders_storage.values() 
            if f.get("parent_id") == folder_id
        ]
        
        # 构建返回数据
        folder_data = {
            "id": folder["id"],
            "name": folder["name"],
            "parent_id": folder.get("parent_id"),
            "created_at": folder.get("created_at", datetime.now().isoformat()),
            "child_folders": child_folders,
            "child_count": len(child_folders)
        }
        
        return APIResponse(
            success=True,
            data=folder_data,
            message="获取文件夹信息成功"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件夹信息失败: {str(e)}")

@router.get("/tree/all", response_model=APIResponse)
async def get_folder_tree():
    """获取文件夹树形结构"""
    try:
        def build_tree(parent_id: Optional[str] = None) -> List[Dict[str, Any]]:
            """递归构建文件夹树"""
            tree = []
            
            # 找到所有直接子文件夹
            children = [
                folder for folder in folders_storage.values()
                if folder.get("parent_id") == parent_id
            ]
            
            # 按名称排序
            children.sort(key=lambda x: x["name"])
            
            for folder in children:
                folder_node = {
                    "id": folder["id"],
                    "name": folder["name"],
                    "parent_id": folder.get("parent_id"),
                    "created_at": folder.get("created_at"),
                    "children": build_tree(folder["id"])
                }
                tree.append(folder_node)
            
            return tree
        
        tree = build_tree()
        
        return APIResponse(
            success=True,
            data=tree,
            message="获取文件夹树形结构成功"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件夹树形结构失败: {str(e)}")