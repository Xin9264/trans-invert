import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { textAPI, TextUploadStreamEvent } from '../utils/api';
import { Upload as UploadIcon, FileText } from 'lucide-react';

const Upload: React.FC = () => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [thinkingContent, setThinkingContent] = useState('');
  const [analysisPreview, setAnalysisPreview] = useState<TextUploadStreamEvent['analysis'] | null>(null);
  const [createdTextId, setCreatedTextId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [thinkingContent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('请输入英文文本内容');
      return;
    }

    setIsLoading(true);
    setIsStreaming(true);
    setError(null);
    setUploadProgress(5);
    setThinkingContent('🚀 已收到文本，正在启动AI分析…\n');
    setAnalysisPreview(null);
    setCreatedTextId(null);

    await textAPI.uploadStream(
      {
        content: content.trim(),
        title: title.trim() || undefined
      },
      (event) => {
        if (event.type === 'init') {
          if (event.text_id) {
            setCreatedTextId(event.text_id);
          }
          if (event.progress !== undefined) {
            setUploadProgress(event.progress);
          }
          if (event.message) {
            setThinkingContent(prev => `${prev}${event.message}\n`);
          }
          if (event.word_count) {
            setThinkingContent(prev => `${prev}字数统计：约 ${event.word_count} 词\n`);
          }
        } else if (event.type === 'progress') {
          if (event.progress !== undefined) {
            setUploadProgress(prev => Math.min(98, Math.max(event.progress ?? prev, prev)));
          }
          if (event.message) {
            setThinkingContent(prev => `${prev}${event.message}\n`);
          }
          if (event.content) {
            setThinkingContent(prev => `${prev}${event.content}`);
          }
        } else if (event.type === 'complete') {
          setUploadProgress(100);
          if (event.analysis) {
            setAnalysisPreview(event.analysis);
          }
          const finalId = event.analysis?.text_id || event.text_id || createdTextId;
          if (finalId) {
            setCreatedTextId(finalId);
            setThinkingContent(prev => `${prev}\n✅ 分析完成，正在跳转练习页面…\n`);
            setTimeout(() => navigate(`/practice/${finalId}`), 1200);
          } else {
            setThinkingContent(prev => `${prev}\n⚠️ 分析完成，但未获取文本ID，请稍后在列表中查看。\n`);
          }
        } else if (event.type === 'error') {
          setError(event.error || 'AI分析失败，请稍后重试');
          setThinkingContent(prev => `${prev}\n❌ ${event.error || 'AI分析失败'}\n`);
          setIsStreaming(false);
          setIsLoading(false);
        }
      },
      (errorMessage) => {
        setError(errorMessage);
        setThinkingContent(prev => `${prev}\n❌ ${errorMessage}\n`);
        setIsStreaming(false);
        setIsLoading(false);
      }
    );

    setIsStreaming(false);
    setIsLoading(false);
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
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  文本标题 (可选)
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="为您的练习文本起个名字"
                />
              </div>

              <div className="mb-6">
                <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                  英文文本 *
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent english-text"
                  placeholder="粘贴或输入您想要练习的英文文本..."
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
                disabled={isLoading || isStreaming || !content.trim()}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {isStreaming ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>AI分析中… {Math.min(100, Math.round(uploadProgress))}%</span>
                  </>
                ) : isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>准备中...</span>
                  </>
                ) : (
                  <>
                    <UploadIcon size={18} />
                    <span>上传并开始练习</span>
                  </>
                )}
              </button>

              {(isStreaming || analysisPreview || thinkingContent) && (
                <div className="mt-6 space-y-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary-500 h-2 transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(uploadProgress, 0))}%` }}
                    ></div>
                  </div>

                  <div
                    ref={thinkingRef}
                    className="bg-gray-900 text-green-300 font-mono text-xs sm:text-sm p-4 rounded-lg h-48 overflow-y-auto shadow-inner"
                  >
                    {thinkingContent.trim().length > 0 ? thinkingContent : 'AI正在思考，请稍候…'}
                  </div>

                  {analysisPreview && (
                    <div className="bg-white border border-primary-100 rounded-lg p-4 shadow-sm">
                      <h4 className="text-sm font-semibold text-primary-600 mb-2">
                        初步分析摘要
                      </h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        <p className="whitespace-pre-wrap">{analysisPreview.translation}</p>
                        <div className="text-xs text-gray-500 flex items-center justify-between">
                          <span>难度：{analysisPreview.difficulty}</span>
                          <span>预计单词数：{analysisPreview.word_count}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
