/* Layout shell: sidebar with folder tree + topbar */

const { useState, useMemo } = React;

function Sidebar({ route, onRoute, selectedFolderId, onSelectFolder }) {
  const [openFolders, setOpenFolders] = useState({ 'f-acad': true });
  const folders = window.MOCKS.MOCK_FOLDERS;
  const totalCount = folders.reduce((a, f) => a + f.count, 0);

  const renderFolder = (f, depth = 0) => {
    const open = openFolders[f.id];
    const active = selectedFolderId === f.id;
    const has = f.children && f.children.length > 0;
    return (
      <div key={f.id}>
        <div
          className="folder-row"
          data-active={active}
          data-open={open}
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={() => onSelectFolder(f.id)}
        >
          <span
            className="twirl"
            onClick={(e) => { e.stopPropagation(); if (has) setOpenFolders(s => ({ ...s, [f.id]: !s[f.id] })); }}
          >
            {has ? <Icon name="chevR" size={11} /> : null}
          </span>
          <Icon name={open && has ? 'folderOpen' : 'folder'} size={14} className="ficon" />
          <span className="name">{f.name}</span>
          <span className="count">{f.count}</span>
          <span className="row-actions">
            <button title="重命名" onClick={(e) => e.stopPropagation()}><Icon name="edit" size={12} /></button>
            <button title="删除" onClick={(e) => e.stopPropagation()}><Icon name="trash" size={12} /></button>
          </span>
        </div>
        {has && (
          <div className={'folder-children' + (open ? '' : ' collapsed')}>
            {f.children.map(c => renderFolder(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div className="sb-head">
        <div className="brand">
          <span className="mark">Ti</span>
          <div>
            <div>Trans·invert</div>
            <small>回译练习 · v2</small>
          </div>
        </div>
        <button className="icon-btn" title="收起侧边栏"><Icon name="sidebarToggle" size={16} /></button>
      </div>

      <nav className="sb-nav">
        {[
          { k: 'home', label: '首页',     icon: 'home' },
          { k: 'practice', label: '练习', icon: 'book', count: 1 },
          { k: 'history', label: '历史',  icon: 'history', count: 47 },
          { k: 'review', label: '智能复习', icon: 'brain' },
          { k: 'upload', label: '上传文本', icon: 'upload' },
        ].map(item => (
          <a key={item.k}
             className="sb-link"
             aria-current={route === item.k ? 'page' : undefined}
             onClick={() => onRoute(item.k)}>
            <Icon name={item.icon} size={16} />
            <span>{item.label}</span>
            {item.count != null && <span className="count">{item.count}</span>}
          </a>
        ))}
      </nav>

      <div className="sb-section">
        <span className="eyebrow">文件夹</span>
        <button className="icon-btn" title="新建文件夹"><Icon name="plus" size={14} /></button>
      </div>

      <div className="folder-tree">
        <div
          className="folder-row"
          data-active={selectedFolderId === null}
          onClick={() => onSelectFolder(null)}
        >
          <span className="twirl"></span>
          <Icon name="layers" size={14} className="ficon" />
          <span className="name">全部材料</span>
          <span className="count">{totalCount}</span>
        </div>
        {folders.map(f => renderFolder(f))}
      </div>

      <div className="sb-foot">
        <span className={'dot ' + (window.MOCKS.AI_STATUS.ok ? '' : 'bad')}></span>
        <div className="ai-status">
          <div>
            <div style={{ color: 'var(--ink)', fontWeight: 500 }}>{window.MOCKS.AI_STATUS.provider}</div>
            <div className="dim tiny">{window.MOCKS.AI_STATUS.requestsToday} req · today</div>
          </div>
        </div>
        <button className="icon-btn" title="AI 配置" style={{ marginLeft: 'auto' }}>
          <Icon name="settings" size={15} />
        </button>
      </div>
    </aside>
  );
}

function Topbar({ route, selectedFolderId }) {
  const folder = window.MOCKS.MOCK_FOLDERS.find(f => f.id === selectedFolderId)
    || window.MOCKS.MOCK_FOLDERS.flatMap(f => f.children || []).find(f => f.id === selectedFolderId);
  const labels = { home: '首页', history: '练习历史', practice: '练习', review: '智能复习', upload: '上传' };
  return (
    <div className="topbar">
      <div className="crumbs">
        <span>Trans·invert</span>
        <span className="sep">/</span>
        <strong>{labels[route] || '首页'}</strong>
        {route === 'home' && folder && (<>
          <span className="sep">/</span>
          <span>{folder.name}</span>
        </>)}
      </div>
      <div className="search">
        <Icon name="search" size={14} />
        <input placeholder="搜索材料、历史、文件夹…" />
        <kbd>⌘K</kbd>
      </div>
      <div className="actions">
        <button className="btn ghost sm"><Icon name="download" size={14} /> 导出</button>
        <button className="btn primary sm"><Icon name="upload" size={14} /> 新建练习</button>
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
