/* History page */
const { useState: useStateHist, useMemo: useMemoHist } = React;

function fmtDate(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return {
    day: pad(d.getDate()),
    month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()],
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

function Sparkline({ values, w = 220, h = 36 }) {
  const max = Math.max(...values), min = Math.min(...values);
  const span = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / span) * (h - 4) - 2}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - ((v - min) / span) * (h - 4) - 2} r="1.5" fill="var(--accent)" />
      ))}
    </svg>
  );
}

function History({ onRoute }) {
  const records = window.MOCKS.MOCK_HISTORY;
  const [filter, setFilter] = useStateHist('all');

  const stats = useMemoHist(() => {
    const total = records.length;
    const avg = Math.round(records.reduce((s, r) => s + r.score, 0) / total);
    const best = Math.max(...records.map(r => r.score));
    const words = records.reduce((s, r) => s + r.words, 0);
    return { total, avg, best, words };
  }, [records]);

  const trend = records.slice().reverse().map(r => r.score);
  const filtered = filter === 'all' ? records : records.filter(r => filter === 'good' ? r.ok : !r.ok);

  return (
    <div className="page">
      <div className="section-head" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="eyebrow">A record of every rewriting</div>
          <h2 className="page-title" style={{ marginTop: 6 }}>练习历史</h2>
          <p className="page-sub">每一次回译都被保留下来 —— 不是为了炫耀分数，而是为了让你看见自己写作的曲线。</p>
        </div>
        <div className="row">
          <button className="btn"><Icon name="download" size={14} /> 导出</button>
          <button className="btn"><Icon name="upload" size={14} /> 导入</button>
        </div>
      </div>

      <div className="stat-row" style={{ marginTop: 32 }}>
        <div className="stat">
          <div className="label">Sessions</div>
          <div className="value">{stats.total}</div>
          <div className="delta">+ 4 this week</div>
        </div>
        <div className="stat">
          <div className="label">Average</div>
          <div className="value">{stats.avg}<span className="unit">/100</span></div>
          <Sparkline values={trend} />
        </div>
        <div className="stat">
          <div className="label">Best score</div>
          <div className="value">{stats.best}</div>
          <div className="delta">A short note on autumn light</div>
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
          <button aria-pressed={filter==='all'}  onClick={() => setFilter('all')}>全部</button>
          <button aria-pressed={filter==='good'} onClick={() => setFilter('good')}>已通过</button>
          <button aria-pressed={filter==='bad'}  onClick={() => setFilter('bad')}>需改进</button>
        </div>
      </div>

      <div className="timeline">
        {filtered.map(r => {
          const d = fmtDate(r.dateISO);
          const cls = r.score >= 85 ? 'good' : r.score >= 70 ? 'warn' : 'bad';
          return (
            <div className="tl-row" key={r.id}>
              <div className="tl-date">
                <span className="dim tiny">{d.month}</span>
                <strong>{d.day}</strong>
                <span className="dim tiny">{d.time}</span>
              </div>
              <div className="tl-card" onClick={() => onRoute('practice')}>
                <div className="head">
                  <h4>{r.title}</h4>
                  <span className={'score ' + cls}>{r.score}</span>
                </div>
                <div className="row-meta">
                  <span className="tag">回译</span>
                  <span>{r.words} 词</span>
                  <span>·</span>
                  <span className={r.ok ? 'tag good' : 'tag bad'}>{r.ok ? '通过' : '需改进'}</span>
                </div>
                <div className="preview">「{r.preview}」</div>
                <div className="feedback">— {r.feedback}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.History = History;
