import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Columns, History, Layers, RotateCcw } from 'lucide-react';
import { practiceAPI, textAPI } from '../utils/api';
import { Text, TextAnalysis } from '../types';
import type { CorrectionSeverity, CorrectionSource } from '../utils/api';

type PracticeMode = 'study' | 'practice' | 'completed';
type CompareView = 'split' | 'layered';
type PracticeFlow = 'whole' | 'segment';

// category -> 中文标签。后端已用受控词表，这里只负责本地化。
const CATEGORY_LABELS: Record<string, string> = {
  'grammar.article': '冠词',
  'grammar.tense': '时态',
  'grammar.aspect': '体',
  'grammar.number': '单复数',
  'grammar.agreement': '主谓一致',
  'grammar.voice': '语态',
  'grammar.mood': '语气',
  'grammar.preposition': '介词',
  'grammar.conjunction': '连词',
  'grammar.word_order': '语序',
  'grammar.nonfinite': '非谓语',
  'grammar.other': '语法',
  'lexis.word_choice': '选词',
  'lexis.collocation': '搭配',
  'lexis.register': '语域',
  'lexis.semantic_prosody': '语义韵',
  'lexis.derivation': '构词',
  'discourse.cohesion': '衔接',
  'discourse.information_structure': '信息结构',
  'discourse.reference': '指代',
  'mechanics.spelling': '拼写',
  'mechanics.punctuation': '标点',
  'mechanics.capitalization': '大小写',
};

const SEVERITY_LABELS: Record<CorrectionSeverity, string> = {
  minor: '细节',
  major: '明显',
  critical: '严重',
};

const SOURCE_LABELS: Record<CorrectionSource, string> = {
  L1_transfer: '母语迁移',
  overgeneralization: '规则泛化',
  intralingual: '语内混淆',
  performance_slip: '偶发笔误',
};

const compareViews: Array<{
  key: CompareView;
  label: string;
  description: string;
  Icon: typeof Columns;
}> = [
  { key: 'split', label: '双栏', description: '中文与英文并排阅读', Icon: Columns },
  { key: 'layered', label: '浮层', description: '点击英文句子查看译文', Icon: Layers },
];

const pips = (difficulty: number) => (
  <span className="pips">
    {[1, 2, 3, 4, 5].map((level) => (
      <span key={level} className={`pip${level <= difficulty ? ' on' : ''}`} />
    ))}
  </span>
);

const splitSentences = (text: string, zh = false) => {
  const pattern = zh ? /(?<=[。！？；])/ : /(?<=[.!?;])\s+/;
  return text.split(pattern).map((item) => item.trim()).filter(Boolean);
};

const StreamingText: React.FC<{ text: string; speed?: number }> = ({ text, speed = 14 }) => {
  const chars = useMemo(() => Array.from(text), [text]);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setCount(0);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setCount(index);
      if (index >= chars.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [chars, speed]);

  return (
    <div className="stream">
      {chars.slice(0, count).map((char, index) => (
        <span key={index} className="ch">{char}</span>
      ))}
      {count < chars.length && <span className="caret" />}
    </div>
  );
};

const CompareSplit: React.FC<{ text: Text; analysis: TextAnalysis }> = ({ text, analysis }) => (
  <div className="compare split">
    <div className="panel">
      <div className="panel-head">
        <span className="eyebrow">中文译文</span>
        <span className="tag">参考</span>
      </div>
      <div className="panel-body">
        <div className="prose zh">{analysis.translation.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div>
      </div>
    </div>
    <div className="panel">
      <div className="panel-head">
        <span className="eyebrow">英文原文</span>
        <span className="tag">学习态</span>
      </div>
      <div className="panel-body">
        <div className="prose">{text.content.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div>
      </div>
    </div>
  </div>
);

const CompareLayered: React.FC<{ text: Text; analysis: TextAnalysis }> = ({ text, analysis }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const zh = splitSentences(analysis.translation, true);
  const en = splitSentences(text.content);
  const length = Math.max(zh.length, en.length);

  return (
    <div className="compare layered">
      <div className="panel">
        <div className="panel-head"><span className="eyebrow">原文为底 · 点击查看译文</span></div>
        <div className="panel-body layered-doc">
          {Array.from({ length }).map((_, index) => (
            <span
              key={index}
              className={`source-line${openIndex === index ? ' show' : ''}`}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
            >
              {en[index] || text.content}{' '}
              {openIndex === index && <span className="floating">{zh[index] || analysis.translation}</span>}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

const CompareViewPicker: React.FC<{
  value: CompareView;
  onChange: (view: CompareView) => void;
}> = ({ value, onChange }) => (
  <div className="compare-picker" aria-label="对照视图">
    {compareViews.map(({ key, label, description, Icon }) => (
      <button
        key={key}
        type="button"
        aria-pressed={value === key}
        onClick={() => onChange(key)}
      >
        <Icon size={16} />
        <span>
          <strong>{label}</strong>
          <small>{description}</small>
        </span>
      </button>
    ))}
  </div>
);

const Practice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [text, setText] = useState<Text | null>(null);
  const [analysis, setAnalysis] = useState<TextAnalysis | null>(null);
  const [mode, setMode] = useState<PracticeMode>('study');
  const [view, setView] = useState<CompareView>('split');
  const [flow, setFlow] = useState<PracticeFlow>('whole');
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setIsLoading(true);
        const [analysisResponse, textResponse] = await Promise.all([
          textAPI.getAnalysis(id),
          textAPI.getById(id, true),
        ]);

        if (analysisResponse.success && analysisResponse.data && textResponse.success && textResponse.data) {
          setAnalysis({
            id: analysisResponse.data.text_id,
            textId: analysisResponse.data.text_id,
            difficultWords: analysisResponse.data.difficult_words || [],
            difficulty: analysisResponse.data.difficulty,
            translation: analysisResponse.data.translation,
            keyPoints: analysisResponse.data.key_points || [],
            contrastiveNotes: analysisResponse.data.contrastive_notes || [],
            alignedSegments: analysisResponse.data.aligned_segments || [],
            createdAt: new Date().toISOString(),
          });
          setText({
            id: analysisResponse.data.text_id,
            title: textResponse.data.title || '练习文本',
            content: textResponse.data.content || '',
            difficultyLevel: analysisResponse.data.difficulty,
            wordCount: analysisResponse.data.word_count,
            createdAt: textResponse.data.created_at || new Date().toISOString(),
            createdBy: '',
            type: 'translation',
            folder_id: textResponse.data.folder_id,
          });
        } else {
          setError(analysisResponse.message || textResponse.message || '文本分析尚未完成，请稍后重试');
        }
      } catch (requestError: any) {
        setError(requestError.response?.data?.error || requestError.message || '加载失败');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const loadPracticeHistory = async () => {
    if (!id) return;
    try {
      const response = await practiceAPI.getTextHistory(id);
      if (response.success && response.data) setPracticeHistory(response.data);
    } catch (historyError) {
      console.error('Failed to load practice history:', historyError);
    }
  };

  const submitPractice = async () => {
    if (!id || !input.trim()) return;
    setSubmitting(true);
    setProgress(4);

    const segments = analysis?.alignedSegments || [];
    const inSegmentMode = flow === 'segment' && segments.length > 0;
    const currentSegment = inSegmentMode ? segments[segmentIndex] : undefined;
    const payload = {
      text_id: id,
      user_input: input,
      ...(currentSegment ? {
        segment_en: currentSegment.en,
        segment_zh: currentSegment.zh,
        segment_index: segmentIndex + 1,
        segment_total: segments.length,
      } : {}),
    };

    try {
      await practiceAPI.submitStream(
        payload,
        (nextProgress) => setProgress(nextProgress),
        (result) => {
          setFeedback({
            score: result.score,
            aiFeedback: {
              score: result.score,
              corrections: result.corrections,
              overall: result.overall_feedback,
            },
          });
          setProgress(100);
          setMode('completed');
          setSubmitting(false);
        },
        (message) => {
          setError(message);
          setSubmitting(false);
        }
      );
    } catch (streamError: any) {
      try {
        const response = await practiceAPI.submit(payload);
        if (response.success && response.data) {
          setFeedback({
            score: response.data.score,
            aiFeedback: {
              score: response.data.score,
              corrections: response.data.corrections,
              overall: response.data.overall_feedback,
            },
          });
          setProgress(100);
          setMode('completed');
        } else {
          setError(response.message || response.error || '提交失败');
        }
      } catch (fallbackError: any) {
        setError(fallbackError.response?.data?.error || fallbackError.message || streamError.message || '提交失败');
      } finally {
        setSubmitting(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>正在载入练习…</div>
      </div>
    );
  }

  if (error || !text || !analysis) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>
          <p style={{ color: 'var(--bad)', marginBottom: 16 }}>{error || '文本不存在'}</p>
          <button type="button" className="btn accent" onClick={() => navigate('/')}>返回首页</button>
        </div>
      </div>
    );
  }

  const corrections = feedback?.aiFeedback?.corrections || [];

  return (
    <div className="page">
      <div className="practice-head">
        <div>
          <button className="btn ghost sm" onClick={() => navigate('/')} type="button" style={{ marginBottom: 8 }}>
            <ArrowLeft size={13} /> 返回材料
          </button>
          <div className="eyebrow">Translation inversion</div>
          <h1>{text.title || '练习文本'}</h1>
          <div className="meta">
            {pips(text.difficultyLevel)}
            <span>难度 {text.difficultyLevel}/5</span>
            <span>·</span>
            <span>{text.wordCount} 词</span>
          </div>
        </div>
        <div className="actions">
          {mode === 'completed' && flow === 'segment' && analysis
            && segmentIndex < analysis.alignedSegments.length - 1 && (
            <button
              className="btn accent"
              type="button"
              onClick={() => {
                setSegmentIndex(segmentIndex + 1);
                setInput('');
                setFeedback(null);
                setMode('practice');
              }}
            >
              下一句 →
            </button>
          )}
          {mode === 'completed' && (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setMode('study');
                setInput('');
                setFeedback(null);
                setSegmentIndex(0);
                setFlow('whole');
              }}
            >
              <RotateCcw size={14} /> 再来一次
            </button>
          )}
          {mode === 'practice' && (
            <button className="btn" type="button" onClick={() => setMode('study')}>
              <ArrowLeft size={14} /> 返回学习
            </button>
          )}
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              setShowHistoryModal(true);
              loadPracticeHistory();
            }}
          >
            <History size={14} /> 历史回译
          </button>
        </div>
      </div>

      {mode === 'study' && (
        <>
          <CompareViewPicker value={view} onChange={setView} />

          {view === 'split' && <CompareSplit text={text} analysis={analysis} />}
          {view === 'layered' && <CompareLayered text={text} analysis={analysis} />}

          {analysis.difficultWords.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 36 }}>
                <div>
                  <div className="eyebrow">Difficult words</div>
                  <h2>难词与搭配</h2>
                </div>
                <div className="dim tiny">进入练习后原文会被遮蔽</div>
              </div>
              <div className="card" style={{ padding: '8px 24px' }}>
                <div className="difficult-words">
                  {analysis.difficultWords.map((word, index) => (
                    <div className="dw" key={index}>
                      <div className="word">{word.word}</div>
                      <div className="meaning">{word.meaning}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {analysis.contrastiveNotes.length > 0 && (
            <>
              <div className="section-head" style={{ marginTop: 36 }}>
                <div>
                  <div className="eyebrow">Contrastive notes</div>
                  <h2>汉英对比要点</h2>
                </div>
                <div className="dim tiny">中文里看不见、英文必须有的</div>
              </div>
              <div className="contrast-list">
                {analysis.contrastiveNotes.map((note, index) => (
                  <div className="contrast-card" key={index}>
                    <div className="contrast-point">{note.point}</div>
                    <div className="contrast-pair">
                      <div className="contrast-en">{note.en_example}</div>
                      <div className="contrast-zh">{note.zh_in_translation}</div>
                    </div>
                    {note.hint && <div className="contrast-hint">💡 {note.hint}</div>}
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="btn accent lg"
              type="button"
              onClick={() => { setFlow('whole'); setMode('practice'); }}
            >
              <Check size={14} /> 整篇回译
            </button>
            <button
              className="btn lg"
              type="button"
              disabled={analysis.alignedSegments.length === 0}
              title={analysis.alignedSegments.length === 0 ? '该文本未提供句段对齐' : '逐句对照中文，一句一评分'}
              onClick={() => {
                setFlow('segment');
                setSegmentIndex(0);
                setInput('');
                setFeedback(null);
                setMode('practice');
              }}
            >
              <Check size={14} /> 逐句回译（{analysis.alignedSegments.length} 句）
            </button>
          </div>
        </>
      )}

      {mode === 'practice' && (() => {
        const segments = analysis.alignedSegments;
        const inSegment = flow === 'segment' && segments.length > 0;
        const currentSeg = inSegment ? segments[segmentIndex] : null;
        const targetWords = inSegment && currentSeg
          ? currentSeg.en.trim().split(/\s+/).length
          : text.wordCount;
        return (
        <div className="compare split">
          <div className="panel">
            <div className="panel-head">
              <span className="eyebrow">
                {inSegment ? `中文译文 · 第 ${segmentIndex + 1}/${segments.length} 句` : '中文译文 · 仅此可见'}
              </span>
              <span className="tag accent">{inSegment ? '逐句模式' : '回译模式'}</span>
            </div>
            <div className="panel-body">
              {inSegment ? (
                <div className="prose zh segment-zh">
                  {segments.map((seg, i) => (
                    <p key={i} className={i === segmentIndex ? 'seg-active' : 'seg-inactive'}>
                      {seg.zh}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="prose zh">
                  {analysis.translation.split('\n').map((line, index) => <p key={index}>{line}</p>)}
                </div>
              )}
            </div>
          </div>
          <div className="panel typewriter-shell">
            <div className="panel-head">
              <span className="eyebrow">
                {inSegment ? `回写第 ${segmentIndex + 1} 句` : '你的英文回译'}
              </span>
              <span className="tag">原文已遮蔽</span>
            </div>
            <div className="stats">
              <span className="stat"><strong>{input.length}</strong> chars</span>
              <span className="sep">·</span>
              <span className="stat"><strong>{input.trim() ? input.trim().split(/\s+/).length : 0}</strong> words</span>
              <span className="sep">·</span>
              <span className="stat">target ≈ <strong>{targetWords}</strong></span>
            </div>
            <textarea
              className="tw-input"
              placeholder={inSegment
                ? '只针对这一句回写，不要超出当前句的内容…'
                : "Begin writing in English. Don't aim for perfect recall — aim for grammatical, natural prose that carries the meaning across…"}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={submitting}
            />
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 12, alignItems: 'center' }}>
              {submitting ? (
                <>
                  <div className="dim tiny">AI 正在比对你的版本与原文 …</div>
                  <div style={{ flex: 1 }}>
                    <div className="progress"><div className="bar" style={{ width: `${progress}%` }} /></div>
                  </div>
                  <span className="mono tiny dim">{progress}%</span>
                </>
              ) : (
                <>
                  <span className="dim tiny">
                    {inSegment ? `还剩 ${segments.length - segmentIndex - 1} 句 · 提交后保存到历史` : '提交后会保存到历史记录'}
                  </span>
                  <span className="spacer" />
                  <button className="btn" type="button" onClick={() => setMode('study')}>放弃</button>
                  <button className="btn accent" type="button" onClick={submitPractice} disabled={!input.trim()}>
                    <Check size={14} /> 提交回译
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {mode === 'completed' && (
        <>
          <div className="score-plate">
            <div className="score-big">{feedback?.score ?? 0}<small> / 100</small></div>
            <div className="judge">
              <span className="label">AI 评价 · Streaming</span>
              <StreamingText text={feedback?.aiFeedback?.overall || '暂无评价'} />
            </div>
          </div>

          <div className="compare split" style={{ marginTop: 28 }}>
            <div className="panel">
              <div className="panel-head"><span className="eyebrow">英文原文</span><span className="tag good">参考答案</span></div>
              <div className="panel-body">
                <div className="prose">{text.content.split('\n').map((line, index) => <p key={index}>{line}</p>)}</div>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><span className="eyebrow">你的回译</span><span className="tag accent">作答</span></div>
              <div className="panel-body">
                <div className="prose">{input.split('\n').map((line, index) => <p key={index}>{line || <span className="dim">…</span>}</p>)}</div>
              </div>
            </div>
          </div>

          <div className="section-head">
            <div><div className="eyebrow">Corrections</div><h2>修订建议 · {corrections.length} 处</h2></div>
          </div>
          <div className="correction-list">
            {corrections.length === 0 ? (
              <div className="card" style={{ padding: 20 }}>暂无具体修订建议。</div>
            ) : corrections.map((correction: any, index: number) => {
              const categoryLabel = CATEGORY_LABELS[correction.category] || correction.category || '语法';
              const severity: CorrectionSeverity = correction.severity || 'minor';
              const source: CorrectionSource = correction.source || 'intralingual';
              return (
                <div className="correction" key={index}>
                  <div className="swap">
                    <span className="from">{correction.original}</span>
                    <span className="arrow">→</span>
                    <span className="to">{correction.suggestion}</span>
                  </div>
                  <div className="tags">
                    <span className={`tag tag-cat tag-cat-${(correction.category || '').split('.')[0]}`}>{categoryLabel}</span>
                    <span className={`tag tag-sev tag-sev-${severity}`}>{SEVERITY_LABELS[severity]}</span>
                    <span className={`tag tag-src tag-src-${source}`}>{SOURCE_LABELS[source]}</span>
                  </div>
                  <div className="why">{correction.reason}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="panel" style={{ width: 'min(920px, calc(100vw - 32px))', maxHeight: '82vh' }}>
            <div className="panel-head">
              <span className="eyebrow">历史回译记录</span>
              <button className="icon-btn" type="button" onClick={() => setShowHistoryModal(false)}>×</button>
            </div>
            <div className="panel-body" style={{ overflowY: 'auto' }}>
              {practiceHistory.length === 0 ? (
                <p className="dim">该文本还没有练习历史记录</p>
              ) : practiceHistory.map((record) => (
                <div key={record.id} className="tl-card" style={{ marginBottom: 14 }}>
                  <div className="head">
                    <h4>{new Date(record.timestamp).toLocaleString('zh-CN')}</h4>
                    <span className={`score ${record.score >= 85 ? 'good' : record.score >= 70 ? 'warn' : 'bad'}`}>{record.score}</span>
                  </div>
                  <div className="preview">「{record.user_input}」</div>
                  {record.ai_evaluation?.overall_feedback && <div className="feedback">— {record.ai_evaluation.overall_feedback}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Practice;
