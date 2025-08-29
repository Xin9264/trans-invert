import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { textAPI, practiceAPI } from '../utils/api';
import { Text } from '../types';
import { BookOpen, Clock, TrendingUp, Trash2, Grid3X3, List } from 'lucide-react';

const Home: React.FC = () => {
  const [texts, setTexts] = useState<Text[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

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
    const fetchTexts = async () => {
      try {
        // 并行获取文本材料和练习历史
        const [textsResponse, historyResponse] = await Promise.all([
          textAPI.getAll(),
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
            type: 'translation' as const // 标记为回译材料
          }));
          allTexts.push(...formattedTexts);
        }
        
        // 处理作文范文材料
        if (historyResponse.success && historyResponse.data) {
          const essayMaterials = historyResponse.data
            .filter((record: any) => record.practice_type === 'essay')
            .map((record: any) => ({
              id: record.id,
              title: record.text_title,
              content: '', // 不显示内容，保持挑战性
              difficultyLevel: 5, // 作文材料默认难度5
              wordCount: record.text_content.split(' ').length,
              createdBy: 'AI生成',
              createdAt: record.timestamp,
              lastOpened: record.timestamp,
              type: 'essay' as const // 标记为作文材料
            }));
          allTexts.push(...essayMaterials);
        }
        
        // 按创建时间排序（最新的在前）
        allTexts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        setTexts(allTexts);
      } catch (error) {
        console.error('Failed to fetch texts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTexts();
  }, []);


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

      {/* Recent Texts */}
      <div className="py-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">练习材料</h2>
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
            <p className="text-gray-500 mb-4">还没有练习材料</p>
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
                    {/* 删除按钮 */}
                    <button
                      onClick={() => handleDeleteMaterial(text.id, text.title || '未命名文本')}
                      disabled={isDeletingId === text.id}
                      className="absolute top-2 right-2 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="删除此材料"
                    >
                      {isDeletingId === text.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>

                    <h3 className="font-semibold text-gray-900 mb-2 pr-8">
                      {text.title || '未命名文本'}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {text.content.substring(0, 100)}...
                    </p>
                    <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                      <div className="flex items-center space-x-2">
                        <span>难度: {text.difficultyLevel}/5</span>
                        {text.type === 'essay' && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                            作文
                          </span>
                        )}
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
                            {text.type === 'essay' && (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                作文
                              </span>
                            )}
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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <Link
                            to={`/practice/${text.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            开始练习
                          </Link>
                          <button
                            onClick={() => handleDeleteMaterial(text.id, text.title || '未命名文本')}
                            disabled={isDeletingId === text.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50"
                          >
                            {isDeletingId === text.id ? '删除中...' : '删除'}
                          </button>
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
  );
};

export default Home;
