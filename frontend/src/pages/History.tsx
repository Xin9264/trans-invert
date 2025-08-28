import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { practiceAPI, PracticeHistoryRecord, PracticeHistoryExport } from '../utils/api';
import { Calendar, TrendingUp, Target, Clock, Download, Upload } from 'lucide-react';

// 使用从API导入的类型，但保持兼容性
type PracticeRecord = PracticeHistoryRecord;

const History: React.FC = () => {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState({
    totalSessions: 0,
    averageScore: 0,
    totalTimeSpent: 0,
    bestScore: 0
  });

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await practiceAPI.getHistory();
        if (response.success) {
          setRecords(response.data || []);
          calculateStats(response.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const calculateStats = (records: PracticeRecord[]) => {
    if (records.length === 0) return;

    const totalSessions = records.length;
    const averageScore = Math.round(records.reduce((sum, record) => sum + record.score, 0) / totalSessions);
    // 由于新的数据结构中没有timeSpent，我们设置为0或根据其他逻辑计算
    const totalTimeSpent = 0; // 简化处理，后续可根据需要调整
    const bestScore = Math.max(...records.map(record => record.score));

    setStats({
      totalSessions,
      averageScore,
      totalTimeSpent,
      bestScore
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = async () => {
    if (records.length === 0) {
      alert('没有历史记录可以导出');
      return;
    }

    setIsExporting(true);
    try {
      const blob = await practiceAPI.exportHistory();
      
      // 创建下载链接
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // 生成文件名
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      link.download = `practice_history_${timestamp}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      alert('历史记录导出成功！');
    } catch (error) {
      console.error('导出失败:', error);
      alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      alert('请选择JSON格式的文件');
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const importData: PracticeHistoryExport = JSON.parse(text);
      
      // 验证数据格式
      if (!importData.records || !Array.isArray(importData.records)) {
        throw new Error('无效的数据格式');
      }

      const response = await practiceAPI.importHistory(importData);
      
      if (response.success) {
        // 重新获取历史记录
        const historyResponse = await practiceAPI.getHistory();
        if (historyResponse.success) {
          setRecords(historyResponse.data || []);
          calculateStats(historyResponse.data || []);
        }
        
        alert(response.message || '导入成功！');
      } else {
        throw new Error(response.error || '导入失败');
      }
    } catch (error) {
      console.error('导入失败:', error);
      alert('导入失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsImporting(false);
      // 清空文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">练习历史</h1>
            <p className="text-gray-600">查看您的学习进度和统计数据</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              disabled={isExporting || records.length === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Download size={16} />
              )}
              <span>{isExporting ? '导出中...' : '导出历史'}</span>
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isImporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Upload size={16} />
              )}
              <span>{isImporting ? '导入中...' : '导入历史'}</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有练习记录</h3>
          <p className="text-gray-600 mb-4">开始您的第一次练习吧！</p>
          <Link to="/upload" className="btn-primary">
            开始练习
          </Link>
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="card text-center">
              <div className="bg-blue-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Target className="text-blue-600" size={24} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.totalSessions}</div>
              <div className="text-sm text-gray-600">总练习次数</div>
            </div>
            
            <div className="card text-center">
              <div className="bg-green-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="text-green-600" size={24} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.averageScore}</div>
              <div className="text-sm text-gray-600">平均得分</div>
            </div>
            
            <div className="card text-center">
              <div className="bg-purple-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="text-purple-600" size={24} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{stats.bestScore}</div>
              <div className="text-sm text-gray-600">最高得分</div>
            </div>
            
            <div className="card text-center">
              <div className="bg-orange-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="text-orange-600" size={24} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{Math.round(stats.totalTimeSpent / 60)}</div>
              <div className="text-sm text-gray-600">总练习时间(分钟)</div>
            </div>
          </div>

          {/* 练习记录列表 */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">最近练习</h2>
            <div className="space-y-4">
              {records.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900 mb-1">
                      {record.text_title || '未命名文本'}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{formatDate(record.timestamp)}</span>
                      <span>•</span>
                      <span>字数: {record.text_content.split(' ').length}词</span>
                      <span>•</span>
                      <span>评价: {record.ai_evaluation.is_acceptable ? '通过' : '需改进'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(record.score)}`}>
                      {record.score}分
                    </div>
                    <button
                      onClick={() => {
                        // 显示详细信息的模态框或跳转到详情页
                        alert(`文章：${record.text_title}\n\n英文原文：${record.text_content.substring(0, 100)}...\n\n您的回译：${record.user_input.substring(0, 100)}...\n\nAI评价：${record.ai_evaluation.overall_feedback}`);
                      }}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      查看详情
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 学习建议 */}
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">学习建议</h3>
              <div className="space-y-3 text-sm text-gray-600">
                {stats.averageScore < 60 && (
                  <div className="flex items-start space-x-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full mt-2"></span>
                    <p>建议多练习基础语法，关注句子结构</p>
                  </div>
                )}
                {stats.averageScore >= 60 && stats.averageScore < 80 && (
                  <div className="flex items-start space-x-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></span>
                    <p>继续保持练习频率，注意词汇搭配的准确性</p>
                  </div>
                )}
                {stats.averageScore >= 80 && (
                  <div className="flex items-start space-x-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full mt-2"></span>
                    <p>表现优秀！可以尝试更有挑战性的文本</p>
                  </div>
                )}
                <div className="flex items-start space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                  <p>建议每天练习15-30分钟，保持学习连续性</p>
                </div>
              </div>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">下一步</h3>
              <div className="space-y-4">
                <Link to="/upload" className="block w-full btn-primary text-center">
                  上传新文本练习
                </Link>
                <Link to="/" className="block w-full btn-secondary text-center">
                  浏览练习材料
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default History;
