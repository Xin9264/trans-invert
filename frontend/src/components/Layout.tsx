import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Brain,
  ChevronRight,
  Download,
  Folder,
  FolderOpen,
  History,
  Home,
  Layers,
  Network,
  PanelLeft,
  Plus,
  Search,
  Settings,
  Upload,
} from 'lucide-react';
import { folderAPI, textAPI, Folder as FolderType } from '../utils/api';
import { useAIStatus } from '../hooks/useAIStatus';
import AIConfigModal from './AIConfigModal';

type TextSummary = {
  text_id: string;
  folder_id?: string | null;
};

const pageLabels: Record<string, string> = {
  '/': '首页',
  '/upload': '上传文本',
  '/history': '练习历史',
  '/review': '智能复习',
  '/grammar-map': '语法地图',
};

const countTextsInFolder = (folder: FolderType, texts: TextSummary[]): number => {
  const own = texts.filter((text) => text.folder_id === folder.id).length;
  const children = folder.children?.reduce((sum, child) => sum + countTextsInFolder(child, texts), 0) ?? 0;
  return own + children;
};

const flattenFolders = (folders: FolderType[]): FolderType[] => (
  folders.flatMap((folder) => [folder, ...(folder.children ? flattenFolders(folder.children) : [])])
);

const Layout: React.FC = () => {
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [texts, setTexts] = useState<TextSummary[]>([]);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { loading, refresh, isConfigured } = useAIStatus();

  const selectedFolderId = searchParams.get('folder');
  const allFolders = useMemo(() => flattenFolders(folders), [folders]);
  const selectedFolder = allFolders.find((folder) => folder.id === selectedFolderId);

  useEffect(() => {
    document.body.setAttribute('data-direction', 'manuscript');
    document.body.setAttribute('data-theme', 'light');
    document.body.style.setProperty('--body-ff', 'var(--ff-serif)');
    document.body.style.setProperty('--body-fs', '16px');
    document.body.style.setProperty('--body-lh', '1.7');
  }, []);

  useEffect(() => {
    const loadNavigationData = async () => {
      try {
        const [folderResponse, textResponse] = await Promise.all([
          folderAPI.getTree(),
          textAPI.getAll(),
        ]);

        if (folderResponse.success && folderResponse.data) {
          setFolders(folderResponse.data);
          const initiallyOpen = flattenFolders(folderResponse.data).reduce<Record<string, boolean>>((acc, folder) => {
            if (folder.children?.length) acc[folder.id] = true;
            return acc;
          }, {});
          setOpenFolders(initiallyOpen);
        }

        if (textResponse.success && textResponse.data) {
          setTexts(textResponse.data);
        }
      } catch (error) {
        console.error('加载导航数据失败:', error);
      }
    };

    loadNavigationData();
  }, []);

  const currentLabel = location.pathname.startsWith('/practice')
    ? '练习'
    : pageLabels[location.pathname] ?? '首页';

  const selectFolder = (folderId: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (folderId) {
      params.set('folder', folderId);
    } else {
      params.delete('folder');
    }
    setSearchParams(params);
    if (location.pathname !== '/') navigate({ pathname: '/', search: params.toString() });
  };

  const createFolder = async () => {
    const name = window.prompt('新文件夹名称');
    if (!name?.trim()) return;

    try {
      const response = await folderAPI.create({ name: name.trim() });
      if (response.success) {
        const folderResponse = await folderAPI.getTree();
        if (folderResponse.success && folderResponse.data) setFolders(folderResponse.data);
      } else {
        window.alert(response.error || response.message || '创建失败');
      }
    } catch (error) {
      console.error('创建文件夹失败:', error);
      window.alert('创建失败，请稍后重试');
    }
  };

  const renderFolder = (folder: FolderType, depth = 0): React.ReactNode => {
    const hasChildren = !!folder.children?.length;
    const isOpen = openFolders[folder.id];
    const active = selectedFolderId === folder.id;
    const count = countTextsInFolder(folder, texts);

    return (
      <div key={folder.id}>
        <button
          type="button"
          className="folder-row w-full"
          data-active={active || undefined}
          data-open={isOpen || undefined}
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={() => selectFolder(folder.id)}
        >
          <span
            className="twirl"
            onClick={(event) => {
              event.stopPropagation();
              if (hasChildren) setOpenFolders((state) => ({ ...state, [folder.id]: !state[folder.id] }));
            }}
          >
            {hasChildren ? <ChevronRight size={11} /> : null}
          </span>
          {hasChildren && isOpen ? <FolderOpen size={14} className="ficon" /> : <Folder size={14} className="ficon" />}
          <span className="name">{folder.name}</span>
          <span className="count">{count}</span>
        </button>
        {hasChildren && (
          <div className={`folder-children${isOpen ? '' : ' collapsed'}`}>
            {folder.children?.map((child) => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sb-head">
          <Link to="/" className="brand" onClick={() => selectFolder(null)}>
            <span className="mark">Ti</span>
            <div>
              <div>Trans·invert</div>
              <small>回译练习 · v2</small>
            </div>
          </Link>
          <button className="icon-btn" title="侧边栏" type="button">
            <PanelLeft size={16} />
          </button>
        </div>

        <nav className="sb-nav">
          <NavLink to="/" end className="sb-link">
            <Home size={16} />
            <span>首页</span>
            <span className="count">{texts.length}</span>
          </NavLink>
          <NavLink to="/upload" className="sb-link">
            <Upload size={16} />
            <span>上传文本</span>
          </NavLink>
          <NavLink to="/review" className="sb-link">
            <Brain size={16} />
            <span>智能复习</span>
          </NavLink>
          <NavLink to="/grammar-map" className="sb-link">
            <Network size={16} />
            <span>语法地图</span>
          </NavLink>
          <NavLink to="/history" className="sb-link">
            <History size={16} />
            <span>历史</span>
          </NavLink>
        </nav>

        <div className="sb-section">
          <span className="eyebrow">文件夹</span>
          <button className="icon-btn" title="新建文件夹" type="button" onClick={createFolder}>
            <Plus size={14} />
          </button>
        </div>

        <div className="folder-tree">
          <button
            type="button"
            className="folder-row w-full"
            data-active={selectedFolderId === null || undefined}
            onClick={() => selectFolder(null)}
          >
            <span className="twirl" />
            <Layers size={14} className="ficon" />
            <span className="name">全部材料</span>
            <span className="count">{texts.length}</span>
          </button>
          {folders.map((folder) => renderFolder(folder))}
        </div>

        <div className="sb-foot">
          <span className={`dot ${isConfigured ? '' : 'bad'}`} />
          <div className="ai-status">
            <div>
              <div style={{ color: 'var(--ink)', fontWeight: 500 }}>
                {isConfigured ? 'AI 已配置' : 'AI 未配置'}
              </div>
              <div className="dim tiny">DeepSeek · local</div>
            </div>
          </div>
          <button
            className="icon-btn"
            title="AI 服务配置"
            style={{ marginLeft: 'auto' }}
            type="button"
            onClick={() => setShowAIConfig(true)}
          >
            {isConfigured ? <Settings size={15} /> : <AlertTriangle size={15} />}
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="crumbs">
            <span>Trans·invert</span>
            <span className="sep">/</span>
            <strong>{currentLabel}</strong>
            {location.pathname === '/' && selectedFolder && (
              <>
                <span className="sep">/</span>
                <span>{selectedFolder.name}</span>
              </>
            )}
          </div>
          <div className="search">
            <Search size={14} />
            <input placeholder="搜索材料、历史、文件夹…" />
            <kbd>⌘K</kbd>
          </div>
          <div className="actions">
            <Link to="/history" className="btn ghost sm">
              <Download size={14} /> 导出
            </Link>
            <Link to="/upload" className="btn primary sm">
              <Upload size={14} /> 新建练习
            </Link>
          </div>
        </div>

        {!loading && !isConfigured && (
          <div style={{ padding: '12px 32px', borderBottom: '1px solid var(--line-soft)', background: 'var(--bad-soft)' }}>
            <div className="row" style={{ color: 'var(--bad)' }}>
              <AlertTriangle size={17} />
              <span className="ff-sans tiny" style={{ fontWeight: 600 }}>AI服务未配置，分析与反馈功能可能无法正常使用</span>
              <span className="spacer" />
              <button className="btn sm" type="button" onClick={() => setShowAIConfig(true)}>立即配置</button>
            </div>
          </div>
        )}

        <Outlet />
      </main>

      <AIConfigModal
        isOpen={showAIConfig}
        onClose={() => setShowAIConfig(false)}
        onConfigured={refresh}
      />
    </div>
  );
};

export default Layout;
