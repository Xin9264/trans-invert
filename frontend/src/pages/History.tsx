import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Download, Upload } from 'lucide-react';
import { practiceAPI, PracticeHistoryExport, PracticeHistoryRecord } from '../utils/api';

interface UnifiedHistoryRecord {
  id: string;
  title: string;
  content: string;
  score: number;
  timestamp: string;
  userInput: string;
  feedback: string;
  ok: boolean;
  originalRecord: PracticeHistoryRecord;
}

const formatTimelineDate = (dateString: string) => {
  const date = new Date(dateString);
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    time: date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
  };
};

const Sparkline: React.FC<{ values: number[]; w?: number; h?: number }> = ({ values, w = 220, h = 36 }) => {
  if (values.length < 2) return <svg className="spark" viewBox={`0 0 ${w} ${h}`} />;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const y = (value: number) => h - ((value - min) / span) * (h - 4) - 2;
  const points = values.map((value, index) => `${index * step},${y(value)}`).join(' ');

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((value, index) => (
        <circle key={index} cx={index * step} cy={y(value)} r="1.5" fill="var(--accent)" />
      ))}
    </svg>
  );
};

const scoreClass = (score: number) => {
  if (score >= 85) return 'good';
  if (score >= 70) return 'warn';
  return 'bad';
};

const History: React.FC = () => {
  const [records, setRecords] = useState<UnifiedHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'good' | 'bad'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = async () => {
    try {
      const response = await practiceAPI.getHistory();
      if (response.success && response.data) {
        const nextRecords = response.data.map((record) => ({
          id: record.id,
          title: record.text_title || '未命名文本',
          content: record.text_content,
          score: record.score,
          timestamp: record.timestamp,
          userInput: record.user_input,
          feedback: record.ai_evaluation?.overall_feedback || '',
          ok: !!record.ai_evaluation?.is_acceptable,
          originalRecord: record,
        }));
        nextRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecords(nextRecords);
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const stats = useMemo(() => {
    const total = records.length;
    const average = total ? Math.round(records.reduce((sum, record) => sum + record.score, 0) / total) : 0;
    const best = total ? Math.max(...records.map((record) => record.score)) : 0;
    const words = records.reduce((sum, record) => sum + record.content.split(/\s+/).filter(Boolean).length, 0);
    return { total, average, best, words };
  }, [records]);

  const trend = records.slice().reverse().map((record) => record.score);
  const filteredRecords = filter === 'all'
    ? records
    : records.filter((record) => (filter === 'good' ? record.ok : !record.ok));

  const handleExport = async () => {
    if (records.length === 0) {
      window.alert('没有历史记录可以导出');
      return;
    }

    setIsExporting(true);
    try {
      const blob = await practiceAPI.exportHistory();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `practice_history_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出失败:', error);
      window.alert('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      window.alert('请选择JSON格式的文件');
      return;
    }

    setIsImporting(true);
    try {
      const text = await file.text();
      const importData: PracticeHistoryExport = JSON.parse(text);
      if (!importData.records || !Array.isArray(importData.records)) throw new Error('无效的数据格式');
      const response = await practiceAPI.importHistory(importData);
      if (!response.success) throw new Error(response.error || '导入失败');
      await loadHistory();
    } catch (error) {
      console.error('导入失败:', error);
      window.alert('导入失败：' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>正在读取历史记录…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="section-head" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="eyebrow">A record of every rewriting</div>
          <h2 className="page-title" style={{ marginTop: 6 }}>练习历史</h2>
          <p className="page-sub">每一次回译都被保留下来，不是为了炫耀分数，而是为了让你看见自己写作的曲线。</p>
        </div>
        <div className="row">
          <button className="btn" type="button" onClick={handleExport} disabled={isExporting || records.length === 0}>
            <Download size={14} /> {isExporting ? '导出中' : '导出'}
          </button>
          <button className="btn" type="button" onClick={() => fileInputRef.current?.click()} disabled={isImporting}>
            <Upload size={14} /> {isImporting ? '导入中' : '导入'}
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {records.length === 0 ? (
        <div className="card" style={{ padding: 44, textAlign: 'center', marginTop: 32 }}>
          <Calendar size={42} style={{ margin: '0 auto 12px', color: 'var(--ink-4)' }} />
          <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--ff-display)', fontSize: 22 }}>还没有练习记录</h3>
          <p className="dim" style={{ marginBottom: 18 }}>开始第一次回译后，时间线会出现在这里。</p>
          <Link to="/upload" className="btn accent">开始练习</Link>
        </div>
      ) : (
        <>
          <div className="stat-row" style={{ marginTop: 32 }}>
            <div className="stat">
              <div className="label">Sessions</div>
              <div className="value">{stats.total}</div>
              <div className="delta">all practice records</div>
            </div>
            <div className="stat">
              <div className="label">Average</div>
              <div className="value">{stats.average}<span className="unit">/100</span></div>
              <Sparkline values={trend} />
            </div>
            <div className="stat">
              <div className="label">Best score</div>
              <div className="value">{stats.best}</div>
              <div className="delta">personal best</div>
            </div>
            <div className="stat">
              <div className="label">Words written</div>
              <div className="value">{stats.words.toLocaleString()}</div>
              <div className="delta">across {stats.total} pieces</div>
            </div>
          </div>

          <div className="section-head">
            <div>
              <div className="eyebrow">Recent</div>
              <h2>最近的练习</h2>
            </div>
            <div className="seg">
              <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')} type="button">全部</button>
              <button aria-pressed={filter === 'good'} onClick={() => setFilter('good')} type="button">已通过</button>
              <button aria-pressed={filter === 'bad'} onClick={() => setFilter('bad')} type="button">需改进</button>
            </div>
          </div>

          <div className="timeline">
            {filteredRecords.map((record) => {
              const date = formatTimelineDate(record.timestamp);
              return (
                <div className="tl-row" key={record.id}>
                  <div className="tl-date">
                    <span className="dim tiny">{date.month}</span>
                    <strong>{date.day}</strong>
                    <span className="dim tiny">{date.time}</span>
                  </div>
                  <button
                    type="button"
                    className="tl-card text-left w-full"
                    onClick={() => window.alert(`文章：${record.title}\n\n英文原文：${record.content.slice(0, 240)}...\n\n您的回译：${record.userInput.slice(0, 240)}...\n\nAI评价：${record.feedback}`)}
                  >
                    <div className="head">
                      <h4>{record.title}</h4>
                      <span className={`score ${scoreClass(record.score)}`}>{record.score}</span>
                    </div>
                    <div className="row-meta">
                      <span className="tag">回译</span>
                      <span>{record.content.split(/\s+/).filter(Boolean).length} 词</span>
                      <span>·</span>
                      <span className={record.ok ? 'tag good' : 'tag bad'}>{record.ok ? '通过' : '需改进'}</span>
                    </div>
                    <div className="preview">「{record.userInput || record.content}」</div>
                    {record.feedback && <div className="feedback">— {record.feedback}</div>}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default History;
