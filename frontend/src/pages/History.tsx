import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { practiceAPI } from '../utils/api';
import { Calendar, TrendingUp, Target, Clock } from 'lucide-react';

interface PracticeRecord {
  id: string;
  textTitle: string;
  score: number;
  completedAt: string;
  textId: string;
  stats: {
    wpm: number;
    accuracy: number;
    timeSpent: number;
  };
}

const History: React.FC = () => {
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
          setRecords(response.data);
          calculateStats(response.data);
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
    const totalTimeSpent = Math.round(records.reduce((sum, record) => sum + (record.stats?.timeSpent || 0), 0));
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">练习历史</h1>
        <p className="text-gray-600">查看您的学习进度和统计数据</p>
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
                      {record.textTitle || '未命名文本'}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>{formatDate(record.completedAt)}</span>
                      {record.stats && (
                        <>
                          <span>•</span>
                          <span>用时: {Math.round(record.stats.timeSpent)}秒</span>
                          <span>•</span>
                          <span>准确率: {record.stats.accuracy}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(record.score)}`}>
                      {record.score}分
                    </div>
                    <Link
                      to={`/practice/${record.textId}`}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      重新练习
                    </Link>
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
