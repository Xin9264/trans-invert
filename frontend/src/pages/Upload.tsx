import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { textAPI } from '../utils/api';
import { Upload as UploadIcon, FileText } from 'lucide-react';

const Upload: React.FC = () => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [practiceType, setPracticeType] = useState<'translation' | 'essay'>('translation');
  const [topic, setTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('请输入英文文本内容');
      return;
    }

    if (practiceType === 'essay' && !topic.trim()) {
      setError('作文类型需要填写题目');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await textAPI.upload({
        content: content.trim(),
        title: title.trim() || undefined,
        practice_type: practiceType,
        topic: practiceType === 'essay' ? topic.trim() : undefined
      });
      if (response.success && response.data) {
        navigate(`/practice/${response.data.text_id}`);
      } else {
        setError(response.message || response.error || '上传失败');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || error.message || '上传失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setContent(text);
        setTitle(file.name.replace('.txt', ''));
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">上传练习文本</h1>
        <p className="text-gray-600 mb-8">
          上传一段英文文本，AI将自动分析并生成中文翻译供您练习
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* 上传表单 */}
          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="practiceType" className="block text-sm font-medium text-gray-700 mb-2">
                  练习类型 *
                </label>
                <select
                  id="practiceType"
                  value={practiceType}
                  onChange={(e) => setPracticeType(e.target.value as 'translation' | 'essay')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="translation">回译练习</option>
                  <option value="essay">作文练习</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  {practiceType === 'translation' 
                    ? '上传英文文本，练习中译英' 
                    : '上传作文范文和题目，学习写作技巧'
                  }
                </p>
              </div>

              {practiceType === 'essay' && (
                <div className="mb-6">
                  <label htmlFor="topic" className="block text-sm font-medium text-gray-700 mb-2">
                    作文题目 *
                  </label>
                  <textarea
                    id="topic"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="请输入作文的原题目，例如：Some people think that success is only measured by wealth. Do you agree or disagree?"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    输入完整的作文题目，这将帮助您更好地理解范文的写作思路
                  </p>
                </div>
              )}

              <div className="mb-6">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  文本标题 (可选)
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={practiceType === 'essay' ? "为这篇作文范文起个名字" : "为您的练习文本起个名字"}
                />
              </div>

              <div className="mb-6">
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                  {practiceType === 'essay' ? '作文范文 *' : '英文文本 *'}
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent english-text"
                  placeholder={practiceType === 'essay' 
                    ? "粘贴或输入优秀的英文作文范文..."
                    : "粘贴或输入您想要练习的英文文本..."
                  }
                  required
                />
                <div className="mt-2 text-sm text-gray-500">
                  字符数: {content.length} | 单词数: {content.trim().split(/\s+/).filter(word => word).length}
                </div>
              </div>

              {/* 文件上传 */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  或上传文本文件
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileText className="w-8 h-8 mb-2 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">点击上传</span> 或拖拽文件
                      </p>
                      <p className="text-xs text-gray-500">仅支持 TXT 文件</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !content.trim()}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>分析中...</span>
                  </>
                ) : (
                  <>
                    <UploadIcon size={18} />
                    <span>上传并开始练习</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* 使用指南 */}
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">使用指南</h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">选择文本</p>
                    <p>上传您想要练习的英文文本，建议长度在100-500词之间</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">AI分析</p>
                    <p>系统将自动分析语法结构并生成准确的中文翻译</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">开始练习</p>
                    <p>看着中文翻译，尝试写出对应的英文表达</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-semibold">
                    4
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">获得反馈</p>
                    <p>AI将评估您的答案并提供改进建议</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">文本建议</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 选择您感兴趣的主题，提高学习动力</li>
                <li>• 难度适中，避免过于复杂的专业术语</li>
                <li>• 语法结构清晰，句式多样化</li>
                <li>• 长度适中，建议100-500词</li>
                <li>• 内容完整，避免片段化文本</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Upload;
