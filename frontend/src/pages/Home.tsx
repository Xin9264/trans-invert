import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { textAPI } from '../utils/api';
import { Text } from '../types';
import { BookOpen, Clock, TrendingUp, Download } from 'lucide-react';

const Home: React.FC = () => {
  const [texts, setTexts] = useState<Text[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchTexts = async () => {
      try {
        const response = await textAPI.getAll();
        if (response.success && response.data) {
          // 转换数据格式以适配前端组件
          const formattedTexts = response.data.map((item: any) => ({
            id: item.text_id,
            title: item.title,
            content: '', // 不显示内容，保持挑战性
            difficultyLevel: item.difficulty || 0,
            wordCount: item.word_count,
            createdAt: new Date().toISOString()
          }));
          setTexts(formattedTexts);
        }
      } catch (error) {
        console.error('Failed to fetch texts:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTexts();
  }, []);

  const handleExportMaterials = async () => {
    if (texts.length === 0) {
      alert('没有练习材料可以导出');
      return;
    }

    setIsExporting(true);
    try {
      const blob = await textAPI.exportMaterials();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 生成文件名
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.download = `practice_materials_${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      alert('练习材料导出成功！');
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

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
          {texts.length > 0 && (
            <button
              onClick={handleExportMaterials}
              disabled={isExporting}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Download size={16} />
              )}
              <span>{isExporting ? '导出中...' : '导出材料'}</span>
            </button>
          )}
        </div>
        {texts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">还没有练习材料</p>
            <Link to="/upload" className="btn-primary">
              上传第一个文本
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {texts.map((text) => (
              <div key={text.id} className="card hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900 mb-2">
                  {text.title || '未命名文本'}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {text.content.substring(0, 100)}...
                </p>
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <span>难度: {text.difficultyLevel}/5</span>
                  <span>{text.wordCount} 词</span>
                </div>
                <Link
                  to={`/practice/${text.id}`}
                  className="btn-primary w-full text-center"
                >
                  开始练习
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
