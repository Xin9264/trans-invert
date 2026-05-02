import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { ErrorExample, GrammarMapNode, NodeExamplesResponse } from '../../utils/api';

interface NodeDetailPanelProps {
  node: GrammarMapNode;
  examples: NodeExamplesResponse | null;
  isLoadingExamples: boolean;
  examplesError: string | null;
}

const severityLabels: Record<string, string> = {
  critical: '严重',
  major: '明显',
  minor: '轻微',
};

const sourceLabels: Record<string, string> = {
  L1_transfer: '母语迁移',
  overgeneralization: '过度泛化',
  intralingual: '语内混淆',
  performance_slip: '偶发失误',
};

const masteryClass = (mastery: string) => {
  if (mastery === 'weak') return 'bad';
  if (mastery === 'warning') return 'warn';
  if (mastery === 'stable') return 'good';
  return '';
};

const formatDateTime = (value: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const totalCount = (values: Record<string, number>) => (
  Object.values(values).reduce((sum, value) => sum + value, 0)
);

const DistributionBars: React.FC<{
  title: string;
  values: Record<string, number>;
  labels: Record<string, string>;
}> = ({ title, values, labels }) => {
  const total = totalCount(values);
  const entries = Object.entries(values);

  return (
    <div className="grammar-distribution">
      <h4>{title}</h4>
      {entries.map(([key, value]) => {
        const pct = total ? Math.round((value / total) * 100) : 0;
        return (
          <div className="grammar-bar-row" key={key}>
            <div className="grammar-bar-label">
              <span>{labels[key] || key}</span>
              <strong>{value}</strong>
            </div>
            <div className="grammar-bar">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ExampleItem: React.FC<{ example: ErrorExample }> = ({ example }) => (
  <div className="grammar-example">
    <div className="grammar-example-head">
      <div>
        <h4>{example.text_title}</h4>
        <span>{formatDateTime(example.timestamp)}</span>
      </div>
      <Link to={`/history?record=${encodeURIComponent(example.history_id)}`} className="btn ghost sm">
        <ExternalLink size={13} /> 历史
      </Link>
    </div>
    <div className="grammar-correction-swap">
      <span className="from">{example.correction.original || '—'}</span>
      <span className="arrow">→</span>
      <span className="to">{example.correction.suggestion || '—'}</span>
    </div>
    <p>{example.correction.reason}</p>
    <div className="grammar-example-tags">
      <span className={`tag ${example.correction.severity === 'critical' ? 'bad' : example.correction.severity === 'major' ? 'warn' : ''}`}>
        {severityLabels[example.correction.severity] || example.correction.severity}
      </span>
      <span className="tag">{sourceLabels[example.correction.source] || example.correction.source}</span>
      <span className="tag accent">{example.correction.category}</span>
    </div>
    {example.user_input_snippet && <div className="grammar-snippet">「{example.user_input_snippet}」</div>}
  </div>
);

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  examples,
  isLoadingExamples,
  examplesError,
}) => (
  <div className="grammar-detail-panel">
    <div className="grammar-panel-head">
      <div>
        <div className="eyebrow">Selected Node</div>
        <h3>{node.label}</h3>
      </div>
      <span className={`tag ${masteryClass(node.stats.mastery)}`}>{node.stats.mastery}</span>
    </div>

    <div className="grammar-detail-grid">
      <div>
        <span>累计错误</span>
        <strong>{node.stats.error_count}</strong>
      </div>
      <div>
        <span>近 7 天</span>
        <strong>{node.stats.trend_7d}</strong>
      </div>
      <div>
        <span>近 30 天</span>
        <strong>{node.stats.trend_30d}</strong>
      </div>
      <div>
        <span>最近出错</span>
        <strong>{formatDateTime(node.stats.last_error_at)}</strong>
      </div>
    </div>

    {node.tip && <p className="grammar-node-tip">{node.tip}</p>}

    <div className="grammar-detail-section">
      <DistributionBars title="严重程度" values={node.stats.by_severity} labels={severityLabels} />
      <DistributionBars title="错误来源" values={node.stats.by_source} labels={sourceLabels} />
    </div>

    <div className="grammar-examples-section">
      <div className="grammar-examples-head">
        <div>
          <div className="eyebrow">Examples</div>
          <h3>错误样例</h3>
        </div>
        <span className="tag">{examples?.total ?? 0}</span>
      </div>

      {isLoadingExamples && <div className="grammar-empty">正在读取样例…</div>}
      {examplesError && <div className="grammar-empty bad">{examplesError}</div>}
      {!isLoadingExamples && !examplesError && examples?.examples.length === 0 && (
        <div className="grammar-empty">这个节点暂时没有错误样例。</div>
      )}
      {!isLoadingExamples && !examplesError && examples?.examples.map((example) => (
        <ExampleItem key={`${example.history_id}-${example.correction.original}-${example.timestamp}`} example={example} />
      ))}
    </div>
  </div>
);

export default NodeDetailPanel;
