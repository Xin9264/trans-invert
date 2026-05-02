import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, FolderPlus, Grid3X3, History, List, Move, Play, Trash2, Upload } from 'lucide-react';
import { folderAPI, textAPI, Folder as FolderType } from '../utils/api';
import { Text } from '../types';

const flattenFolders = (folders: FolderType[]): FolderType[] => (
  folders.flatMap((folder) => [folder, ...(folder.children ? flattenFolders(folder.children) : [])])
);

const difficultyPips = (difficulty: number) => (
  <span className="pips">
    {[1, 2, 3, 4, 5].map((level) => (
      <span key={level} className={`pip${level <= difficulty ? ' on' : ''}`} />
    ))}
  </span>
);

const Home: React.FC = () => {
  const [texts, setTexts] = useState<Text[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showMoveDropdown, setShowMoveDropdown] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [searchParams] = useSearchParams();

  const selectedFolderId = searchParams.get('folder');
  const allFolders = useMemo(() => flattenFolders(folders), [folders]);
  const selectedFolder = allFolders.find((folder) => folder.id === selectedFolderId);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    notification.className = 'toast';
    notification.style.background = type === 'success' ? 'var(--ink)' : 'var(--bad)';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2600);
  };

  const fetchFolders = async () => {
    try {
      const response = await folderAPI.getTree();
      if (response.success && response.data) setFolders(response.data);
    } catch (error) {
      console.error('获取文件夹失败:', error);
    }
  };

  const fetchTexts = async () => {
    try {
      const response = await textAPI.getAll(selectedFolderId || undefined);
      if (response.success && response.data) {
        const formattedTexts = response.data.map((item: any) => ({
          id: item.text_id,
          title: item.title,
          content: item.content || item.preview || '',
          difficultyLevel: item.difficulty || 0,
          wordCount: item.word_count,
          createdBy: '',
          createdAt: item.created_at,
          lastOpened: item.last_opened,
          type: 'translation' as const,
          folder_id: item.folder_id,
        }));
        formattedTexts.sort((a: Text, b: Text) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTexts(formattedTexts);
      }
    } catch (error) {
      console.error('获取材料失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchTexts();
    fetchFolders();
  }, [selectedFolderId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMoveDropdown && !(event.target as Element).closest('.move-dropdown-container')) {
        setShowMoveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoveDropdown]);

  const handleTextMove = async (textId: string, folderId: string | null) => {
    setIsMoving(textId);
    try {
      const response = await textAPI.moveToFolder(textId, folderId || undefined);
      if (response.success) {
        fetchTexts();
        setShowMoveDropdown(null);
        showNotification(response.message || '移动成功');
      } else {
        showNotification(response.error || '移动失败', 'error');
      }
    } catch (error) {
      console.error('移动文本失败:', error);
      showNotification('移动失败，请检查网络连接', 'error');
    } finally {
      setIsMoving(null);
    }
  };

  const handleDeleteMaterial = async (textId: string, title: string) => {
    if (!window.confirm(`确定要删除练习材料"${title}"吗？此操作不可撤销。`)) return;

    setIsDeletingId(textId);
    try {
      const response = await textAPI.deleteMaterial(textId);
      if (response.success) {
        setTexts((previous) => previous.filter((text) => text.id !== textId));
        showNotification(response.message || '删除成功');
      } else {
        showNotification(response.error || '删除失败', 'error');
      }
    } catch (error) {
      console.error('删除失败:', error);
      showNotification('删除失败，请稍后重试', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  const averageDifficulty = texts.length
    ? Math.round((texts.reduce((sum, text) => sum + text.difficultyLevel, 0) / texts.length) * 10) / 10
    : 0;
  const totalWords = texts.reduce((sum, text) => sum + text.wordCount, 0);

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="eyebrow">回译法 · Translation Inversion</span>
          <h1 style={{ marginTop: 14 }}>
            读英文，<br />
            写英文，<br />
            <em>重新认识每一个句子。</em>
          </h1>
          <p className="lede">
            Trans·invert 把一段英文遮住，让你看着中文翻译重新写回原文。AI 在你停笔时登场，对照原作，给出中肯的反馈。
          </p>
          <div className="hero-cta">
            <Link className="btn accent lg" to={texts[0] ? `/practice/${texts[0].id}` : '/upload'}>
              <Play size={14} /> {texts[0] ? '继续练习' : '上传第一篇'}
            </Link>
            <Link className="btn lg" to="/upload">
              <Upload size={14} /> 上传新文本
            </Link>
            <Link className="btn ghost lg" to="/history">
              <History size={14} /> 查看历史
            </Link>
          </div>
          <div className="hero-method">
            <span className="label">Method · 三步</span>
            读懂 → 遮蔽 → 复写。先把一段英文读到结构清楚，然后只看中文译文，把英文逐句还原。
            AI 把你的版本和原文并排比对，标出语法、搭配与语义偏差。
          </div>
        </div>

        <aside className="hero-aside">
          <dl>
            <dt>Materials</dt>
            <dd>{texts.length} pieces</dd>
            <dt>Words</dt>
            <dd>{totalWords.toLocaleString()}</dd>
            <dt>Avg. difficulty</dt>
            <dd><span className="accent">{averageDifficulty}</span> / 5</dd>
            <dt>Folder</dt>
            <dd>{selectedFolder?.name || 'All materials'}</dd>
            <dt>Mode</dt>
            <dd>Translation inversion</dd>
          </dl>
        </aside>
      </section>

      <div className="method-row">
        <div className="step">
          <span className="n">i.</span>
          <h4>Read closely</h4>
          <p>载入英文原文与 AI 生成的中文翻译，圈出难词与关键搭配。</p>
        </div>
        <div className="step">
          <span className="n">ii.</span>
          <h4>Cover &amp; rewrite</h4>
          <p>遮住原文，仅凭中文回译，训练句式、搭配与语气。</p>
        </div>
        <div className="step">
          <span className="n">iii.</span>
          <h4>Compare &amp; learn</h4>
          <p>AI 标记差异，提出修订建议，写入历史，留作复习。</p>
        </div>
      </div>

      <div className="section-head">
        <div>
          <div className="eyebrow">{selectedFolder?.name || '全部材料'}</div>
          <h2>{selectedFolder ? `${selectedFolder.name} 中的练习` : '所有练习材料'}</h2>
        </div>
        <div className="row">
          <div className="seg">
            <button aria-pressed={viewMode === 'card'} onClick={() => setViewMode('card')} type="button">
              <Grid3X3 size={13} style={{ verticalAlign: -2 }} /> 卡片
            </button>
            <button aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} type="button">
              <List size={13} style={{ verticalAlign: -2 }} /> 列表
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>
          <span className="dim">正在整理练习材料…</span>
        </div>
      ) : texts.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>
          <BookOpen size={36} style={{ margin: '0 auto 12px', color: 'var(--ink-4)' }} />
          <p className="dim" style={{ marginBottom: 18 }}>
            {selectedFolder ? '此文件夹暂无练习材料' : '还没有练习材料'}
          </p>
          <Link to="/upload" className="btn accent">
            <Upload size={14} /> 上传第一个文本
          </Link>
        </div>
      ) : (
        <div className={`materials${viewMode === 'list' ? ' list' : ''}`}>
          {texts.map((text, index) => (
            <article key={text.id} className="material">
              {viewMode === 'card' && <div className="corner" />}
              <div className="num">No. {String(index + 1).padStart(3, '0')}</div>
              <h3>
                <Link to={`/practice/${text.id}`}>{text.title || '未命名文本'}</Link>
              </h3>
              {viewMode === 'card' && (
                <p className="preview">
                  {text.content ? `${text.content.slice(0, 150)}…` : '打开练习后查看原文、译文与难词分析。'}
                </p>
              )}
              <div className="meta">
                <span className="stat">{difficultyPips(text.difficultyLevel)}</span>
                <span className="sep">·</span>
                <span className="stat">{text.wordCount} 词</span>
                <span className="sep">·</span>
                <span className="stat">{text.lastOpened ? new Date(text.lastOpened).toLocaleDateString('zh-CN') : '未打开'}</span>
                <span className="score-mini">{text.difficultyLevel}/5</span>
              </div>
              <div className="row" style={{ marginTop: 16 }}>
                <Link to={`/practice/${text.id}`} className="btn sm accent">
                  <Play size={13} /> 练习
                </Link>
                <div className="move-dropdown-container" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => setShowMoveDropdown(showMoveDropdown === text.id ? null : text.id)}
                    disabled={isMoving === text.id}
                  >
                    <Move size={13} /> {isMoving === text.id ? '移动中' : '移动'}
                  </button>
                  {showMoveDropdown === text.id && (
                    <div className="card" style={{ position: 'absolute', zIndex: 20, top: 'calc(100% + 6px)', left: 0, minWidth: 210, padding: 6 }}>
                      <button className="btn ghost sm w-full" type="button" onClick={() => handleTextMove(text.id, null)}>
                        <FolderPlus size={13} /> 移动到全部材料
                      </button>
                      {allFolders.map((folder) => (
                        <button key={folder.id} className="btn ghost sm w-full" type="button" onClick={() => handleTextMove(text.id, folder.id)}>
                          <FolderPlus size={13} /> {folder.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="spacer" />
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => handleDeleteMaterial(text.id, text.title || '未命名文本')}
                  disabled={isDeletingId === text.id}
                  title="删除此材料"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
