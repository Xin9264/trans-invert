import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Network, RefreshCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import GrammarTree from '../components/grammar-map/GrammarTree';
import NodeDetailPanel from '../components/grammar-map/NodeDetailPanel';
import { grammarMapAPI, GrammarMapNode, GrammarMapResponse, NodeExamplesResponse } from '../utils/api';

const flattenNodes = (node: GrammarMapNode): GrammarMapNode[] => [
  node,
  ...node.children.flatMap((child) => flattenNodes(child)),
];

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const GrammarMap: React.FC = () => {
  const [data, setData] = useState<GrammarMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<NodeExamplesResponse | null>(null);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false);
  const [examplesError, setExamplesError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const loadMap = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await grammarMapAPI.getMap();
      if (!response.success || !response.data) {
        throw new Error(response.error || response.message || '语法地图加载失败');
      }
      setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '语法地图加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMap();
  }, []);

  const summary = useMemo(() => {
    if (!data) return { weak: 0, warning: 0, unseen: 0, leaves: 0 };
    const leaves = flattenNodes(data.tree).filter((node) => !node.children.length);
    return {
      weak: leaves.filter((node) => node.stats.mastery === 'weak').length,
      warning: leaves.filter((node) => node.stats.mastery === 'warning').length,
      unseen: leaves.filter((node) => node.stats.mastery === 'unseen').length,
      leaves: leaves.length,
    };
  }, [data]);

  const nodesById = useMemo(() => {
    if (!data) return new Map<string, GrammarMapNode>();
    return new Map(flattenNodes(data.tree).map((node) => [node.id, node]));
  }, [data]);

  const selectedNodeId = searchParams.get('node') || data?.tree.id || 'root';
  const selectedNode = nodesById.get(selectedNodeId) || data?.tree || null;

  const selectNode = (nodeId: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('node', nodeId);
    setSearchParams(params);
  };

  useEffect(() => {
    if (!selectedNode) return;

    let cancelled = false;
    const loadExamples = async () => {
      setIsLoadingExamples(true);
      setExamplesError(null);
      try {
        const response = await grammarMapAPI.getExamples(selectedNode.id, { limit: 20 });
        if (!response.success || !response.data) {
          throw new Error(response.error || response.message || '错误样例加载失败');
        }
        if (!cancelled) setExamples(response.data);
      } catch (err) {
        if (!cancelled) setExamplesError(err instanceof Error ? err.message : '错误样例加载失败');
      } finally {
        if (!cancelled) setIsLoadingExamples(false);
      }
    };

    loadExamples();
    return () => {
      cancelled = true;
    };
  }, [selectedNode]);

  if (isLoading) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 36, textAlign: 'center' }}>正在读取语法地图…</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="section-head" style={{ marginTop: 0, borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <div className="eyebrow">Grammar Tree Map</div>
          <h2 className="page-title" style={{ marginTop: 6 }}>语法地图</h2>
          <p className="page-sub">把历史纠错按语法体系聚合，定位高频错误和最近升温的语言点。</p>
        </div>
        <button className="btn" type="button" onClick={loadMap}>
          <RefreshCcw size={14} /> 刷新
        </button>
      </div>

      {error && (
        <div className="card" style={{ padding: 20, marginTop: 28, color: 'var(--bad)' }}>
          <div className="row">
            <AlertTriangle size={17} />
            <span className="ff-sans tiny" style={{ fontWeight: 600 }}>{error}</span>
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="stat-row" style={{ marginTop: 32 }}>
            <div className="stat">
              <div className="label">Practices</div>
              <div className="value">{data.total_practices}</div>
              <div className="delta">参与聚合</div>
            </div>
            <div className="stat">
              <div className="label">Errors</div>
              <div className="value">{data.total_errors}</div>
              <div className="delta">结构化纠错</div>
            </div>
            <div className="stat">
              <div className="label">Weak</div>
              <div className="value">{summary.weak}</div>
              <div className="delta down">高频或严重</div>
            </div>
            <div className="stat">
              <div className="label">Last error</div>
              <div className="value" style={{ fontSize: 24 }}>{formatDateTime(data.tree.stats.last_error_at)}</div>
              <div className="delta">{summary.warning} warning · {summary.unseen}/{summary.leaves} unseen</div>
            </div>
          </div>

          <div className="grammar-map-layout">
            <div className="grammar-tree-panel">
              <div className="grammar-panel-head">
                <Network size={17} />
                <div>
                  <div className="eyebrow">Tree</div>
                  <h3>English Grammar</h3>
                </div>
              </div>
              <GrammarTree
                root={data.tree}
                selectedNodeId={selectedNode?.id || data.tree.id}
                onSelect={selectNode}
              />
            </div>

            {selectedNode && (
              <NodeDetailPanel
                node={selectedNode}
                examples={examples}
                isLoadingExamples={isLoadingExamples}
                examplesError={examplesError}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default GrammarMap;
