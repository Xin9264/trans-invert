import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileText, Award } from 'lucide-react';
import StreamingEssayDisplay from '../components/StreamingEssayDisplay';
import TextHighlighter from '../components/TextHighlighter';
import TypingComponent from '../components/TypingComponent';

interface EssaySession {
  id: string;
  topic: string;
  exam_type: string;
  sample_essay: string;
  chinese_translation: string;
  created_at: string;
  status: string;
}

interface EssayEvaluation {
  overall_score: number;
  detailed_scores: {
    grammar: number;
    vocabulary: number;
    structure: number;
    content: number;
  };
  strengths: string[];
  improvements: string[];
  specific_corrections: Array<{
    original: string;
    suggestion: string;
    reason: string;
  }>;
  overall_feedback: string;
}

const Essay: React.FC = () => {
  const navigate = useNavigate();
  
  // 状态管理
  const [currentMode, setCurrentMode] = useState<'input' | 'generating' | 'study' | 'writing' | 'result'>('input');
  const [topic, setTopic] = useState('');
  const [examType, setExamType] = useState('ielts');
  const [requirements, setRequirements] = useState('');
  const [session, setSession] = useState<EssaySession | null>(null);
  const [evaluation, setEvaluation] = useState<EssayEvaluation | null>(null);
  const [_userEssay, setUserEssay] = useState('');
  
  // 流式响应状态（仅用于生成阶段）
  const [streamProgress, setStreamProgress] = useState(0);
  const [_streamMessage, setStreamMessage] = useState('');
  const [streamContent, setStreamContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  // 考试类型选项
  const examTypes = [
    { value: 'ielts', label: '雅思 IELTS', description: '250+ 词，学术/通用训练' },
    { value: 'toefl', label: '托福 TOEFL', description: '350+ 词，独立写作' },
    { value: 'cet4', label: '大学英语四级', description: '120-150 词' },
    { value: 'cet6', label: '大学英语六级', description: '150-180 词' },
    { value: 'gre', label: 'GRE', description: '400+ 词，分析性写作' }
  ];

  // 生成作文范文
  const handleGenerateEssay = async () => {
    if (!topic.trim()) {
      alert('请输入作文题目');
      return;
    }

    setCurrentMode('generating');
    setIsStreaming(true);
    setStreamProgress(0);
    setStreamMessage('正在生成作文范文...');
    setStreamContent('');

    try {
      // 在开发环境使用相对路径通过Vite代理，生产环境使用绝对路径
      const API_BASE_URL = (import.meta as any).env?.MODE === 'production' 
        ? 'https://trans-invert-production.up.railway.app' 
        : '';
      
      // 从localStorage获取AI配置
      const aiConfig = localStorage.getItem('ai_config');
      const config = aiConfig ? JSON.parse(aiConfig) : null;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (config) {
        headers['x-ai-provider'] = config.provider || 'deepseek';
        headers['x-ai-key'] = config.api_key || '';
        if (config.base_url) headers['x-ai-base-url'] = config.base_url;
        if (config.model) headers['x-ai-model'] = config.model;
      }

      const response = await fetch(`${API_BASE_URL}/api/essays/sessions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: topic.trim(),
          exam_type: examType,
          requirements: requirements.trim() || null
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                setIsStreaming(false);
                setCurrentMode('study');
                return;
              }

              try {
                const parsed = JSON.parse(data);
                
                if (parsed.type === 'progress') {
                  setStreamProgress(parsed.progress || 0);
                  setStreamMessage(parsed.content || '正在生成...');
                  // 只使用当前片段，不使用累积内容
                  setStreamContent(parsed.content || '');
                } else if (parsed.type === 'content') {
                  // 忽略content类型消息，因为我们只需要显示当前片段
                  // 只更新进度，不更新内容
                  setStreamProgress(parsed.progress || 0);
                } else if (parsed.type === 'complete') {
                  setSession(parsed.result);
                  setStreamProgress(100);
                  setStreamMessage('作文范文生成完成！');
                  setIsStreaming(false);
                  setCurrentMode('study');
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                console.warn('解析流式数据失败:', e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('生成作文失败:', error);
      alert(`生成作文失败: ${error.message}`);
      setCurrentMode('input');
    } finally {
      setIsStreaming(false);
    }
  };

  // 开始写作
  const handleStartWriting = () => {
    setCurrentMode('writing');
    setUserEssay('');
  };

  // 流式提交作文评估
  const handleStreamSubmitEssay = async (userInput: string, onProgress: (progress: number) => void) => {
    if (!session) {
      throw new Error('找不到作文会话');
    }

    return new Promise<void>((resolve, reject) => {
      // 直接使用作文评估API进行流式评估
      const submitEssayStream = async () => {
        try {
          // 在开发环境使用相对路径通过Vite代理，生产环境使用绝对路径
          const API_BASE_URL = (import.meta as any).env?.MODE === 'production' 
            ? 'https://trans-invert-production.up.railway.app' 
            : '';
          
          // 从localStorage获取AI配置
          const aiConfig = localStorage.getItem('ai_config');
          const config = aiConfig ? JSON.parse(aiConfig) : null;
          
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          
          if (config) {
            headers['x-ai-provider'] = config.provider || 'deepseek';
            headers['x-ai-key'] = config.api_key || '';
            if (config.base_url) headers['x-ai-base-url'] = config.base_url;
            if (config.model) headers['x-ai-model'] = config.model;
          }

          const response = await fetch(`${API_BASE_URL}/api/essays/sessions/${session.id}/submit`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              session_id: session.id,
              user_essay: userInput.trim()
            })
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    setCurrentMode('result');
                    resolve();
                    return;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    
                    if (parsed.type === 'progress') {
                      onProgress(parsed.progress || 0);
                    } else if (parsed.type === 'complete') {
                      setEvaluation(parsed.result);
                      onProgress(100);
                      setCurrentMode('result');
                      resolve();
                      return;
                    } else if (parsed.type === 'error') {
                      throw new Error(parsed.error);
                    }
                  } catch (e) {
                    console.warn('解析流式数据失败:', e);
                  }
                }
              }
            }
          }
        } catch (error: any) {
          console.error('评估作文失败:', error);
          reject(new Error(`评估作文失败: ${error.message}`));
        }
      };

      submitEssayStream();
    });
  };

  // 重新开始
  const handleRestart = () => {
    setCurrentMode('input');
    setTopic('');
    setRequirements('');
    setSession(null);
    setUserEssay('');
    setEvaluation(null);
    setStreamProgress(0);
    setStreamMessage('');
    setStreamContent('');
  };

  // 获取考试类型的分数范围
  const getScoreRange = (examType: string) => {
    const ranges: Record<string, { max: number, good: number, fair: number }> = {
      'ielts': { max: 9, good: 7, fair: 5.5 },
      'toefl': { max: 30, good: 24, fair: 18 },
      'cet4': { max: 100, good: 80, fair: 60 },
      'cet6': { max: 100, good: 80, fair: 60 },
      'gre': { max: 6, good: 4.5, fair: 3 }
    };
    return ranges[examType] || { max: 100, good: 80, fair: 60 };
  };

  // 获取分数颜色（根据考试类型调整）
  const getScoreColor = (score: number, examType: string = session?.exam_type || 'ielts') => {
    const range = getScoreRange(examType);
    if (score >= range.good) return 'text-green-600';
    if (score >= range.fair) return 'text-yellow-600';
    return 'text-red-600';
  };

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
            <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
              <FileText size={24} className="text-purple-600" />
              <span>作文专项练习</span>
            </h1>
            <p className="text-gray-600">
              根据考试类型生成范文，练习写作技巧
            </p>
          </div>
        </div>
        
        {(currentMode === 'study' || currentMode === 'writing' || currentMode === 'result') && (
          <button
            onClick={handleRestart}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            重新开始
          </button>
        )}
      </div>

      {/* 输入阶段 */}
      {currentMode === 'input' && (
        <div className="max-w-2xl mx-auto">
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">设置作文题目</h2>
            
            <div className="space-y-6">
              {/* 题目输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  作文题目 *
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="例如：Some people think that success is only measured by wealth. Do you agree or disagree?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              {/* 考试类型选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  考试类型 *
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {examTypes.map((type) => (
                    <label
                      key={type.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                        examType === type.value
                          ? 'bg-purple-50 border-purple-500'
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        value={type.value}
                        checked={examType === type.value}
                        onChange={(e) => setExamType(e.target.value)}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium text-gray-900">{type.label}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* 额外要求 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  额外要求（可选）
                </label>
                <textarea
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  placeholder="例如：请重点关注环境保护主题，使用更多学术词汇"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={2}
                />
              </div>

              {/* 生成按钮 */}
              <button
                onClick={handleGenerateEssay}
                disabled={!topic.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
              >
                生成作文范文
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 生成中 */}
      {currentMode === 'generating' && (
        <div className="max-w-4xl mx-auto">
          <StreamingEssayDisplay
            isStreaming={isStreaming}
            streamingContent={streamContent}
            progress={streamProgress}
            onComplete={() => {
              // 生成完成后的处理逻辑会在handleGenerateEssay的stream处理中完成
            }}
          />
        </div>
      )}

      {/* 学习阶段 */}
      {currentMode === 'study' && session && (
        <div className="grid lg:grid-cols-5 gap-8">
          {/* 左侧：中文翻译和题目 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 作文题目 */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                <BookOpen size={20} className="text-purple-600" />
                <span>作文题目</span>
              </h2>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-purple-900 font-medium">{session.topic}</p>
                <p className="text-purple-700 text-sm mt-2">
                  考试类型：{examTypes.find(t => t.value === session.exam_type)?.label}
                </p>
              </div>
            </div>

            {/* 中文翻译 */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">中文思路</h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                  {session.chinese_translation}
                </p>
              </div>
            </div>
          </div>

          {/* 右侧：英文范文和开始按钮 */}
          <div className="lg:col-span-3 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">英文范文</h2>
              <div className="mb-6">
                <div className="w-full max-w-none prose prose-lg prose-gray leading-relaxed">
                  <TextHighlighter 
                    text={session.sample_essay}
                    highlights={[]}
                    onHighlightChange={() => {}}
                    className="mb-4 text-base leading-loose whitespace-pre-wrap"
                  />
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-gray-600 mb-4">
                  📖 请仔细阅读上面的英文范文和左侧的中文思路，理解文章的结构和表达方式。你可以选中文本并添加高亮标记重点内容。
                </p>
                <button
                  onClick={handleStartWriting}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <FileText size={20} />
                  <span>开始写作</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 写作阶段 */}
      {currentMode === 'writing' && session && (
        <div className="grid lg:grid-cols-5 gap-8">
          {/* 左侧：题目和中文思路 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 作文题目 */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">作文题目</h2>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-purple-900 font-medium">{session.topic}</p>
                <p className="text-purple-700 text-sm mt-2">
                  考试类型：{examTypes.find(t => t.value === session.exam_type)?.label}
                </p>
              </div>
            </div>

            {/* 中文思路 */}
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">中文思路</h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">
                  {session.chinese_translation}
                </p>
              </div>
            </div>

            {/* 写作提示 */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">写作提示</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>📝 根据考试要求，注意作文长度和结构</p>
                <p>🎯 表达清晰的观点，使用恰当的论证</p>
                <p>📚 运用丰富的词汇和多样的句式</p>
                <p>🔍 注意语法准确性和拼写正确性</p>
              </div>
            </div>
          </div>

          {/* 右侧：写作区域 */}
          <div className="lg:col-span-3 space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">回译练习</h2>
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <p className="text-blue-800 text-sm">
                  💡 现在请根据左侧的中文思路，尝试写出对应的英文表达。重点是语法正确、逻辑清楚。
                </p>
              </div>
              <div className="w-full max-w-none prose prose-lg prose-gray leading-relaxed">
                <TypingComponent
                  targetText={session.sample_essay}
                  onComplete={() => {}}
                  onSubmit={handleStreamSubmitEssay}
                  showTargetText={false}
                  className="text-base leading-loose"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 结果阶段 */}
      {currentMode === 'result' && evaluation && session && (
        <div className="space-y-8">
          {/* 评分结果 */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center space-x-2">
              <Award size={24} className="text-purple-600" />
              <span>评估结果</span>
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* 总分 */}
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold mb-2">
                  <span className={getScoreColor(evaluation.overall_score, session.exam_type)}>
                    {evaluation.overall_score}
                  </span>
                  <span className="text-gray-500 text-lg">/{getScoreRange(session.exam_type).max}</span>
                </div>
                <p className="text-gray-600">总分</p>
              </div>

              {/* 分项得分 */}
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">分项得分</h4>
                {Object.entries(evaluation.detailed_scores).map(([key, score]) => {
                  const labels: Record<string, string> = {
                    grammar: '语法',
                    vocabulary: '词汇',
                    structure: '结构',
                    content: '内容'
                  };
                  return (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-gray-600">{labels[key]}</span>
                      <span className={`font-medium ${getScoreColor(score, session.exam_type)}`}>
                        {score}/{getScoreRange(session.exam_type).max}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 详细反馈 */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* 优点和改进建议 */}
            <div className="space-y-6">
              {/* 优点 */}
              {evaluation.strengths.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-green-900 mb-4">✅ 优点</h3>
                  <ul className="space-y-2">
                    {evaluation.strengths.map((strength, index) => (
                      <li key={index} className="text-green-800 text-sm flex items-start space-x-2">
                        <span className="text-green-600 mt-1">•</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 改进建议 */}
              {evaluation.improvements.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-yellow-900 mb-4">📈 改进建议</h3>
                  <ul className="space-y-2">
                    {evaluation.improvements.map((improvement, index) => (
                      <li key={index} className="text-yellow-800 text-sm flex items-start space-x-2">
                        <span className="text-yellow-600 mt-1">•</span>
                        <span>{improvement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 具体修改建议 */}
            <div className="space-y-6">
              {evaluation.specific_corrections.length > 0 && (
                <div className="card">
                  <h3 className="text-lg font-semibold text-red-900 mb-4">🔧 具体修改建议</h3>
                  <div className="space-y-4">
                    {evaluation.specific_corrections.map((correction, index) => (
                      <div key={index} className="border-l-4 border-red-300 pl-4">
                        <div className="flex items-center space-x-2 text-sm mb-1">
                          <span className="bg-red-100 text-red-700 px-2 py-1 rounded english-text">
                            {correction.original}
                          </span>
                          <span className="text-gray-500">→</span>
                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded english-text">
                            {correction.suggestion}
                          </span>
                        </div>
                        <p className="text-gray-600 text-sm">{correction.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 整体评价 */}
              <div className="card">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">📝 整体评价</h3>
                <p className="text-blue-800 text-sm leading-relaxed">
                  {evaluation.overall_feedback}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Essay;