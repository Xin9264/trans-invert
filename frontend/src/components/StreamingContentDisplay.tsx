import React from 'react';

interface StreamingContentDisplayProps {
  content: string;
  isStreaming: boolean;
  progress: number;
  title?: string;
}

const StreamingContentDisplay: React.FC<StreamingContentDisplayProps> = ({
  content,
  isStreaming,
  progress,
  title = "AI正在生成内容..."
}) => {
  return (
    <div className="relative max-w-4xl mx-auto">
      {/* 背景高斯模糊层 */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 via-blue-50 to-indigo-100 rounded-2xl blur-sm opacity-80"></div>
      
      {/* 主内容区域 */}
      <div className="relative bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 p-8">
        {/* 标题区域 */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-800 flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span>{title}</span>
          </h3>
          
          {/* 进度指示器 */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>{progress}%</span>
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              >
                {isStreaming && (
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-50 animate-pulse"></div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* 内容展示区域 */}
        <div className="relative min-h-[100px] max-h-[170px] overflow-hidden">
          {/* 内容滚动容器 */}
          <div className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
            <div className="prose prose-gray max-w-none">
              {content ? (
                <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                  {content}
                  {/* 光标动画 */}
                  {isStreaming && (
                    <span className="inline-block w-0.5 h-5 bg-purple-500 ml-1 animate-pulse"></span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    {/* 旋转动画图标 */}
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mb-4">
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-gray-500">等待AI开始生成内容...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* 渐变遮罩效果 */}
          {isStreaming && content && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white/90 to-transparent pointer-events-none"></div>
          )}
        </div>
        
        {/* 底部装饰 */}
        <div className="mt-6 flex justify-center">
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  isStreaming 
                    ? 'bg-purple-500 animate-bounce' 
                    : 'bg-gray-300'
                }`}
                style={{
                  animationDelay: isStreaming ? `${i * 200}ms` : '0ms'
                }}
              ></div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 外围光效 */}
      {isStreaming && (
        <div className="absolute inset-0 rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-400 via-blue-400 to-indigo-400 rounded-2xl opacity-20 animate-pulse blur-lg"></div>
        </div>
      )}
    </div>
  );
};

export default StreamingContentDisplay;