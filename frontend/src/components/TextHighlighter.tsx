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

// CSS Highlights API 类型定义
declare global {
  interface CSS {
    highlights?: Map<string, Highlight>;
  }
}

const HIGHLIGHT_COLORS = [
  { name: '红色', value: '#E57373', label: '柔和的浅红', cssName: 'text-highlight-red' },
  { name: '黄色', value: '#FFF176', label: '温柔的浅黄', cssName: 'text-highlight-yellow' },
  { name: '绿色', value: '#81C784', label: '清新的草绿', cssName: 'text-highlight-green' },
  { name: '紫色', value: '#BA68C8', label: '淡雅的薰衣草紫', cssName: 'text-highlight-purple' },
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
  const [supportsCSSHighlights, setSupportsCSSHighlights] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const selectionTimeoutRef = useRef<number | null>(null);

  // 检查 CSS Highlights API 支持
  useEffect(() => {
    const supported = 'highlights' in CSS && 'Highlight' in window;
    setSupportsCSSHighlights(supported);
    
    if (supported) {
      // 初始化 CSS Highlights API 样式
      initializeHighlightStyles();
    }
    
    console.log('CSS Highlights API support:', supported);
  }, []);

  useEffect(() => {
    setActiveHighlights(highlights);
    if (supportsCSSHighlights) {
      updateCSSHighlights(highlights);
    }
  }, [highlights, supportsCSSHighlights]);

  // 初始化 CSS Highlights 样式
  const initializeHighlightStyles = () => {
    // 创建样式表
    const style = document.createElement('style');
    style.textContent = `
      ::highlight(text-highlight-red) {
        background-color: #E57373;
        color: inherit;
      }
      ::highlight(text-highlight-yellow) {
        background-color: #FFF176;
        color: inherit;
      }
      ::highlight(text-highlight-green) {
        background-color: #81C784;
        color: inherit;
      }
      ::highlight(text-highlight-purple) {
        background-color: #BA68C8;
        color: inherit;
      }
    `;
    document.head.appendChild(style);
  };

  // 更新 CSS Highlights
  const updateCSSHighlights = (highlightData: HighlightData[]) => {
    if (!CSS.highlights || !textRef.current) return;

    // 清除所有现有高亮
    CSS.highlights.clear();

    // 按颜色分组高亮
    const colorGroups = new Map<string, HighlightData[]>();
    highlightData.forEach(highlight => {
      const colorName = HIGHLIGHT_COLORS.find(c => c.value === highlight.color)?.cssName || 'text-highlight-red';
      if (!colorGroups.has(colorName)) {
        colorGroups.set(colorName, []);
      }
      colorGroups.get(colorName)!.push(highlight);
    });

    // 为每种颜色创建高亮
    colorGroups.forEach((highlights, colorName) => {
      const ranges: Range[] = [];
      
      highlights.forEach(highlight => {
        const range = createTextRange(highlight.start, highlight.end);
        if (range) {
          ranges.push(range);
        }
      });

      if (ranges.length > 0) {
        const highlightInstance = new Highlight(...ranges);
        CSS.highlights.set(colorName, highlightInstance);
      }
    });
  };

  // 创建文本范围
  const createTextRange = (start: number, end: number): Range | null => {
    if (!textRef.current) return null;

    const textNode = getTextNode(textRef.current);
    if (!textNode) return null;

    try {
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      return range;
    } catch (error) {
      console.warn('Failed to create range:', error);
      return null;
    }
  };

  // 获取文本节点
  const getTextNode = (element: HTMLElement): Text | null => {
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        return child as Text;
      }
    }
    return null;
  };

  const handleSelectionChange = () => {
    // 清除之前的延迟
    if (selectionTimeoutRef.current) {
      clearTimeout(selectionTimeoutRef.current);
    }

    // 防抖处理，避免选择过程中的抖动
    selectionTimeoutRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setShowColorPicker(false);
        return;
      }

      const range = selection.getRangeAt(0);
      const selectedText = selection.toString().trim();
      
      // 忽略空选择和折叠的选择
      if (selectedText.length === 0 || range.collapsed) {
        setShowColorPicker(false);
        return;
      }

      // 确保选择在我们的文本容器内
      const textElement = textRef.current;
      if (!textElement || !textElement.contains(range.commonAncestorContainer)) {
        setShowColorPicker(false);
        return;
      }

      handleTextSelection(range, selectedText);
    }, 50); // 50ms 防抖延迟
  };

  const calculateSmartPosition = (range: Range) => {
    const rects = range.getClientRects();
    if (rects.length === 0) return { x: 0, y: 0 };

    // 使用第一个矩形作为基准
    const rect = rects[0];
    const viewportWidth = window.innerWidth;
    
    // 计算理想位置（选中文本上方中央）
    let x = rect.left + rect.width / 2;
    let y = rect.top - 10;
    
    // 防止溢出右边缘
    if (x + 150 > viewportWidth) { // 假设弹窗宽度约 300px
      x = viewportWidth - 160;
    }
    
    // 防止溢出左边缘
    if (x < 10) {
      x = 10;
    }
    
    // 防止溢出顶部
    if (y < 10) {
      y = rect.bottom + 10; // 改为显示在选中文本下方
    }
    
    return { x, y };
  };

  const handleTextSelection = (range: Range, selectedText: string) => {
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

    // 计算智能位置
    const position = calculateSmartPosition(range);
    setColorPickerPosition(position);

    if (clickedHighlight) {
      setSelectedRange({ start: clickedHighlight.start, end: clickedHighlight.end, text: clickedHighlight.text });
    } else {
      setSelectedRange({ start: startOffset, end: endOffset, text: selectedText });
    }
    
    setShowColorPicker(true);
  };

  // 监听全局 selectionchange 事件
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [activeHighlights]);

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
    
    // 如果支持 CSS Highlights API，立即更新
    if (supportsCSSHighlights) {
      updateCSSHighlights(updatedHighlights);
    }
    
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
    
    // 如果支持 CSS Highlights API，立即更新
    if (supportsCSSHighlights) {
      updateCSSHighlights(updatedHighlights);
    }
    
    setShowColorPicker(false);
    setSelectedRange(null);
    
    // 清除选择
    window.getSelection()?.removeAllRanges();
  };

  const renderHighlightedText = () => {
    // 如果支持 CSS Highlights API，直接返回纯文本，由 CSS 处理高亮
    if (supportsCSSHighlights) {
      return text;
    }

    // 回退到旧的 DOM 操作方式
    if (activeHighlights.length === 0) {
      return text;
    }

    // 按位置排序高亮
    const sortedHighlights = [...activeHighlights].sort((a, b) => a.start - b.start);
    
    // 合并相同颜色的相邻/重叠区域
    const mergedHighlights = [];
    for (const highlight of sortedHighlights) {
      const lastMerged = mergedHighlights[mergedHighlights.length - 1];
      
      if (lastMerged && 
          lastMerged.color === highlight.color &&
          highlight.start <= lastMerged.end) {
        lastMerged.end = Math.max(lastMerged.end, highlight.end);
      } else {
        mergedHighlights.push({ ...highlight });
      }
    }

    // 创建所有断点位置
    const breakpoints = new Set([0, text.length]);
    mergedHighlights.forEach(h => {
      breakpoints.add(h.start);
      breakpoints.add(h.end);
    });
    
    const sortedBreakpoints = Array.from(breakpoints).sort((a, b) => a - b);
    
    // 为每个区间找到应用的高亮
    const parts = [];
    for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
      const start = sortedBreakpoints[i];
      const end = sortedBreakpoints[i + 1];
      
      if (start >= end) continue;
      
      // 找到覆盖此区间的高亮
      const applicableHighlights = mergedHighlights.filter(h => 
        h.start <= start && h.end >= end
      );
      
      const textSlice = text.slice(start, end);
      
      if (applicableHighlights.length === 0) {
        // 无高亮的普通文本
        parts.push(textSlice);
      } else if (applicableHighlights.length === 1) {
        // 单一高亮
        const highlight = applicableHighlights[0];
        parts.push(
          <mark
            key={`highlight_${start}_${end}`}
            style={{
              backgroundColor: highlight.color,
              padding: '1px 2px',
              borderRadius: '2px',
              border: 'none',
              color: 'inherit'
            }}
            data-highlight-id={highlight.id}
          >
            {textSlice}
          </mark>
        );
      } else {
        // 多重高亮重叠
        const primaryHighlight = applicableHighlights[0];
        const otherColors = applicableHighlights.slice(1).map(h => h.color);
        
        parts.push(
          <mark
            key={`highlight_${start}_${end}`}
            style={{
              backgroundColor: primaryHighlight.color,
              padding: '1px 2px',
              borderRadius: '2px',
              border: `1px solid ${otherColors[0]}`,
              color: 'inherit',
              boxShadow: otherColors.length > 1 
                ? `inset 0 0 0 1px ${otherColors[1]}` 
                : 'none'
            }}
            data-highlight-id={primaryHighlight.id}
          >
            {textSlice}
          </mark>
        );
      }
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
      {/* CSS Highlights API 支持指示器 */}
      {!supportsCSSHighlights && (
        <div className="mb-2 text-sm text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
          💡 您的浏览器不支持最新的 CSS Highlights API，使用兼容模式
        </div>
      )}
      
      <div
        ref={textRef}
        className="select-text cursor-text leading-relaxed font-mono text-lg p-4 bg-white rounded-lg border-2 border-gray-200"
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
            transform: 'translate(-50%, -100%)',
            transition: 'opacity 150ms ease, transform 150ms ease',
            opacity: showColorPicker ? 1 : 0,
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
