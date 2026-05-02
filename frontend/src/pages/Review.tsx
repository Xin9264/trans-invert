import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Brain, CheckCircle, RefreshCw, Target, Clock } from 'lucide-react';
import { reviewAPI, ReviewMaterial, ReviewStats, DueReviewItem } from '../utils/api';

const Review: React.FC = () => {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMaterial, setGeneratedMaterial] = useState<ReviewMaterial | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dueItems, setDueItems] = useState<DueReviewItem[]>([]);
  const [dueTotal, setDueTotal] = useState(0);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const [statsResp, dueResp] = await Promise.all([
        reviewAPI.getStats(),
        reviewAPI.getDue(10),
      ]);
      if (statsResp.success && statsResp.data) {
        setStats(statsResp.data);
      } else {
        throw new Error(statsResp.error || '获取统计失败');
      }
      if (dueResp.success && dueResp.data) {
        setDueItems(dueResp.data.due);
        setDueTotal(dueResp.data.total);
      }
    } catch (requestError) {
      console.error('获取复习统计失败:', requestError);
      setError('获取复习统计失败');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const generateReviewMaterial = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await reviewAPI.generate();
      if (response.success && response.data) {
        setGeneratedMaterial(response.data);
        fetchStats();
      } else {
        throw new Error(response.error || '生成复习材料失败');
      }
    } catch (requestError) {
      console.error('生成复习材料失败:', requestError);
      setError(requestError instanceof Error ? requestError.message : '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (isLoadingStats) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>正在读取复习统计…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="section-head" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="eyebrow">Adaptive review</div>
          <h2 className="page-title" style={{ marginTop: 6 }}>智能复习</h2>
          <p className="page-sub">基于历史薄弱处生成新材料，重点练搭配、句法和表达精度。</p>
        </div>
        <button className="btn accent" type="button" onClick={generateReviewMaterial} disabled={isGenerating || !stats || stats.total_practiced === 0}>
          <Brain size={14} /> {isGenerating ? '生成中…' : '生成复习材料'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginTop: 24, padding: 16, color: 'var(--bad)', background: 'var(--bad-soft)' }}>
          <div className="row"><AlertCircle size={18} /> {error}</div>
        </div>
      )}

      {stats && (
        <div className="stat-row" style={{ marginTop: 32 }}>
          <div className="stat">
            <div className="label">Practiced</div>
            <div className="value">{stats.total_practiced}</div>
            <div className="delta">已练习材料</div>
          </div>
          <div className="stat">
            <div className="label">Due today</div>
            <div className="value">{dueTotal}</div>
            <div className="delta down">到期复习</div>
          </div>
          <div className="stat">
            <div className="label">Mastered</div>
            <div className="value">{stats.mastered}</div>
            <div className="delta">稳定掌握</div>
          </div>
          <div className="stat">
            <div className="label">Focus areas</div>
            <div className="value">{stats.focus_areas.length}</div>
            <div className="delta">重点领域</div>
          </div>
        </div>
      )}

      {dueItems.length > 0 && (
        <div className="panel" style={{ marginTop: 28 }}>
          <div className="panel-head">
            <span className="eyebrow"><Clock size={14} style={{ verticalAlign: -2, marginRight: 6 }} />到期复习</span>
            <span className="tag accent">{dueTotal} 条到期</span>
          </div>
          <div className="panel-body">
            <div className="due-list">
              {dueItems.map((item) => (
                <div className="due-item" key={item.id}>
                  <div className="due-head">
                    <span className="due-title">{item.text_title}</span>
                    <span className={`score ${item.score >= 85 ? 'good' : item.score >= 70 ? 'warn' : 'bad'}`}>{item.score}</span>
                  </div>
                  <div className="due-meta dim tiny">
                    {item.overdue_days > 0
                      ? `逾期 ${item.overdue_days} 天`
                      : '今日到期'} · 已复习 {item.review_count} 次
                    {item.error_categories.length > 0 && (
                      <> · 弱点：{item.error_categories.slice(0, 3).join('、')}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {dueTotal > dueItems.length && (
              <div className="dim tiny" style={{ marginTop: 12 }}>
                还有 {dueTotal - dueItems.length} 条未列出
              </div>
            )}
          </div>
        </div>
      )}

      <div className="compare split" style={{ marginTop: 34 }}>
        <div className="panel">
          <div className="panel-head">
            <span className="eyebrow">重点领域</span>
            <span className="tag">{stats?.focus_areas.length || 0} items</span>
          </div>
          <div className="panel-body">
            {stats && stats.focus_areas.length > 0 ? (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                {stats.focus_areas.map((area, index) => (
                  <span className="tag accent" key={index}>{area}</span>
                ))}
              </div>
            ) : (
              <p className="dim">还没有足够的历史记录来判断重点领域。</p>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="eyebrow">下一步</span>
            <span className="tag good">review loop</span>
          </div>
          <div className="panel-body">
            {stats && stats.total_practiced === 0 ? (
              <div>
                <p className="dim" style={{ marginBottom: 18 }}>你还没有练习记录，无法生成个性化复习材料。</p>
                <Link to="/upload" className="btn accent">开始练习</Link>
              </div>
            ) : (
              <div className="correction-list">
                <div className="correction" style={{ borderLeftColor: 'var(--accent)' }}>
                  <div className="swap"><Target size={15} /> <span>从最近错误中抽取主题</span></div>
                  <div className="why">生成的材料会刻意包含你容易写偏的句式或搭配。</div>
                </div>
                <div className="correction" style={{ borderLeftColor: 'var(--good)' }}>
                  <div className="swap"><CheckCircle size={15} /> <span>完成后回到历史记录</span></div>
                  <div className="why">复习材料与普通材料一样，会进入练习与评分流程。</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {generatedMaterial && (
        <div className="panel" style={{ marginTop: 34 }}>
          <div className="panel-head">
            <span className="eyebrow">个性化复习材料</span>
            <span className="tag accent">generated</span>
          </div>
          <div className="panel-body">
            <div className="prose">
              {generatedMaterial.review_article.split('\n').map((line, index) => <p key={index}>{line}</p>)}
            </div>
            <div className="card" style={{ marginTop: 22, padding: 16, background: 'var(--bg-soft)' }}>
              <div className="row">
                <RefreshCw size={16} />
                <span className="dim tiny">
                  基于 {generatedMaterial.analysis_summary.total_records} 次练习生成
                  {generatedMaterial.analysis_summary.focus_areas.length > 0
                    ? ` · 重点关注 ${generatedMaterial.analysis_summary.focus_areas.join('、')}`
                    : ''}
                </span>
              </div>
            </div>
            <div style={{ marginTop: 22 }}>
              <Link to={`/practice/${generatedMaterial.text_id}`} className="btn accent">开始练习这篇复习材料</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Review;
