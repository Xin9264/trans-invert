import React from 'react';

interface StreamingProgressProps {
  progress: number;
  message: string;
  isStreaming: boolean;
  onCancel?: () => void;
}

const StreamingProgress: React.FC<StreamingProgressProps> = ({
  progress,
  message,
  isStreaming,
  onCancel
}) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-blue-900">
          {isStreaming ? '正在处理中...' : '处理完成'}
        </h3>
        {onCancel && isStreaming && (
          <button
            onClick={onCancel}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            取消
          </button>
        )}
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between text-sm text-blue-700">
          <span>{message}</span>
          <span>{progress}%</span>
        </div>
        
        <div className="w-full bg-blue-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          >
            {isStreaming && (
              <div className="h-full w-full bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
            )}
          </div>
        </div>
        
        {isStreaming && (
          <div className="flex justify-center">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamingProgress;