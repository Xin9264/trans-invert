/* Practice page — typewriter + 3 compare-views */
const { useState: usePS, useEffect: useEffPS, useRef: useRefPS, useMemo: useMemoPS } = React;

function StreamingText({ text, speed = 18 }) {
  // char-by-char fade-in (smooth, not jumpy)
  const chars = useMemoPS(() => Array.from(text), [text]);
  const [n, setN] = usePS(0);
  useEffPS(() => {
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= chars.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <div className="stream">
      {chars.slice(0, n).map((c, i) => (
        <span key={i} className="ch" style={{ animationDelay: '0ms' }}>{c}</span>
      ))}
      {n < chars.length && <span className="caret"></span>}
    </div>
  );
}

function CompareSplit({ p }) {
  return (
    <div className="compare split">
      <div className="panel">
        <div className="panel-head">
          <span className="eyebrow">中文译文</span>
          <span className="tag">参考</span>
        </div>
        <div className="panel-body">
          <div className="prose zh">{p.zh.split('\n').map((s,i) => <p key={i}>{s}</p>)}</div>
        </div>
      </div>
      <div className="panel">
        <div className="panel-head">
          <span className="eyebrow">英文原文</span>
          <span className="tag">遮蔽中</span>
        </div>
        <div className="panel-body">
          <div className="prose">{p.source.split('\n').map((s,i) => <p key={i}>{s}</p>)}</div>
        </div>
      </div>
    </div>
  );
}

function CompareAlt({ p }) {
  return (
    <div className="compare alt">
      <div className="panel">
        <div className="panel-head"><span className="eyebrow">逐句对照</span><span className="tag">{p.pairs.length} 句</span></div>
        <div className="panel-body" style={{ padding: '8px 32px' }}>
          {p.pairs.map((pr, i) => (
            <div className="alt-pair" key={i}>
              <div className="zh"><span className="num">{String(i+1).padStart(2,'0')}</span>{pr.zh}</div>
              <div className="en"><span className="num">{String(i+1).padStart(2,'0')}</span>{pr.en}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompareLayered({ p }) {
  const [openIdx, setOpenIdx] = usePS(null);
  return (
    <div className="compare layered">
      <div className="panel">
        <div className="panel-head"><span className="eyebrow">原文为底 · 点击查看译文</span></div>
        <div className="panel-body layered-doc">
          {p.pairs.map((pr, i) => (
            <span
              key={i}
              className={'source-line' + (openIdx === i ? ' show' : '')}
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
            >
              {pr.en}{' '}
              {openIdx === i && (
                <span className="floating">{pr.zh}</span>
              )}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Practice({ onRoute }) {
  const p = window.MOCKS.MOCK_PASSAGE;
  const [mode, setMode] = usePS('study');     // study | practice | completed
  const [view, setView] = usePS('split');     // split | alt | layered
  const [input, setInput] = usePS('');
  const [submitting, setSubmitting] = usePS(false);
  const [progress, setProgress] = usePS(0);
  const taRef = useRefPS();

  const onSubmit = () => {
    if (!input.trim()) return;
    setSubmitting(true); setProgress(0);
    let pct = 0;
    const id = setInterval(() => {
      pct += 4 + Math.random() * 8;
      setProgress(Math.min(99, Math.round(pct)));
      if (pct >= 100) {
        clearInterval(id);
        setProgress(100);
        setTimeout(() => { setSubmitting(false); setMode('completed'); }, 250);
      }
    }, 80);
  };

  return (
    <div className="page">
      <div className="practice-head">
        <div>
          <button className="btn ghost sm" onClick={() => onRoute('home')} style={{ marginBottom: 8 }}>
            <Icon name="arrowL" size={13} /> 返回材料
          </button>
          <div className="eyebrow">№ 001 · The Economist</div>
          <h1>{p.title}</h1>
          <div className="meta">
            <span className="pips">{[1,2,3,4,5].map(i => <span key={i} className={'pip' + (i <= p.difficulty ? ' on' : '')}></span>)}</span>
            <span>难度 {p.difficulty}/5</span>
            <span>·</span>
            <span>{p.wordCount} 词</span>
            <span>·</span>
            <span>上次：{p.lastOpened}</span>
          </div>
        </div>
        <div className="actions">
          {mode === 'completed' && (
            <button className="btn" onClick={() => { setMode('study'); setInput(''); }}>
              <Icon name="rotate" size={14} /> 再来一次
            </button>
          )}
          {mode === 'practice' && (
            <button className="btn" onClick={() => setMode('study')}>
              <Icon name="arrowL" size={14} /> 返回学习
            </button>
          )}
          <div className="view-toggle" title="对照视图">
            <button aria-pressed={view==='split'}   onClick={() => setView('split')}><Icon name="columns" size={13} /> 双栏</button>
            <button aria-pressed={view==='alt'}     onClick={() => setView('alt')}><Icon name="rows" size={13} /> 句对</button>
            <button aria-pressed={view==='layered'} onClick={() => setView('layered')}><Icon name="layers" size={13} /> 浮层</button>
          </div>
          <button className="btn ghost"><Icon name="history" size={14} /> 历史回译</button>
        </div>
      </div>

      {mode === 'study' && (
        <>
          {view === 'split'   && <CompareSplit p={p} />}
          {view === 'alt'     && <CompareAlt p={p} />}
          {view === 'layered' && <CompareLayered p={p} />}

          <div className="section-head" style={{ marginTop: 36 }}>
            <div>
              <div className="eyebrow">Difficult words</div>
              <h2>难词与搭配</h2>
            </div>
            <div className="dim tiny">点击进入练习时这些词会被遮蔽</div>
          </div>
          <div className="card" style={{ padding: '8px 24px' }}>
            <div className="difficult-words">
              {p.difficultWords.map((w, i) => (
                <div className="dw" key={i}>
                  <div className="word">{w.word}</div>
                  <div className="meaning">{w.meaning}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
            <button className="btn accent lg" onClick={() => setMode('practice')}>
              <Icon name="play" size={14} /> 遮住原文，开始回译
            </button>
          </div>
        </>
      )}

      {mode === 'practice' && (
        <div className="compare split">
          <div className="panel">
            <div className="panel-head">
              <span className="eyebrow">中文译文 · 仅此可见</span>
              <span className="tag accent">回译模式</span>
            </div>
            <div className="panel-body">
              <div className="prose zh">{p.zh.split('\n').map((s,i) => <p key={i}>{s}</p>)}</div>
            </div>
          </div>
          <div className="panel typewriter-shell">
            <div className="panel-head">
              <span className="eyebrow">你的英文回译</span>
              <span className="tag">原文已遮蔽</span>
            </div>
            <div className="stats">
              <span className="stat"><strong>{input.length}</strong> chars</span>
              <span className="sep">·</span>
              <span className="stat"><strong>{input.trim() ? input.trim().split(/\s+/).length : 0}</strong> words</span>
              <span className="sep">·</span>
              <span className="stat">target ≈ <strong>{p.wordCount}</strong></span>
            </div>
            <textarea
              ref={taRef}
              className="tw-input"
              placeholder="Begin writing in English. Don't aim for perfect recall — aim for grammatical, natural prose that carries the meaning across…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={submitting}
            />
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line-soft)', display: 'flex', gap: 12, alignItems: 'center' }}>
              {submitting ? (
                <>
                  <div className="dim tiny">AI 正在比对你的版本与原文 …</div>
                  <div style={{ flex: 1 }}>
                    <div className="progress"><div className="bar" style={{ width: progress + '%' }}></div></div>
                  </div>
                  <span className="mono tiny dim">{progress}%</span>
                </>
              ) : (
                <>
                  <span className="dim tiny">⌘ + Enter 提交 · Esc 返回学习</span>
                  <div style={{ flex: 1 }}></div>
                  <button className="btn" onClick={() => setMode('study')}>放弃</button>
                  <button className="btn accent" onClick={onSubmit} disabled={!input.trim()}>
                    <Icon name="check" size={14} /> 提交回译
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'completed' && <Result p={p} userInput={input} onRoute={onRoute} onRestart={() => { setMode('study'); setInput(''); }} />}
    </div>
  );
}

function Result({ p, userInput, onRoute, onRestart }) {
  const fb = p.feedback;
  return (
    <>
      <div className="score-plate">
        <div className="score-big">{fb.score}<small> / 100</small></div>
        <div className="judge">
          <span className="label">AI 评价 · Streaming</span>
          <StreamingText text={fb.overall} speed={14} />
        </div>
      </div>

      <div className="compare split" style={{ marginTop: 28 }}>
        <div className="panel">
          <div className="panel-head"><span className="eyebrow">英文原文</span><span className="tag good">参考答案</span></div>
          <div className="panel-body">
            <div className="prose">{p.source.split('\n').map((s,i) => <p key={i}>{s}</p>)}</div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-head"><span className="eyebrow">你的回译</span><span className="tag accent">作答</span></div>
          <div className="panel-body">
            <div className="prose">{userInput.split('\n').map((s,i) => <p key={i}>{s || <span className="dim">…</span>}</p>)}</div>
          </div>
        </div>
      </div>

      <div className="section-head"><div><div className="eyebrow">Corrections</div><h2>修订建议 · {fb.corrections.length} 处</h2></div></div>

      <div className="correction-list">
        {fb.corrections.map((c, i) => (
          <div className="correction" key={i}>
            <div className="swap">
              <span className="from">{c.from}</span>
              <span className="arrow">→</span>
              <span className="to">{c.to}</span>
            </div>
            <div className="why">{c.why}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button className="btn" onClick={onRestart}><Icon name="rotate" size={14} /> 重新练习</button>
        <button className="btn accent" onClick={() => onRoute('home')}><Icon name="arrow" size={14} /> 下一篇</button>
      </div>
    </>
  );
}

window.Practice = Practice;
