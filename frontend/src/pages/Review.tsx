import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, BookOpen, Target, TrendingUp, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { reviewAPI, ReviewStats, ReviewMaterial } from '../utils/api';

const Review: React.FC = () => {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<ReviewMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 获取复习统计
  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const response = await reviewAPI.getStats();
      
      if (response.success && response.data) {
        setStats(response.data);
      } else {
        throw new Error(response.error || '获取统计失败');
      }
    } catch (error) {
      console.error('获取复习统计失败:', error);
      setError('获取复习统计失败');
    } finally {
      setIsLoadingStats(false);
    }
  };

  // 生成复习材料
  const generateReviewMaterial = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      const response = await reviewAPI.generate();
      
      if (response.success && response.data) {
        setGeneratedMaterial(response.data);
        // 刷新统计数据
        fetchStats();
      } else {
        throw new Error(response.error || '生成复习材料失败');
      }
    } catch (error) {
      console.error('生成复习材料失败:', error);
      setError(error instanceof Error ? error.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoadingStats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center">
            <Brain className="text-purple-600" size={32} />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          智能复习
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          基于您的练习历史，AI 为您生成个性化复习材料，针对性地改善薄弱环节
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
          <AlertCircle className="text-red-500 mt-0.5" size={20} />
          <div>
            <h3 className="font-medium text-red-800">生成失败</h3>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <BookOpen className="text-blue-600" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.total_practiced}</div>
            <div className="text-sm text-gray-500">已练习材料</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <RefreshCw className="text-orange-600" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.need_review}</div>
            <div className="text-sm text-gray-500">需要复习</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.mastered}</div>
            <div className="text-sm text-gray-500">已掌握</div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
              <Target className="text-purple-600" size={24} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.focus_areas.length}</div>
            <div className="text-sm text-gray-500">重点领域</div>
          </div>
        </div>
      )}

      {/* Focus Areas */}
      {stats && stats.focus_areas.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Target className="mr-2" size={20} />
              需要重点复习的领域
            </h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {stats.focus_areas.map((area, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generate Review Material */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Brain className="mr-2" size={20} />
            生成个性化复习材料
          </h2>
        </div>
        <div className="p-6">
          {stats && stats.total_practiced === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                您还没有练习记录，无法生成个性化复习材料
              </p>
              <Link to="/upload" className="btn-primary">
                开始练习
              </Link>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-6">
                基于您的练习历史和错误模式，AI 将为您生成针对性的复习文章
              </p>
              <button
                onClick={generateReviewMaterial}
                disabled={isGenerating}
                className={`btn-primary ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGenerating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    AI 正在生成中...
                  </div>
                ) : (
                  '生成复习材料'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Generated Material */}
      {generatedMaterial && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="mr-2" size={20} />
              您的个性化复习材料
            </h2>
          </div>
          <div className="p-6">
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="font-medium text-gray-900 mb-3">复习文章</h3>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {generatedMaterial.review_article}
              </p>
            </div>

            {/* Analysis Summary */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-blue-900 mb-2">分析摘要</h4>
              <div className="text-sm text-blue-700">
                <p>基于您的 {generatedMaterial.analysis_summary.total_records} 次练习记录生成</p>
                {generatedMaterial.analysis_summary.focus_areas.length > 0 && (
                  <p>重点关注: {generatedMaterial.analysis_summary.focus_areas.join('、')}</p>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <Link
                to={`/practice/${generatedMaterial.text_id}`}
                className="btn-primary"
              >
                开始练习这篇复习材料
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-12 text-center">
        <p className="text-gray-500 text-sm">
          复习材料会根据您的错误模式和薄弱环节动态生成，建议定期使用以获得最佳学习效果
        </p>
      </div>
    </div>
  );
};

export default Review;