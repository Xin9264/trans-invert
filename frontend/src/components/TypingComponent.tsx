import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store';

interface TypingComponentProps {
  targetText: string;
  onComplete: (userInput: string, stats: TypingStats) => void;
  onSubmit?: (userInput: string, onProgress: (progress: number) => void) => Promise<void>;
  className?: string;
  showTargetText?: boolean; // 新增：控制是否显示目标文本
}

interface TypingStats {
  wpm: number;
  timeSpent: number;
  wordCount: number;
}

const TypingComponent: React.FC<TypingComponentProps> = ({
  targetText,
  onComplete,
  onSubmit,
  className = '',
  showTargetText = true // 默认显示目标文本，向后兼容
}) => {
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 调整文本框高度的函数
  const adjustTextareaHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, []);

  // 开始计时
  useEffect(() => {
    if (!startTime && userInput.length > 0) {
      setStartTime(new Date());
    }
  }, [userInput, startTime]);

  // 初始化和内容变化时调整高度
  useEffect(() => {
    adjustTextareaHeight();
  }, [userInput, adjustTextareaHeight]);

  // 处理输入
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setUserInput(value);
  }, []);

  // 处理提交
  const handleSubmit = useCallback(async () => {
    if (!userInput.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    setProgress(0);
    
    try {
      if (onSubmit) {
        // 使用自定义提交函数（流式）
        await onSubmit(userInput, (progressValue: number) => {
          setProgress(progressValue);
        });
      } else {
        // 默认提交行为
        const endTime = new Date();
        const timeSpent = startTime ? (endTime.getTime() - startTime.getTime()) / 1000 : 0;
        const wordCount = userInput.trim().split(/\s+/).length;
        const wpm = timeSpent > 0 ? Math.round((wordCount / timeSpent) * 60) : 0;

        const stats: TypingStats = {
          wpm,
          timeSpent,
          wordCount
        };

        // 模拟进度
        for (let i = 0; i <= 100; i += 20) {
          setProgress(i);
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        onComplete(userInput, stats);
      }
    } catch (error) {
      console.error('提交失败:', error);
    } finally {
      setIsSubmitting(false);
      setProgress(0);
    }
  }, [userInput, startTime, onComplete, onSubmit, isSubmitting]);



  return (
    <div className={`typing-container ${className}`}>
      {/* 统计信息 */}
      <div className="flex justify-between items-center mb-4 p-4 bg-gray-100 rounded-lg">
        <div className="text-sm text-gray-600">
          字符数: {userInput.length}
        </div>
        <div className="text-sm text-gray-600">
          单词数: {userInput.trim() ? userInput.trim().split(/\s+/).length : 0}
        </div>
        {startTime && (
          <div className="text-sm text-gray-600">
            用时: {Math.round((Date.now() - startTime.getTime()) / 1000)}秒
          </div>
        )}
      </div>

      {/* 文本显示区域 - 只在showTargetText为true时显示 */}
      {showTargetText && (
        <div className="relative mb-4">
          <div className="p-6 bg-white rounded-lg border-2 border-gray-200 font-mono text-lg leading-relaxed min-h-[200px]">
            {targetText}
          </div>
        </div>
      )}

      {/* 输入区域 */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={userInput}
          onChange={handleInputChange}
          placeholder="开始输入英文..."
          className="w-full p-4 border-2 border-gray-300 rounded-lg font-mono text-lg resize-none focus:border-primary-500 focus:outline-none min-h-[120px] max-h-[400px] overflow-y-auto"
          disabled={isSubmitting}
        />
        
        {/* 提交按钮 */}
        <div className="mt-4 space-y-3">
          <div className="flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={!userInput.trim() || isSubmitting}
              className="px-8 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>AI分析中...</span>
                </>
              ) : (
                <span>提交答案</span>
              )}
            </button>
          </div>
          
          {/* 进度条 */}
          {isSubmitting && (
            <div className="max-w-md mx-auto">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>AI评估进度</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                {progress < 25 && "正在分析语法结构..."}
                {progress >= 25 && progress < 50 && "正在检查语义准确性..."}
                {progress >= 50 && progress < 75 && "正在生成改进建议..."}
                {progress >= 75 && progress < 100 && "正在完成评估..."}
                {progress >= 100 && "评估完成！"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 快捷键提示 */}
      <div className="mt-4 text-sm text-gray-500 text-center">
        {showTargetText 
          ? "提示: 专注于语法和语义的准确性，不要求逐字匹配"
          : "提示: 根据左侧中文翻译进行回译，注重语法正确和语义清晰，完成后点击提交"
        }
      </div>
    </div>
  );
};

export default TypingComponent;
