/* Home page */
const { useState: useStateH } = React;

function Home({ onRoute, selectedFolderId, onSelectFolder }) {
  const [view, setView] = useStateH('card');
  const all = window.MOCKS.MOCK_TEXTS;
  const folder = window.MOCKS.MOCK_FOLDERS.find(f => f.id === selectedFolderId)
    || window.MOCKS.MOCK_FOLDERS.flatMap(f => f.children || []).find(f => f.id === selectedFolderId);
  const texts = selectedFolderId
    ? all.filter(t => t.folder_id === selectedFolderId)
    : all;

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div>
          <span className="eyebrow">回译法 · Translation Inversion</span>
          <h1 style={{ marginTop: 14 }}>
            读英文，<br />
            写英文，<br />
            <em>重新认识每一个句子。</em>
          </h1>
          <p className="lede">
            Trans·invert 把一段英文遮住，让你看着中文翻译重新写回原文。
            AI 在你停笔时悄悄登场，对照原作，给出三句中肯的反馈 —— 不打分焦虑，只关心你下一次能不能写得更准。
          </p>
          <div className="hero-cta">
            <button className="btn accent lg" onClick={() => onRoute('practice')}>
              <Icon name="play" size={14} /> 继续上次练习
            </button>
            <button className="btn lg" onClick={() => onRoute('upload')}>
              <Icon name="upload" size={14} /> 上传新文本
            </button>
            <button className="btn ghost lg" onClick={() => onRoute('history')}>
              <Icon name="history" size={14} /> 查看历史
            </button>
          </div>
          <div className="hero-method">
            <span className="label">Method · 三步</span>
            读懂 → 遮蔽 → 复写。先把一段英文读到结构清楚，然后只看中文译文，把英文逐句还原。
            AI 把你写的版本和原文并排比对，标出语法、搭配与语义偏差。
          </div>
        </div>

        <aside className="hero-aside">
          <dl>
            <dt>This week</dt>            <dd>4 sessions</dd>
            <dt>Avg. score</dt>           <dd><span className="accent">82</span> / 100</dd>
            <dt>Best</dt>                 <dd>91 · Mrs Dalloway</dd>
            <dt>Streak</dt>               <dd>5 days</dd>
            <dt>Words written</dt>        <dd>1,847</dd>
          </dl>
        </aside>
      </section>

      {/* Method strip */}
      <div className="method-row">
        <div className="step">
          <span className="n">i.</span>
          <h4>Read closely</h4>
          <p>载入英文原文与 AI 生成的中文翻译，圈出难词与关键搭配。</p>
        </div>
        <div className="step">
          <span className="n">ii.</span>
          <h4>Cover &amp; rewrite</h4>
          <p>遮住原文，仅凭中文回译——三种对照视图任你切换。</p>
        </div>
        <div className="step">
          <span className="n">iii.</span>
          <h4>Compare &amp; learn</h4>
          <p>AI 标记差异，提出三条修订建议，写入历史，留作复习。</p>
        </div>
      </div>

      {/* Materials */}
      <div className="section-head">
        <div>
          <div className="eyebrow">{folder ? folder.name : '全部材料'}</div>
          <h2>{folder ? folder.name + ' 中的练习' : '所有练习材料'}</h2>
        </div>
        <div className="row">
          <div className="seg">
            <button aria-pressed={view === 'card'} onClick={() => setView('card')}>
              <Icon name="grid" size={13} style={{ verticalAlign: -2 }} /> 卡片
            </button>
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <Icon name="list" size={13} style={{ verticalAlign: -2 }} /> 列表
            </button>
          </div>
        </div>
      </div>

      <div className={'materials' + (view === 'list' ? ' list' : '')}>
        {texts.map(t => (
          <div key={t.id} className="material" onClick={() => onRoute('practice')}>
            {view === 'card' && <div className="corner"></div>}
            <div className="num">№ {t.num}</div>
            <h3>{t.title}</h3>
            {view === 'card' && <p className="preview">{t.preview}</p>}
            <div className="meta">
              <span className="stat">
                <span className="pips">
                  {[1,2,3,4,5].map(i => <span key={i} className={'pip' + (i <= t.difficulty ? ' on' : '')}></span>)}
                </span>
              </span>
              <span className="sep">·</span>
              <span className="stat">{t.wordCount} 词</span>
              <span className="sep">·</span>
              <span className="stat">练习 {t.attempts} 次</span>
              <span className="score-mini">{t.score}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Home = Home;
