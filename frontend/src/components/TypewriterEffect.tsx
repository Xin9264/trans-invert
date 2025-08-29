import React, { useState, useEffect, useRef } from 'react';

interface TypewriterEffectProps {
  text: string;
  speed?: number; // 字符显示间隔 (毫秒)
  onComplete?: () => void;
  className?: string;
  showCursor?: boolean;
}

const TypewriterEffect: React.FC<TypewriterEffectProps> = ({
  text,
  speed = 30,
  onComplete,
  className = '',
  showCursor = true
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 重置状态
    setDisplayedText('');
    setCurrentIndex(0);
    setIsCompleted(false);

    if (!text) return;

    // 开始打字机效果
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        
        if (nextIndex <= text.length) {
          setDisplayedText(text.slice(0, nextIndex));
        }
        
        if (nextIndex >= text.length) {
          setIsCompleted(true);
          onComplete?.();
          return prevIndex; // 停止更新
        }
        
        return nextIndex;
      });
    }, speed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, speed, onComplete]);

  useEffect(() => {
    if (isCompleted && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isCompleted]);

  return (
    <div className={`font-mono ${className}`}>
      <span>{displayedText}</span>
      {showCursor && (
        <span 
          className={`inline-block w-2 h-5 bg-gray-600 ml-1 ${
            isCompleted ? 'opacity-0' : 'animate-pulse'
          }`}
        >
          |
        </span>
      )}
    </div>
  );
};

export default TypewriterEffect;