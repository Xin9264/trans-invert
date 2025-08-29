import React, { useState, useEffect } from 'react';
import TypewriterEffect from './TypewriterEffect';

interface StreamingEssayDisplayProps {
  isStreaming: boolean;
  streamingContent: string;
  progress: number;
  error?: string;
  onComplete?: () => void;
  className?: string;
}

const StreamingEssayDisplay: React.FC<StreamingEssayDisplayProps> = ({
  isStreaming,
  streamingContent,
  progress,
  error,
  onComplete,
  className = ''
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [tempText, setTempText] = useState(''); // 用于存储当前流式输出片段
  const [isAnimating, setIsAnimating] = useState(false); // 控制动画状态
  
  // 模拟思考步骤
  const thinkingSteps = [
    "正在分析作文题目...",
    "构思文章结构和观点...", 
    "生成英文范文...",
    "准备中文翻译...",
    "完善作文内容..."
  ];

  useEffect(() => {
    if (!isStreaming) {
      // 重置状态
      setCurrentStep(0);
      setCompletedSteps([]);
      setTempText('');
      setIsAnimating(false);
      return;
    }

    // 根据进度决定当前步骤
    const stepProgress = Math.floor((progress / 100) * thinkingSteps.length);
    const newStep = Math.min(stepProgress, thinkingSteps.length - 1);
    
    if (newStep > currentStep) {
      // 进入新步骤，将前一步骤标记为完成
      if (currentStep < thinkingSteps.length) {
        setCompletedSteps(prev => [...prev, thinkingSteps[currentStep]]);
      }
      setCurrentStep(newStep);
      setTempText(''); // 清空temp_text，准备接收新步骤的内容
    }

    // 更新temp_text - 使用动画效果
    if (streamingContent && streamingContent !== tempText) {
      if (tempText) {
        // 如果已有内容，启动动画
        setIsAnimating(true);
        
        // 短暂延迟后更新内容
        setTimeout(() => {
          setTempText(streamingContent);
          // 动画完成后清理
          setTimeout(() => {
            setIsAnimating(false);
          }, 300);
        }, 50);
      } else {
        // 第一次设置内容，不需要动画
        setTempText(streamingContent);
      }
    }
  }, [isStreaming, progress, streamingContent, currentStep]);

  useEffect(() => {
    if (progress >= 100 && isStreaming) {
      // 完成所有步骤
      setTimeout(() => {
        onComplete?.();
      }, 1000);
    }
  }, [progress, isStreaming, onComplete]);

  if (error) {
    return (
      <div className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-red-600">
          <span>❌</span>
          <span className="font-medium">生成失败</span>
        </div>
        <p className="text-red-700 mt-2">{error}</p>
      </div>
    );
  }

  if (!isStreaming) {
    return null;
  }

  return (
    <div className={`p-6 bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg ${className}`}>
      {/* 标题 */}
      <div className="flex items-center space-x-2 mb-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        <h3 className="text-lg font-semibold text-gray-900">AI正在思考中...</h3>
      </div>

      {/* 进度条 */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>生成进度</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* 思考步骤 */}
      <div className="space-y-3">
        {/* 已完成的步骤 */}
        {completedSteps.map((step, index) => (
          <div key={index} className="flex items-center space-x-3">
            <span className="text-green-500">✅</span>
            <span className="text-gray-700">{step}</span>
          </div>
        ))}

        {/* 当前进行的步骤 */}
        {currentStep < thinkingSteps.length && (
          <div className="flex items-start space-x-3">
            <div className="animate-pulse text-blue-500 mt-1">🤔</div>
            <div className="flex-1">
              <TypewriterEffect
                text={thinkingSteps[currentStep]}
                speed={50}
                showCursor={true}
                className="text-gray-900 font-medium"
              />
              
              {/* 显示实际的AI生成内容 - 使用固定高度的文本框和淡入淡出动画 */}
              <div className="mt-3 p-3 bg-white/60 rounded-lg border border-blue-100 h-[40px] overflow-hidden relative">
                <div className={`text-gray-800 text-sm leading-relaxed whitespace-pre-wrap h-full transition-all duration-500 ease-in-out ${
                  isAnimating ? 'opacity-50 transform scale-95' : 'opacity-100 transform scale-100'
                }`}>
                  {tempText || '等待AI输出...'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div className="mt-6 pt-4 border-t border-blue-200">
        <p className="text-sm text-gray-600 flex items-center space-x-2">
          <span>💡</span>
          <span>AI正在精心为您生成高质量的作文范文，请稍候...</span>
        </p>
      </div>
    </div>
  );
};

export default StreamingEssayDisplay;