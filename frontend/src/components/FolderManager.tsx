import React, { useState, useEffect } from 'react';
import { Folder, Text } from '../types';
import { folderAPI, textAPI } from '../utils/api';
import { 
  Folder as FolderIcon, 
  FolderOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  Move,
  ChevronRight,
  ChevronDown
} from 'lucide-react';

interface FolderManagerProps {
  onFolderSelect: (folderId: string | null) => void;
  selectedFolderId: string | null;
  texts: Text[];
  onTextMove: (textId: string, folderId: string | null) => void;
}

interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  isExpanded: boolean;
}

const FolderManager: React.FC<FolderManagerProps> = ({
  onFolderSelect,
  selectedFolderId,
  texts,
  onTextMove
}) => {
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [movingText, setMovingText] = useState<Text | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [parentFolderId, setParentFolderId] = useState<string | null>(null);

  // 加载文件夹数据
  const loadFolders = async () => {
    try {
      setIsLoading(true);
      const response = await folderAPI.getTree();
      if (response.success && response.data) {
        const treeData = buildFolderTree(response.data);
        setFolders(treeData);
      }
    } catch (error) {
      console.error('加载文件夹失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 构建文件夹树形结构
  const buildFolderTree = (folderData: Folder[]): FolderTreeNode[] => {
    const tree: FolderTreeNode[] = folderData.map(folder => ({
      ...folder,
      children: [],
      isExpanded: false
    }));
    return tree;
  };

  // 切换文件夹展开状态
  const toggleFolderExpanded = (folderId: string) => {
    const updateTree = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
      return nodes.map(node => {
        if (node.id === folderId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children.length > 0) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };
    setFolders(updateTree(folders));
  };

  // 创建文件夹
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const response = await folderAPI.create({
        name: newFolderName.trim(),
        parent_id: parentFolderId
      });

      if (response.success) {
        await loadFolders();
        setShowCreateModal(false);
        setNewFolderName('');
        setParentFolderId(null);
        alert(response.message || '文件夹创建成功！');
      } else {
        alert(response.error || '创建文件夹失败');
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      alert('创建文件夹失败，请重试');
    }
  };

  // 编辑文件夹
  const handleEditFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;

    try {
      const response = await folderAPI.update(editingFolder.id, {
        name: newFolderName.trim()
      });

      if (response.success) {
        await loadFolders();
        setShowEditModal(false);
        setEditingFolder(null);
        setNewFolderName('');
        alert(response.message || '文件夹重命名成功！');
      } else {
        alert(response.error || '重命名失败');
      }
    } catch (error) {
      console.error('重命名文件夹失败:', error);
      alert('重命名失败，请重试');
    }
  };

  // 删除文件夹
  const handleDeleteFolder = async (folder: Folder) => {
    if (!confirm(`确定要删除文件夹"${folder.name}"吗？此操作不可撤销。`)) {
      return;
    }

    try {
      const response = await folderAPI.delete(folder.id, false);
      
      if (response.success) {
        await loadFolders();
        if (selectedFolderId === folder.id) {
          onFolderSelect(null);
        }
        alert(response.message || '文件夹删除成功！');
      } else {
        // 如果是因为有子文件夹而删除失败，询问是否强制删除
        if (response.error?.includes('子文件夹')) {
          if (confirm('该文件夹包含子文件夹，是否强制删除？')) {
            const forceResponse = await folderAPI.delete(folder.id, true);
            if (forceResponse.success) {
              await loadFolders();
              if (selectedFolderId === folder.id) {
                onFolderSelect(null);
              }
              alert(forceResponse.message || '文件夹强制删除成功！');
            } else {
              alert(forceResponse.error || '强制删除失败');
            }
          }
        } else {
          alert(response.error || '删除失败');
        }
      }
    } catch (error) {
      console.error('删除文件夹失败:', error);
      alert('删除失败，请重试');
    }
  };

  // 移动文本到文件夹
  const handleMoveText = async (folderId: string | null) => {
    if (!movingText) return;

    try {
      const response = await textAPI.moveToFolder(movingText.id, folderId);
      
      if (response.success) {
        onTextMove(movingText.id, folderId);
        setShowMoveModal(false);
        setMovingText(null);
        alert(response.message || '材料移动成功！');
      } else {
        alert(response.error || '移动失败');
      }
    } catch (error) {
      console.error('移动文本失败:', error);
      alert('移动失败，请重试');
    }
  };

  // 渲染文件夹树节点
  const renderFolderNode = (node: FolderTreeNode, level: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedFolderId === node.id;
    const textCount = texts.filter(text => text.folder_id === node.id).length;

    return (
      <div key={node.id} className="mb-1">
        <div
          className={`flex items-center py-2 px-2 rounded cursor-pointer hover:bg-gray-100 ${
            isSelected ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          {/* 展开/收起图标 */}
          <div
            className="w-4 h-4 mr-1 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) {
                toggleFolderExpanded(node.id);
              }
            }}
          >
            {hasChildren ? (
              node.isExpanded ? (
                <ChevronDown size={12} />
              ) : (
                <ChevronRight size={12} />
              )
            ) : null}
          </div>

          {/* 文件夹图标 */}
          <div
            className="flex items-center flex-1"
            onClick={() => onFolderSelect(node.id)}
          >
            {node.isExpanded ? (
              <FolderOpen size={16} className="mr-2" />
            ) : (
              <FolderIcon size={16} className="mr-2" />
            )}
            <span className="flex-1 text-sm">{node.name}</span>
            {textCount > 0 && (
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full ml-2">
                {textCount}
              </span>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex items-center space-x-1 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolder(node);
                setNewFolderName(node.name);
                setShowEditModal(true);
              }}
              className="p-1 text-gray-400 hover:text-blue-600 rounded"
              title="重命名"
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(node);
              }}
              className="p-1 text-gray-400 hover:text-red-600 rounded"
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* 子文件夹 */}
        {hasChildren && node.isExpanded && (
          <div>
            {node.children.map(child => renderFolderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    loadFolders();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-medium text-gray-900">文件夹</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
        >
          <Plus size={16} />
          <span className="text-sm">新建</span>
        </button>
      </div>

      {/* 文件夹树 */}
      <div className="p-4">
        {/* 全部材料 */}
        <div
          className={`flex items-center py-2 px-2 rounded cursor-pointer hover:bg-gray-100 mb-2 ${
            selectedFolderId === null ? 'bg-blue-100 text-blue-700' : 'text-gray-700'
          }`}
          onClick={() => onFolderSelect(null)}
        >
          <FolderIcon size={16} className="mr-2" />
          <span className="flex-1 text-sm">全部材料</span>
          <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full ml-2">
            {texts.length}
          </span>
        </div>

        {/* 文件夹列表 */}
        {folders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FolderIcon size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">还没有文件夹</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:text-blue-700 text-sm mt-2"
            >
              创建第一个文件夹
            </button>
          </div>
        ) : (
          <div>
            {folders.map(folder => renderFolderNode(folder))}
          </div>
        )}
      </div>

      {/* 创建文件夹模态框 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">创建新文件夹</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="文件夹名称"
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex space-x-3">
              <button
                onClick={handleCreateFolder}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                创建
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFolderName('');
                  setParentFolderId(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑文件夹模态框 */}
      {showEditModal && editingFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">重命名文件夹</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="文件夹名称"
              className="w-full p-3 border border-gray-300 rounded-lg mb-4"
              onKeyPress={(e) => e.key === 'Enter' && handleEditFolder()}
            />
            <div className="flex space-x-3">
              <button
                onClick={handleEditFolder}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFolder(null);
                  setNewFolderName('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 移动文本模态框 */}
      {showMoveModal && movingText && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium mb-4">移动练习材料</h3>
            <p className="text-gray-600 mb-4">
              将 "{movingText.title}" 移动到：
            </p>
            
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <div
                className="p-3 hover:bg-gray-100 cursor-pointer border-b"
                onClick={() => handleMoveText(null)}
              >
                📁 根目录
              </div>
              {folders.map(folder => (
                <div
                  key={folder.id}
                  className="p-3 hover:bg-gray-100 cursor-pointer border-b"
                  onClick={() => handleMoveText(folder.id)}
                >
                  📁 {folder.name}
                </div>
              ))}
            </div>

            <div className="flex space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMovingText(null);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderManager;