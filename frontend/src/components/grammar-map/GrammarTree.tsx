import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { GrammarMapNode, MasteryLevel } from '../../utils/api';

interface GrammarTreeProps {
  root: GrammarMapNode;
  selectedNodeId: string;
  onSelect: (nodeId: string) => void;
}

const masteryLabel: Record<MasteryLevel, string> = {
  weak: '薄弱',
  warning: '留意',
  stable: '稳定',
  unseen: '未见',
};

const findPath = (node: GrammarMapNode, nodeId: string): string[] | null => {
  if (node.id === nodeId) return [node.id];
  for (const child of node.children) {
    const childPath = findPath(child, nodeId);
    if (childPath) return [node.id, ...childPath];
  }
  return null;
};

const collectBranchIds = (node: GrammarMapNode): string[] => [
  ...(node.children.length ? [node.id] : []),
  ...node.children.flatMap((child) => collectBranchIds(child)),
];

interface GrammarTreeNodeProps {
  node: GrammarMapNode;
  depth: number;
  expandedIds: Set<string>;
  selectedNodeId: string;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string) => void;
}

const GrammarTreeNode: React.FC<GrammarTreeNodeProps> = ({
  node,
  depth,
  expandedIds,
  selectedNodeId,
  onSelect,
  onToggle,
}) => {
  const hasChildren = node.children.length > 0;
  const isOpen = expandedIds.has(node.id);
  const isSelected = selectedNodeId === node.id;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' && hasChildren && !isOpen) {
      event.preventDefault();
      onToggle(node.id);
    }
    if (event.key === 'ArrowLeft' && hasChildren && isOpen) {
      event.preventDefault();
      onToggle(node.id);
    }
  };

  return (
    <div className="grammar-tree-node" role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
      <button
        type="button"
        className="grammar-tree-row"
        data-selected={isSelected || undefined}
        style={{ paddingLeft: 10 + depth * 18 }}
        onClick={() => onSelect(node.id)}
        onKeyDown={handleKeyDown}
      >
        <span
          className="grammar-tree-toggle"
          data-open={isOpen || undefined}
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
        >
          {hasChildren ? <ChevronRight size={13} /> : null}
        </span>
        <span className={`grammar-mastery-dot ${node.stats.mastery}`} title={masteryLabel[node.stats.mastery]} />
        <span className="grammar-tree-label">{node.label}</span>
        <span className="grammar-tree-count">{node.stats.error_count}</span>
      </button>
      {hasChildren && isOpen && (
        <div className="grammar-tree-children" role="group">
          {node.children.map((child) => (
            <GrammarTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const GrammarTree: React.FC<GrammarTreeProps> = ({ root, selectedNodeId, onSelect }) => {
  const initialExpanded = useMemo(() => new Set(collectBranchIds(root).slice(0, 2)), [root]);
  const [expandedIds, setExpandedIds] = useState(initialExpanded);

  useEffect(() => {
    const path = findPath(root, selectedNodeId);
    if (!path) return;
    setExpandedIds((current) => new Set([...current, ...path]));
  }, [root, selectedNodeId]);

  const toggleNode = (nodeId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  return (
    <div className="grammar-tree" role="tree" aria-label="Grammar map">
      <GrammarTreeNode
        node={root}
        depth={0}
        expandedIds={expandedIds}
        selectedNodeId={selectedNodeId}
        onSelect={onSelect}
        onToggle={toggleNode}
      />
    </div>
  );
};

export default GrammarTree;
