import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Upload as UploadIcon } from 'lucide-react';
import { textAPI } from '../utils/api';

// 从尚未闭合的 JSON 流里尽力提取 "translation" 字段的当前值
const extractStreamingTranslation = (raw: string): string => {
  if (!raw) return '';
  const keyIndex = raw.indexOf('"translation"');
  if (keyIndex < 0) return '';

  // 找到键之后的第一个 "
  const colonIndex = raw.indexOf(':', keyIndex);
  if (colonIndex < 0) return '';
  const valueStart = raw.indexOf('"', colonIndex + 1);
  if (valueStart < 0) return '';

  let result = '';
  let i = valueStart + 1;
  while (i < raw.length) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[i + 1];
      if (next === 'n') result += '\n';
      else if (next === 't') result += '\t';
      else if (next === 'r') result += '\r';
      else if (next === '"' || next === '\\' || next === '/') result += next;
      else if (next === 'u' && i + 5 < raw.length) {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        return result;
      } else {
        result += next;
      }
      i += 2;
      continue;
    }
    if (ch === '"') break; // 字符串结束
    result += ch;
    i += 1;
  }
  return result;
};

const Upload: React.FC = () => {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');
  const [streamingTranslation, setStreamingTranslation] = useState('');
  const navigate = useNavigate();
  const previewRef = useRef<HTMLDivElement | null>(null);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    if (previewRef.current) {
      previewRef.current.scrollTop = previewRef.current.scrollHeight;
    }
  }, [streamingTranslation]);

  const stageFor = (p: number) => {
    if (p < 10) return '正在唤醒 AI…';
    if (p < 35) return '生成中文译文…';
    if (p < 60) return '挑选难词与释义…';
    if (p < 90) return '评估难度与关键表达…';
    if (p < 100) return '收尾整理…';
    return '分析完成';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) {
      setError('请输入英文文本内容');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setStreamingTranslation('');
    setStage('准备上传…');

    await textAPI.uploadStream(
      { content: content.trim(), title: title.trim() || undefined },
      (nextProgress, fullContent) => {
        setProgress(nextProgress);
        setStage(stageFor(nextProgress));
        const t = extractStreamingTranslation(fullContent);
        if (t) setStreamingTranslation(t);
      },
      (textId) => {
        setProgress(100);
        setStage('分析完成');
        navigate(`/practice/${textId}`);
      },
      (message) => {
        setError(message || '分析失败，请重试');
        setIsLoading(false);
      }
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== 'text/plain') return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setContent(loadEvent.target?.result as string);
      setTitle(file.name.replace(/\.txt$/i, ''));
    };
    reader.readAsText(file);
  };

  return (
    <div className="page">
      <div className="section-head" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="eyebrow">New material</div>
          <h2 className="page-title" style={{ marginTop: 6 }}>上传练习文本</h2>
          <p className="page-sub">粘贴一段英文，AI 会生成中文译文、难词和回译练习入口。</p>
        </div>
      </div>

      <div className="compare split" style={{ marginTop: 32 }}>
        <div className="panel">
          <div className="panel-head">
            <span className="eyebrow">英文材料</span>
            <span className="tag">{wordCount} words</span>
          </div>
          <div className="panel-body">
            <form onSubmit={handleSubmit}>
              <label className="eyebrow" htmlFor="title">文本标题</label>
              <input
                id="title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="为这篇练习起个名字"
                disabled={isLoading}
                style={{
                  width: '100%',
                  margin: '8px 0 22px',
                  padding: '11px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 6,
                  background: 'var(--bg-card)',
                }}
              />

              <label className="eyebrow" htmlFor="content">英文文本</label>
              <textarea
                id="content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={14}
                disabled={isLoading}
                className="tw-input"
                style={{ minHeight: 360, border: '1px solid var(--line)', borderRadius: 8, marginTop: 8, background: 'var(--bg)' }}
                placeholder="Paste the English passage you want to rewrite from translation…"
                required
              />

              <div className="row" style={{ marginTop: 14 }}>
                <span className="dim tiny">字符数 {content.length} · 单词数 {wordCount}</span>
                <span className="spacer" />
                <label className="btn" style={{ opacity: isLoading ? 0.5 : 1, pointerEvents: isLoading ? 'none' : 'auto' }}>
                  <FileText size={14} /> 选择 TXT
                  <input type="file" className="hidden" accept=".txt" onChange={handleFileUpload} disabled={isLoading} />
                </label>
              </div>

              {error && (
                <div className="card" style={{ marginTop: 16, padding: 14, color: 'var(--bad)', background: 'var(--bad-soft)' }}>
                  {error}
                </div>
              )}

              {isLoading && (
                <div className="card" style={{ marginTop: 16, padding: '14px 16px' }}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="dim tiny">{stage}</span>
                    <span className="spacer" />
                    <span className="mono tiny dim">{progress}%</span>
                  </div>
                  <div className="progress"><div className="bar" style={{ width: `${progress}%` }} /></div>
                </div>
              )}

              <button
                type="submit"
                className="btn accent lg"
                disabled={isLoading || !content.trim()}
                style={{ marginTop: 22, width: '100%', justifyContent: 'center' }}
              >
                <UploadIcon size={16} /> {isLoading ? '分析中…' : '上传并开始练习'}
              </button>
            </form>
          </div>
        </div>

        {isLoading ? (
          <aside className="panel">
            <div className="panel-head">
              <span className="eyebrow">实时译文 · Streaming</span>
              <span className="tag accent">{progress}%</span>
            </div>
            <div className="panel-body" ref={previewRef} style={{ maxHeight: 520, overflowY: 'auto' }}>
              {streamingTranslation ? (
                <div className="prose zh">
                  {streamingTranslation.split('\n').map((line, index) => (
                    <p key={index}>{line || ' '}</p>
                  ))}
                  <span className="caret" />
                </div>
              ) : (
                <div className="dim" style={{ padding: '8px 4px' }}>
                  AI 正在思考，译文很快就会出现在这里…
                </div>
              )}
            </div>
          </aside>
        ) : (
          <aside className="panel">
            <div className="panel-head">
              <span className="eyebrow">Workflow</span>
              <span className="tag accent">4 steps</span>
            </div>
            <div className="panel-body">
              <div className="method-row" style={{ display: 'block', margin: 0, borderTop: 0 }}>
                {[
                  ['i.', '选择文本', '建议 100-500 词，主题清楚，句式有一定变化。'],
                  ['ii.', 'AI 分析', '系统生成中文译文、难词解释与难度评估。'],
                  ['iii.', '遮蔽原文', '只看中文译文，尝试还原英文表达。'],
                  ['iv.', '获得反馈', '提交后比对原文，沉淀到历史记录。'],
                ].map(([n, heading, body]) => (
                  <div className="step" key={n} style={{ borderRight: 0, borderBottom: '1px solid var(--line-soft)' }}>
                    <span className="n">{n}</span>
                    <h4>{heading}</h4>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default Upload;
