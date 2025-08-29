import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { textAPI, practiceAPI } from '../utils/api';
import { Text, TextAnalysis } from '../types';
import TypingComponent from '../components/TypingComponent';
import TextHighlighter from '../components/TextHighlighter';
import { ArrowLeft, RotateCcw, History } from 'lucide-react';

const Practice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [text, setText] = useState<Text | null>(null);
  const [analysis, setAnalysis] = useState<TextAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [practiceMode, setPracticeMode] = useState<'study' | 'practice' | 'completed'>('study'); // 新增练习模式状态
  const [highlights, setHighlights] = useState<any[]>([]); // 文本高亮数据
  const [showHistoryModal, setShowHistoryModal] = useState(false); // 历史回译模态框
  const [practiceHistory, setPracticeHistory] = useState<any[]>([]); // 练习历史记录
  const [countdown, setCountdown] = useState<number | null>(null); // 倒计时状态

  // 高亮数据的存储键
  const getHighlightStorageKey = (textId: string) => `highlights_${textId}`;

  // 保存高亮数据到localStorage
  const saveHighlights = (textId: string, highlightData: any[]) => {
    try {
      localStorage.setItem(getHighlightStorageKey(textId), JSON.stringify(highlightData));
    } catch (error) {
      console.warn('Failed to save highlights to localStorage:', error);
    }
  };

  // 从localStorage加载高亮数据
  const loadHighlights = (textId: string): any[] => {
    try {
      const saved = localStorage.getItem(getHighlightStorageKey(textId));
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Failed to load highlights from localStorage:', error);
      return [];
    }
  };

  // 处理高亮变化
  const handleHighlightChange = (newHighlights: any[]) => {
    setHighlights(newHighlights);
    if (id) {
      saveHighlights(id, newHighlights);
    }
  };

  // 启动倒计时
  const startCountdown = () => {
    setCountdown(5);
  };

  // 倒计时效果
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown === 0) {
      navigate('/');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      try {
        setIsLoading(true);
        
        // 获取分析结果和原文内容
        const [analysisResponse, textResponse] = await Promise.all([
          textAPI.getAnalysis(id),
          textAPI.getById(id, true) // 获取包含原文的内容
        ]);
        
        if (analysisResponse.success && analysisResponse.data) {
          const analysisData = analysisResponse.data;
          
          // 设置分析结果
          setAnalysis({
            id: analysisData.text_id,
            textId: analysisData.text_id,
            difficultWords: analysisData.difficult_words || [],
            difficulty: analysisData.difficulty,
            translation: analysisData.translation,
            keyPoints: analysisData.key_points,
            createdAt: new Date().toISOString()
          });
          
          // 设置文本信息（包含原文用于练习）
          if (textResponse.success && textResponse.data) {
            const textData = {
              id: analysisData.text_id,
              title: textResponse.data.title || `练习文本`,
              content: textResponse.data.content || '', // 用于TypingComponent
              difficultyLevel: analysisData.difficulty,
              wordCount: analysisData.word_count,
              createdAt: new Date().toISOString(),
              createdBy: '',
              type: textResponse.data.practice_type === 'essay' ? 'essay' as const : 'translation' as const, // 设置类型
              topic: textResponse.data.topic // 保存题目信息
            };
            setText(textData);
          }

          // 加载保存的高亮数据
          const savedHighlights = loadHighlights(id);
          setHighlights(savedHighlights);
        } else {
          const errorMessage = analysisResponse.message || '文本分析尚未完成，请稍后重试';
          setError(errorMessage);
          
          // 如果是分析进行中的消息，启动倒计时
          if (errorMessage.includes('分析正在进行中') || errorMessage.includes('稍安勿躁')) {
            startCountdown();
          }
        }
      } catch (error: any) {
        setError(error.response?.data?.error || error.message || '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // 加载特定文本的练习历史
  const loadPracticeHistory = async () => {
    if (!id) return;
    
    try {
      const response = await practiceAPI.getTextHistory(id);
      if (response.success && response.data) {
        setPracticeHistory(response.data);
      }
    } catch (error) {
      console.error('Failed to load practice history:', error);
    }
  };

  // 显示历史回译模态框
  const handleShowHistory = () => {
    setShowHistoryModal(true);
    loadPracticeHistory();
  };

  const handlePracticeComplete = async (userInput: string) => {
    if (!id) return;
    
    try {
      const response = await practiceAPI.submit({
        text_id: id,
        user_input: userInput
      });
      if (response.success && response.data) {
        setFeedback({
          score: response.data.score,
          aiFeedback: {
            score: response.data.score,
            corrections: response.data.corrections,
            overall: response.data.overall_feedback
          }
        });
        setPracticeMode('completed');
      } else {
        setError(response.message || response.error || '提交失败');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || '提交失败');
    }
  };

  // 流式提交处理函数
  const handleStreamSubmit = async (userInput: string, onProgress: (progress: number) => void) => {
    if (!id) return;
    
    return new Promise<void>((resolve, reject) => {
      practiceAPI.submitStream(
        {
          text_id: id,
          user_input: userInput
        },
        // onProgress
        (progress: number) => {
          onProgress(progress);
        },
        // onComplete
        (result) => {
          setFeedback({
            score: result.score,
            aiFeedback: {
              score: result.score,
              corrections: result.corrections,
              overall: result.overall_feedback
            }
          });
          setPracticeMode('completed');
          resolve();
        },
        // onError
        (error: string) => {
          console.error('流式提交失败:', error);
          setError(error);
          reject(new Error(error));
        }
      );
    });
  };

  const handleStartPractice = () => {
    setPracticeMode('practice');
  };

  const handleRestart = () => {
    setPracticeMode('study');
    setFeedback(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !text || !analysis) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || '文本不存在'}</p>
          
          {/* 倒计时显示 */}
          {countdown !== null && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 mb-2">
                {countdown > 0 
                  ? `${countdown} 秒后自动返回首页...` 
                  : '正在返回首页...'
                }
              </p>
              <div className="w-full bg-yellow-200 rounded-full h-2">
                <div 
                  className="bg-yellow-600 h-2 rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${((5 - countdown) / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
          
          <button 
            onClick={() => {
              setCountdown(null); // 停止倒计时
              navigate('/');
            }} 
            className="btn-primary"
            disabled={countdown === 0}
          >
            {countdown !== null ? '立即返回首页' : '返回首页'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            <span>返回</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {text.title || '练习文本'}
            </h1>
            <p className="text-gray-600">
              难度: {text.difficultyLevel}/5 | {text.wordCount} 词
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 练习完成后显示重新开始按钮 */}
          {practiceMode === 'completed' && (
            <button
              onClick={handleRestart}
              className="flex items-center space-x-2 px-3 py-2 bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors"
            >
              <RotateCcw size={18} />
              <span>重新学习</span>
            </button>
          )}

          {/* 练习模式显示返回学习按钮 */}
          {practiceMode === 'practice' && (
            <button
              onClick={() => setPracticeMode('study')}
              className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft size={18} />
              <span>返回学习</span>
            </button>
          )}

          {/* 历史回译按钮 */}
          <button
            onClick={handleShowHistory}
            className="flex items-center space-x-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 transition-colors"
          >
            <History size={18} />
            <span>历史回译</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* 左侧：中文翻译 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 作文题目显示框 - 仅当类型为作文且有题目时显示 */}
          {text?.type === 'essay' && text?.topic && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <span className="text-purple-600">📝</span>
                <span>作文题目</span>
              </h2>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <p className="text-purple-900 font-medium leading-relaxed">
                  {text.topic}
                </p>
              </div>
            </div>
          )}
          
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {text?.type === 'essay' ? '中文思路' : '中文翻译'}
            </h2>
            <div className="prose prose-gray max-w-none">
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {analysis.translation}
              </p>
            </div>
          </div>

          {/* 难词解释 */}
          {analysis.difficultWords && analysis.difficultWords.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">难词解释</h3>
              <div className="space-y-3">
                {analysis.difficultWords.map((word, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-600 text-white text-xs font-medium rounded-full">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {word.word}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {word.meaning}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* 右侧：练习区域 */}
        <div className="lg:col-span-3 space-y-6">
          {practiceMode === 'study' && (
            // 学习模式：显示原文和开始练习按钮
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">英文原文</h2>
                <div className="mb-6">
                  <div className="w-full max-w-none prose prose-lg prose-gray leading-relaxed">
                    <TextHighlighter 
                      text={text.content}
                      highlights={highlights}
                      onHighlightChange={handleHighlightChange}
                      className="mb-4 text-base leading-loose whitespace-pre-wrap"
                    />
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 mb-4">
                    📖 请仔细阅读上面的英文原文和左侧的中文翻译，理解文本的含义和语法结构。你可以选中文本并添加高亮标记重点内容。
                  </p>
                  <button
                    onClick={handleStartPractice}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>🚀 开始练习</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {practiceMode === 'practice' && (
            // 练习模式：隐藏原文，显示打字练习
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">回译练习</h2>
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800 text-sm">
                  💡 现在请根据左侧的中文翻译，尝试写出对应的英文表达。不要求完全一致，重点是语法正确、语义清楚。
                </p>
              </div>
              <TypingComponent
                targetText={text.content}
                onComplete={handlePracticeComplete}
                onSubmit={handleStreamSubmit}
                showTargetText={false}
              />
            </div>
          )}

          {practiceMode === 'completed' && (
            // 完成模式：显示结果
            <div className="space-y-6">
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">练习结果</h2>
                {feedback && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <span className="font-medium">得分</span>
                      <span className={`text-2xl font-bold ${
                        feedback.score >= 80 ? 'text-green-600' : 
                        feedback.score >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {feedback.score}/100
                      </span>
                    </div>
                    
                    {feedback.aiFeedback?.overall && (
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-blue-900 mb-2">AI 评价</h4>
                        <p className="text-blue-800">{feedback.aiFeedback.overall}</p>
                      </div>
                    )}

                    {feedback.aiFeedback?.corrections && feedback.aiFeedback.corrections.length > 0 && (
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-medium text-yellow-900 mb-3">建议改进</h4>
                        <div className="space-y-2">
                          {feedback.aiFeedback.corrections.map((correction: any, index: number) => (
                            <div key={index} className="text-sm">
                              <div className="flex items-start space-x-2">
                                <span className="text-red-600 font-mono bg-red-100 px-2 py-1 rounded">
                                  {correction.original}
                                </span>
                                <span className="text-gray-500">→</span>
                                <span className="text-green-600 font-mono bg-green-100 px-2 py-1 rounded">
                                  {correction.suggestion}
                                </span>
                              </div>
                              <p className="text-yellow-800 mt-1 ml-2">{correction.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 历史回译模态框 */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-900">历史回译记录</h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {practiceHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">该文本还没有练习历史记录</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {practiceHistory.map((record) => (
                    <div key={record.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div className="text-sm text-gray-600">
                          练习时间: {new Date(record.timestamp).toLocaleString('zh-CN')}
                        </div>
                        <div className={`px-2 py-1 rounded text-sm font-medium ${
                          record.score >= 80 ? 'bg-green-100 text-green-700' : 
                          record.score >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {record.score}分
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-1">您的回译：</h4>
                          <p className="text-gray-700 bg-white p-3 rounded border">
                            {record.user_input}
                          </p>
                        </div>
                        
                        {record.ai_evaluation.overall_feedback && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-1">AI评价：</h4>
                            <p className="text-gray-700 bg-blue-50 p-3 rounded border">
                              {record.ai_evaluation.overall_feedback}
                            </p>
                          </div>
                        )}
                        
                        {record.ai_evaluation.corrections && record.ai_evaluation.corrections.length > 0 && (
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">建议改进：</h4>
                            <div className="space-y-2">
                              {record.ai_evaluation.corrections.map((correction: any, corrIndex: number) => (
                                <div key={corrIndex} className="bg-yellow-50 p-2 rounded border">
                                  <div className="flex items-center space-x-2 text-sm">
                                    <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-mono">
                                      {correction.original}
                                    </span>
                                    <span>→</span>
                                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-mono">
                                      {correction.suggestion}
                                    </span>
                                  </div>
                                  <p className="text-gray-600 text-sm mt-1">{correction.reason}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Practice;
