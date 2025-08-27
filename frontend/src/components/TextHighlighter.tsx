import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface HighlightData {
  id: string;
  start: number;
  end: number;
  color: string;
  text: string;
}

interface TextHighlighterProps {
  text: string;
  highlights?: HighlightData[];
  onHighlightChange?: (highlights: HighlightData[]) => void;
  className?: string;
}

const HIGHLIGHT_COLORS = [
  { name: '红色', value: '#E57373', label: '柔和的浅红' },
  { name: '黄色', value: '#FFF176', label: '温柔的浅黄' },
  { name: '绿色', value: '#81C784', label: '清新的草绿' },
  { name: '紫色', value: '#BA68C8', label: '淡雅的薰衣草紫' },
];

const TextHighlighter: React.FC<TextHighlighterProps> = ({
  text,
  highlights = [],
  onHighlightChange,
  className = ''
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number; text: string } | null>(null);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const [activeHighlights, setActiveHighlights] = useState<HighlightData[]>(highlights);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveHighlights(highlights);
  }, [highlights]);

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = selection.toString().trim();
    
    if (selectedText.length === 0) {
      setShowColorPicker(false);
      return;
    }

    // 计算选中文本在整个文本中的位置
    const textElement = textRef.current;
    if (!textElement) return;

    const beforeRange = document.createRange();
    beforeRange.setStart(textElement, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = beforeRange.toString().length;
    const endOffset = startOffset + selectedText.length;

    // 检查是否点击了已高亮的文本
    const clickedHighlight = activeHighlights.find(h => 
      startOffset >= h.start && endOffset <= h.end
    );

    if (clickedHighlight) {
      // 显示取消高亮选项
      const rect = range.getBoundingClientRect();
      setColorPickerPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setSelectedRange({ start: clickedHighlight.start, end: clickedHighlight.end, text: clickedHighlight.text });
      setShowColorPicker(true);
    } else {
      // 显示颜色选择器
      const rect = range.getBoundingClientRect();
      setColorPickerPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setSelectedRange({ start: startOffset, end: endOffset, text: selectedText });
      setShowColorPicker(true);
    }
  };

  const addHighlight = (color: string) => {
    if (!selectedRange) return;

    const newHighlight: HighlightData = {
      id: `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      start: selectedRange.start,
      end: selectedRange.end,
      color,
      text: selectedRange.text
    };

    const updatedHighlights = [...activeHighlights, newHighlight];
    setActiveHighlights(updatedHighlights);
    onHighlightChange?.(updatedHighlights);
    
    setShowColorPicker(false);
    setSelectedRange(null);
    
    // 清除选择
    window.getSelection()?.removeAllRanges();
  };

  const removeHighlight = () => {
    if (!selectedRange) return;

    const updatedHighlights = activeHighlights.filter(h => 
      !(h.start === selectedRange.start && h.end === selectedRange.end)
    );
    
    setActiveHighlights(updatedHighlights);
    onHighlightChange?.(updatedHighlights);
    
    setShowColorPicker(false);
    setSelectedRange(null);
    
    // 清除选择
    window.getSelection()?.removeAllRanges();
  };

  const renderHighlightedText = () => {
    if (activeHighlights.length === 0) {
      return <span>{text}</span>;
    }

    // 按位置排序高亮
    const sortedHighlights = [...activeHighlights].sort((a, b) => a.start - b.start);
    const parts = [];
    let lastIndex = 0;

    sortedHighlights.forEach((highlight, index) => {
      // 添加高亮前的文本
      if (highlight.start > lastIndex) {
        parts.push(
          <span key={`text_${index}`}>
            {text.slice(lastIndex, highlight.start)}
          </span>
        );
      }

      // 添加高亮文本
      parts.push(
        <span
          key={highlight.id}
          style={{ 
            backgroundColor: highlight.color,
            padding: '2px 4px',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
          title={`点击取消高亮`}
        >
          {text.slice(highlight.start, highlight.end)}
        </span>
      );

      lastIndex = highlight.end;
    });

    // 添加最后剩余的文本
    if (lastIndex < text.length) {
      parts.push(
        <span key="text_end">
          {text.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.color-picker-container')) {
      setShowColorPicker(false);
      setSelectedRange(null);
    }
  };

  useEffect(() => {
    if (showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker]);

  // 检查是否点击了已高亮的文本
  const isClickedHighlight = selectedRange && activeHighlights.some(h => 
    h.start === selectedRange.start && h.end === selectedRange.end
  );

  return (
    <div className={`relative ${className}`}>
      <div
        ref={textRef}
        className="select-text cursor-text leading-relaxed font-mono text-lg p-4 bg-white rounded-lg border-2 border-gray-200"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        {renderHighlightedText()}
      </div>

      {/* 颜色选择器弹窗 */}
      {showColorPicker && (
        <div
          className="color-picker-container fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 p-3"
          style={{
            left: `${colorPickerPosition.x}px`,
            top: `${colorPickerPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {isClickedHighlight ? (
            // 显示取消高亮选项
            <div className="flex flex-col items-center space-y-2">
              <div className="text-sm text-gray-600 whitespace-nowrap">已高亮文本</div>
              <button
                onClick={removeHighlight}
                className="flex items-center space-x-2 px-3 py-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors"
              >
                <X size={16} />
                <span>取消高亮</span>
              </button>
            </div>
          ) : (
            // 显示颜色选择选项
            <div className="flex space-x-2 p-2">
              {HIGHLIGHT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => addHighlight(color.value)}
                  className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-gray-400 transition-colors flex items-center justify-center"
                  style={{ backgroundColor: color.value }}
                  title={`${color.name} - ${color.label}`}
                >
                  <span className="sr-only">{color.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TextHighlighter;
