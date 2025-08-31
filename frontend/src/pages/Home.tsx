import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { textAPI, practiceAPI } from '../utils/api';
import { Text } from '../types';
import { BookOpen, Clock, TrendingUp, Trash2, Grid3X3, List, Move, FolderPlus, Target, Upload, FileText, Brain, Search, SortAsc, SortDesc, Plus, BookOpenCheck } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 统计数据
  const stats = {
    totalMaterials: texts.length,
    completedToday: 3,
    averageAccuracy: 87,
    streakDays: 12,
  };

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
        fetchTexts();
        setShowMoveDropdown(null);
        
        const successMessage = response.message || '移动成功';
        showNotification(successMessage, 'success');
        
      } else {
        showNotification(response.error || '移动失败', 'error');
      }
    } catch (error: any) {
      console.error('移动文本失败:', error);
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
      const [textsResponse, historyResponse] = await Promise.all([
        textAPI.getAll(selectedFolderId || undefined),
        practiceAPI.getHistory()
      ]);
      
      const allTexts: Text[] = [];
      
      if (textsResponse.success && textsResponse.data) {
        const formattedTexts = textsResponse.data.map((item: any) => ({
          id: item.text_id,
          title: item.title,
          content: '',
          difficultyLevel: item.difficulty || 0,
          wordCount: item.word_count,
          createdBy: '',
          createdAt: item.created_at,
          lastOpened: item.last_opened,
          type: 'translation' as const,
          folder_id: item.folder_id
        }));
        allTexts.push(...formattedTexts);
      }
      
      if (!selectedFolderId && historyResponse.success && historyResponse.data) {
        const essayMaterials = historyResponse.data
          .filter((record: any) => record.practice_type === 'essay')
          .map((record: any) => ({
            id: record.id,
            title: record.text_title,
            content: '',
            difficultyLevel: 5,
            wordCount: record.text_content.split(' ').length,
            createdBy: 'AI生成',
            createdAt: record.timestamp,
            lastOpened: record.timestamp,
            type: 'essay' as const
          }));
        allTexts.push(...essayMaterials);
      }
      
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="space-y-8 px-4 md:px-6 py-6">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-2xl gradient-primary p-8 text-white">
          <div className="relative z-10">
            <div className="max-w-2xl">
              <h1 className="font-heading font-black text-4xl md:text-5xl text-balance mb-4">Trans Invert</h1>
              <p className="text-xl md:text-2xl font-medium mb-2 opacity-90">回译法语言练习平台</p>
              <p className="text-lg opacity-80 mb-6 text-pretty">
                通过回译练习提升英语翻译和写作能力，让语言学习更高效、更有趣
              </p>
              <Link to="/upload" className="btn-primary inline-flex items-center">
                <BookOpen className="mr-2 h-5 w-5" />
                开始练习
              </Link>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 translate-x-24" />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card gradient-card border-0 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{stats.totalMaterials}</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>练习材料</p>
              </div>
            </div>
          </div>

          <div className="card gradient-card border-0 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--secondary)' }}>{stats.completedToday}</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>今日完成</p>
              </div>
            </div>
          </div>

          <div className="card gradient-card border-0 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg">
                <BookOpenCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{stats.averageAccuracy}%</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>平均准确率</p>
              </div>
            </div>
          </div>

          <div className="card gradient-card border-0 shadow-soft">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{stats.streakDays}</p>
                <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>连续天数</p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="card group hover:shadow-glow transition-all duration-300 cursor-pointer border-0 gradient-card">
            <div className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <Upload className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">回译练习</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>上传文本进行回译训练</p>
                </div>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>通过中英文对照练习，提升翻译准确性和语言表达能力</p>
          </div>

          <div className="card group hover:shadow-glow transition-all duration-300 cursor-pointer border-0 gradient-card">
            <div className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">作文练习</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>针对性作文写作训练</p>
                </div>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>基于考试类型生成范文，练习写作技巧和表达方式</p>
          </div>

          <div className="card group hover:shadow-glow transition-all duration-300 cursor-pointer border-0 gradient-card">
            <div className="pb-3">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-green-400 to-green-600 shadow-lg group-hover:shadow-xl transition-all duration-300">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">智能复习</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>基于艾宾浩斯曲线的智能复习</p>
                </div>
              </div>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>科学的复习安排，帮助巩固学习成果，提高记忆效果</p>
          </div>
        </div>

        {/* Materials Management */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-2xl">我的练习材料</h2>
            <Link to="/upload" className="btn-primary inline-flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              添加材料
            </Link>
          </div>

          {/* Content Area */}
          <div className="grid lg:grid-cols-4 gap-6">
            {/* Folder Sidebar */}
            <div className="lg:col-span-1">
              <FolderManager
                onFolderSelect={setSelectedFolderId}
                selectedFolderId={selectedFolderId}
                texts={texts}
                onTextMove={handleTextMove}
              />
            </div>

            {/* Materials Grid/List */}
            <div className="lg:col-span-3">
              {/* Filters and Search */}
              <div className="card border-0 shadow-soft mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
                      <input
                        type="text"
                        placeholder="搜索练习材料..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border"
                        style={{ backgroundColor: 'var(--input)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex border rounded-lg" style={{ borderColor: 'var(--border)' }}>
                      <button
                        onClick={() => setViewMode('card')}
                        className={`flex items-center px-3 py-2 rounded-l-lg transition-colors ${
                          viewMode === 'card' 
                            ? 'text-white shadow-soft' 
                            : 'hover:bg-gray-100'
                        }`}
                        style={{ 
                          backgroundColor: viewMode === 'card' ? 'var(--primary)' : 'transparent',
                          color: viewMode === 'card' ? 'var(--primary-foreground)' : 'var(--foreground)'
                        }}
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center px-3 py-2 rounded-r-lg transition-colors ${
                          viewMode === 'list' 
                            ? 'text-white shadow-soft' 
                            : 'hover:bg-gray-100'
                        }`}
                        style={{ 
                          backgroundColor: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                          color: viewMode === 'list' ? 'var(--primary-foreground)' : 'var(--foreground)'
                        }}
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      className="px-3 py-2 rounded-lg border transition-colors hover:bg-gray-100"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    >
                      {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {texts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="mb-4" style={{ color: 'var(--muted-foreground)' }}>
                    {selectedFolderId ? '此文件夹暂无练习材料' : '还没有练习材料'}
                  </p>
                  <Link to="/upload" className="btn-primary">
                    上传第一个文本
                  </Link>
                </div>
              ) : (
                <div>
                  {viewMode === 'card' ? (
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {texts.map((text) => (
                        <div key={text.id} className="card hover:shadow-glow transition-all duration-300 relative">
                          {/* 材料类型图标 */}
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`p-2.5 rounded-xl shadow-md ${
                              text.type === 'essay' 
                                ? 'bg-gradient-to-br from-purple-400 to-purple-600' 
                                : 'bg-gradient-to-br from-blue-400 to-blue-600'
                            }`}>
                              {text.type === 'essay' ? (
                                <FileText className="h-5 w-5 text-white" />
                              ) : (
                                <BookOpen className="h-5 w-5 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  text.type === 'essay' 
                                    ? 'bg-purple-100 text-purple-700' 
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {text.type === 'essay' ? '作文练习' : '回译练习'}
                                </span>
                                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                  难度: {text.difficultyLevel}/5
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 操作菜单 */}
                          <div className="absolute top-2 right-2 flex space-x-1">
                            {/* 移动按钮 */}
                            <div className="relative move-dropdown-container">
                              <button
                                onClick={() => setShowMoveDropdown(showMoveDropdown === text.id ? null : text.id)}
                                disabled={isMoving === text.id}
                                className="p-2 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ color: 'var(--muted-foreground)' }}
                                title="移动到文件夹"
                              >
                                {isMoving === text.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: 'var(--primary)' }}></div>
                                ) : (
                                  <Move size={16} />
                                )}
                              </button>
                              
                              {/* 移动下拉菜单 */}
                              {showMoveDropdown === text.id && (
                                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg z-10 animate-in fade-in-0 zoom-in-95 duration-100" style={{ backgroundColor: 'var(--popover)', borderColor: 'var(--border)' }}>
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleTextMove(text.id, null)}
                                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                      style={{ color: 'var(--popover-foreground)' }}
                                    >
                                      <FolderPlus size={14} />
                                      <span>移动到根目录</span>
                                    </button>
                                    {folders.length > 0 && (
                                      <div className="border-t my-1" style={{ borderColor: 'var(--border)' }}></div>
                                    )}
                                    {folders.map(folder => (
                                      <button
                                        key={folder.id}
                                        onClick={() => handleTextMove(text.id, folder.id)}
                                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                        style={{ color: 'var(--popover-foreground)' }}
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
                              className="p-2 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ color: 'var(--muted-foreground)' }}
                              title="删除此材料"
                            >
                              {isDeletingId === text.id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>

                          <h3 className="font-semibold mb-2 pr-16">
                            {text.title || '未命名文本'}
                          </h3>
                          <p className="text-sm mb-4 line-clamp-3" style={{ color: 'var(--muted-foreground)' }}>
                            {text.content.substring(0, 100)}...
                          </p>
                          <div className="flex justify-between items-center text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span>{text.wordCount} 词</span>
                            </div>
                            <span className="text-xs">
                              {text.createdBy || '系统生成'}
                            </span>
                          </div>
                          {text.lastOpened && (
                            <p className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>
                              上次打开: {new Date(text.lastOpened).toLocaleDateString('zh-CN')}
                            </p>
                          )}
                          <Link
                            to={`/practice/${text.id}`}
                            className="btn-primary w-full text-center inline-block"
                          >
                            开始练习
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="card overflow-hidden">
                      <table className="min-w-full divide-y" style={{ borderColor: 'var(--border)' }}>
                        <thead style={{ backgroundColor: 'var(--muted)' }}>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                              标题
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                              难度
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                              词数
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                              上次打开
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
                              操作
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                          {texts.map((text) => (
                            <tr key={text.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2 rounded-lg shadow-sm ${
                                    text.type === 'essay' 
                                      ? 'bg-gradient-to-br from-purple-400 to-purple-600' 
                                      : 'bg-gradient-to-br from-blue-400 to-blue-600'
                                  }`}>
                                    {text.type === 'essay' ? (
                                      <FileText className="h-4 w-4 text-white" />
                                    ) : (
                                      <BookOpen className="h-4 w-4 text-white" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <div className="text-sm font-medium">
                                        {text.title || '未命名文本'}
                                      </div>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        text.type === 'essay' 
                                          ? 'bg-purple-100 text-purple-700' 
                                          : 'bg-blue-100 text-blue-700'
                                      }`}>
                                        {text.type === 'essay' ? '作文练习' : '回译练习'}
                                      </span>
                                    </div>
                                    <div className="text-sm truncate max-w-xs" style={{ color: 'var(--muted-foreground)' }}>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                {text.wordCount} 词
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--muted-foreground)' }}>
                                {text.lastOpened 
                                  ? new Date(text.lastOpened).toLocaleDateString('zh-CN')
                                  : '未打开'
                                }
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end space-x-2">
                                  <Link
                                    to={`/practice/${text.id}`}
                                    className="hover:text-indigo-900"
                                    style={{ color: 'var(--primary)' }}
                                  >
                                    开始练习
                                  </Link>
                                  
                                  {/* 移动按钮 */}
                                  <div className="relative move-dropdown-container">
                                    <button
                                      onClick={() => setShowMoveDropdown(showMoveDropdown === text.id ? null : text.id)}
                                      disabled={isMoving === text.id}
                                      className="hover:text-blue-900 disabled:opacity-50 disabled:cursor-not-allowed"
                                      style={{ color: 'var(--primary)' }}
                                      title="移动到文件夹"
                                    >
                                      {isMoving === text.id ? '移动中...' : '移动'}
                                    </button>
                                    
                                    {/* 移动下拉菜单 */}
                                    {showMoveDropdown === text.id && (
                                      <div className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg z-10 animate-in fade-in-0 zoom-in-95 duration-100" style={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)' }}>
                                        <div className="py-1">
                                          <button
                                            onClick={() => handleTextMove(text.id, null)}
                                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                            style={{ color: 'var(--popover-foreground)' }}
                                          >
                                            <FolderPlus size={14} />
                                            <span>移动到根目录</span>
                                          </button>
                                          {folders.length > 0 && (
                                            <div className="border-t my-1" style={{ borderColor: 'var(--border)' }}></div>
                                          )}
                                          {folders.map(folder => (
                                            <button
                                              key={folder.id}
                                              onClick={() => handleTextMove(text.id, folder.id)}
                                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center space-x-2 transition-colors"
                                              style={{ color: 'var(--popover-foreground)' }}
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
    </div>
  );
};

export default Home;
