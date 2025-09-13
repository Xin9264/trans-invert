import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { textAPI, practiceAPI } from '../utils/api';
import { Text } from '../types';
import { BookOpen, Clock, TrendingUp, Trash2, Grid3X3, List, Move, FolderPlus } from 'lucide-react';
import FolderManager from '../components/FolderManager';

const Home: React.FC = () => {
  const [texts, setTexts] = useState<Text[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [showMoveDropdown, setShowMoveDropdown] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState<string | null>(null);

  // 专业通知系统
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity ${
      type === 'success' 
        ? 'bg-green-500 text-white' 
        : 'bg-red-500 text-white'
    }`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // 3秒后自动消失
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  };

  // 处理文本移动到文件夹
  const handleTextMove = async (textId: string, folderId: string | null) => {
    setIsMoving(textId);
    try {
      const response = await textAPI.moveToFolder(textId, folderId || undefined);
      if (response.success) {
        // 刷新文本列表
        fetchTexts();
        setShowMoveDropdown(null); // 关闭下拉菜单
        
        // 🔧 使用后端返回的具体消息
        const successMessage = response.message || '移动成功';
        
        // 显示成功提示
        showNotification(successMessage, 'success');
        
      } else {
        // 🔧 显示具体的错误信息
        showNotification(response.error || '移动失败', 'error');
      }
    } catch (error: any) {
      console.error('移动文本失败:', error);
      // 🔧 增强错误提示
      if (error.response?.status === 400) {
        showNotification('目标文件夹不存在，请刷新页面后重试', 'error');
      } else if (error.response?.status === 404) {
        showNotification('练习材料不存在', 'error');
      } else {
        showNotification('移动失败，请检查网络连接', 'error');
      }
    } finally {
      setIsMoving(null);
    }
  };

  // 获取文件夹列表
  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders/');
      const data = await response.json();
      if (data.success) {
        setFolders(data.data);
      }
    } catch (error) {
      console.error('获取文件夹失败:', error);
    }
  };

  // 获取文本列表
  const fetchTexts = async () => {
    try {
      // 并行获取文本材料和练习历史
      const [textsResponse, historyResponse] = await Promise.all([
        textAPI.getAll(selectedFolderId || undefined),
        practiceAPI.getHistory()
      ]);
      
      const allTexts: Text[] = [];
      
      // 处理上传的文本材料
      if (textsResponse.success && textsResponse.data) {
        const formattedTexts = textsResponse.data.map((item: any) => ({
          id: item.text_id,
          title: item.title,
          content: '', // 不显示内容，保持挑战性
          difficultyLevel: item.difficulty || 0,
          wordCount: item.word_count,
          createdBy: '', // 暂时设为空字符串，因为后端没有用户系统
          createdAt: item.created_at,
          lastOpened: item.last_opened,
          type: 'translation' as const, // 标记为回译材料
          folder_id: item.folder_id
        }));
        allTexts.push(...formattedTexts);
      }
      
      // 处理作文范文材料（仅在查看全部材料时显示）
      // 已移除作文相关功能
      
      // 按创建时间排序（最新的在前）
      allTexts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTexts(allTexts);
    } catch (error) {
      console.error('Failed to fetch texts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 删除练习材料
  const handleDeleteMaterial = async (textId: string, title: string) => {
    if (!confirm(`确定要删除练习材料"${title}"吗？此操作不可撤销。`)) {
      return;
    }

    setIsDeletingId(textId);
    try {
      const response = await textAPI.deleteMaterial(textId);
      
      if (response.success) {
        // 从列表中移除已删除的材料
        setTexts(prev => prev.filter(text => text.id !== textId));
        alert(response.message || '删除成功！');
      } else {
        throw new Error(response.error || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsDeletingId(null);
    }
  };

  useEffect(() => {
    fetchTexts();
    fetchFolders();
  }, [selectedFolderId]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMoveDropdown && !(event.target as Element).closest('.move-dropdown-container')) {
        setShowMoveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoveDropdown]);


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Trans Invert 回译练习
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          通过看中文写英文的方式，提升您的英语表达能力。
          AI智能分析，即时反馈，让学习更高效。
        </p>
        <div className="flex justify-center space-x-4">
          <Link to="/upload" className="btn-primary">
            开始练习
          </Link>
          <Link to="/review" className="btn-secondary">
            智能复习
          </Link>
          <Link to="/history" className="btn-secondary">
            查看历史
          </Link>
        </div>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 py-12">
        <div className="text-center">
          <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen className="text-primary-600" size={32} />
          </div>
          <h3 className="text-xl font-semibold mb-2">智能分析</h3>
          <p className="text-gray-600">
            AI自动分析文本语法结构，生成准确的中文翻译
          </p>
        </div>
        <div className="text-center">
          <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="text-primary-600" size={32} />
          </div>
          <h3 className="text-xl font-semibold mb-2">即时反馈</h3>
          <p className="text-gray-600">
            实时评估您的输入，提供详细的语法和语义建议
          </p>
        </div>
        <div className="text-center">
          <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="text-primary-600" size={32} />
          </div>
          <h3 className="text-xl font-semibold mb-2">进步跟踪</h3>
          <p className="text-gray-600">
            记录学习历史，追踪进步轨迹，个性化学习建议
          </p>
        </div>
      </div>

      {/* Main Content Area with Folder Management */}
      <div className="py-12">
        <div className="flex space-x-6">
          {/* Folder Sidebar */}
          <div className="w-1/4 min-w-[300px]">
            <FolderManager
              onFolderSelect={setSelectedFolderId}
              selectedFolderId={selectedFolderId}
              texts={texts}
              onTextMove={handleTextMove}
            />
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Recent Texts */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedFolderId ? '文件夹中的材料' : '所有练习材料'}
              </h2>
              <div className="flex items-center space-x-3">
                {/* 视图切换按钮 */}
                {texts.length > 0 && (
                  <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode('card')}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
                        viewMode === 'card' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <Grid3X3 size={16} />
                      <span>卡片</span>
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex items-center space-x-1 px-3 py-2 rounded-md transition-colors ${
                        viewMode === 'list' 
                          ? 'bg-white text-gray-900 shadow-sm' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <List size={16} />
                      <span>列表</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {texts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  {selectedFolderId ? '此文件夹暂无练习材料' : '还没有练习材料'}
                </p>
                <Link to="/upload" className="btn-primary">
                  上传第一个文本
                </Link>
              </div>
            ) : (
              <div>
                {viewMode === 'card' ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {texts.map((text) => (
                      <div key={text.id} className="card hover:shadow-md transition-shadow relative">
                        {/* 操作菜单 */}
                        <div className="absolute top-2 right-2 flex space-x-1">
                          {/* 移动按钮 */}
                          <div className="relative move-dropdown-container">
                            <button
                              onClick={() => setShowMoveDropdown(showMoveDropdown === text.id ? null : text.id)}
                              disabled={isMoving === text.id}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="移动到文件夹"
                            >
                              {isMoving === text.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                              ) : (
                                <Move size={16} />
                              )}
                            </button>
                            
                            {/* 移动下拉菜单 */}
                            {showMoveDropdown === text.id && (
                              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 animate-in fade-in-0 zoom-in-95 duration-100">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleTextMove(text.id, null)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                  >
                                    <FolderPlus size={14} />
                                    <span>移动到根目录</span>
                                  </button>
                                  {folders.length > 0 && (
                                    <div className="border-t border-gray-100 my-1"></div>
                                  )}
                                  {folders.map(folder => (
                                    <button
                                      key={folder.id}
                                      onClick={() => handleTextMove(text.id, folder.id)}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                    >
                                      <FolderPlus size={14} />
                                      <span>移动到 {folder.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* 删除按钮 */}
                          <button
                            onClick={() => handleDeleteMaterial(text.id, text.title || '未命名文本')}
                            disabled={isDeletingId === text.id}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="删除此材料"
                          >
                            {isDeletingId === text.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>

                        <h3 className="font-semibold text-gray-900 mb-2 pr-16">
                          {text.title || '未命名文本'}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                          {text.content.substring(0, 100)}...
                        </p>
                        <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                          <div className="flex items-center space-x-2">
                            <span>难度: {text.difficultyLevel}/5</span>
                          </div>
                          <span>{text.wordCount} 词</span>
                        </div>
                        {text.lastOpened && (
                          <p className="text-xs text-gray-400 mb-2">
                            上次打开: {new Date(text.lastOpened).toLocaleDateString('zh-CN')}
                          </p>
                        )}
                        <Link
                          to={`/practice/${text.id}`}
                          className="btn-primary w-full text-center"
                        >
                          开始练习
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            标题
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            难度
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            词数
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            上次打开
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {texts.map((text) => (
                          <tr key={text.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {text.title || '未命名文本'}
                                  </div>
                                  <div className="text-sm text-gray-500 truncate max-w-xs">
                                    {text.content.substring(0, 50)}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {text.difficultyLevel}/5
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {text.wordCount} 词
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {text.lastOpened 
                                ? new Date(text.lastOpened).toLocaleDateString('zh-CN')
                                : '未打开'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end space-x-2">
                                <Link
                                  to={`/practice/${text.id}`}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  开始练习
                                </Link>
                                
                                {/* 移动按钮 */}
                                <div className="relative move-dropdown-container">
                                  <button
                                    onClick={() => setShowMoveDropdown(showMoveDropdown === text.id ? null : text.id)}
                                    disabled={isMoving === text.id}
                                    className="text-blue-600 hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="移动到文件夹"
                                  >
                                    {isMoving === text.id ? '移动中...' : '移动'}
                                  </button>
                                  
                                  {/* 移动下拉菜单 */}
                                  {showMoveDropdown === text.id && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 animate-in fade-in-0 zoom-in-95 duration-100">
                                      <div className="py-1">
                                        <button
                                          onClick={() => handleTextMove(text.id, null)}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                        >
                                          <FolderPlus size={14} />
                                          <span>移动到根目录</span>
                                        </button>
                                        {folders.length > 0 && (
                                          <div className="border-t border-gray-100 my-1"></div>
                                        )}
                                        {folders.map(folder => (
                                          <button
                                            key={folder.id}
                                            onClick={() => handleTextMove(text.id, folder.id)}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                          >
                                            <FolderPlus size={14} />
                                            <span>移动到 {folder.name}</span>
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                <button
                                  onClick={() => handleDeleteMaterial(text.id, text.title || '未命名文本')}
                                  disabled={isDeletingId === text.id}
                                  className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                >
                                  {isDeletingId === text.id ? '删除中...' : '删除'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
