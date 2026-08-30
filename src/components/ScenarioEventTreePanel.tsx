import { Input, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'react';
import { useMemo, useState } from 'react';
import { filterScenarioTree, scenarioTreeToDataNodes } from '@/utils/scenarioTree';
import type { ScenarioTreeNode } from '@/api/console';

const { Text } = Typography;

export interface ScenarioEventTreePanelProps {
  tree: ScenarioTreeNode[];
  loading?: boolean;
  selectedEventKey?: string | null;
  selectedScenarioKey?: string | null;
  onSelectEvent: (scenarioId: number | string, eventCode: string) => void;
  onSelectScenario?: (scenarioId: number | string) => void;
  scenarioSelectable?: boolean;
  title?: string;
}

/** 带搜索的业务场景 → 事件树侧栏（名称展示，编码悬浮可见）。 */
export default function ScenarioEventTreePanel({
  tree,
  loading,
  selectedEventKey,
  selectedScenarioKey,
  onSelectEvent,
  onSelectScenario,
  scenarioSelectable = false,
  title = '业务场景 → 事件',
}: ScenarioEventTreePanelProps) {
  const [keyword, setKeyword] = useState('');

  const filteredTree = useMemo(() => filterScenarioTree(tree, keyword), [tree, keyword]);
  const treeData: DataNode[] = useMemo(
    () => scenarioTreeToDataNodes(filteredTree, { scenarioSelectable }),
    [filteredTree, scenarioSelectable],
  );

  const selectedKeys = useMemo(() => {
    if (selectedEventKey) {
      return [selectedEventKey];
    }
    if (selectedScenarioKey) {
      return [selectedScenarioKey];
    }
    return [];
  }, [selectedEventKey, selectedScenarioKey]);

  const onSelect = (keys: Key[]) => {
    const key = keys[0]?.toString();
    if (!key) {
      return;
    }
    if (key.startsWith('event:')) {
      const parts = key.split(':');
      const scenarioId = parts[1];
      const code = parts.slice(2).join(':');
      onSelectEvent(scenarioId, code);
      return;
    }
    if (key.startsWith('scenario:') && onSelectScenario) {
      onSelectScenario(key.slice('scenario:'.length));
    }
  };

  return (
    <>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        {title}
      </Text>
      <Input.Search
        allowClear
        placeholder="搜索场景 / 事件"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      {loading ? (
        <Text type="secondary">加载中…</Text>
      ) : treeData.length === 0 ? (
        <Text type="secondary">{keyword.trim() ? '无匹配结果' : '暂无业务场景'}</Text>
      ) : (
        <Tree
          treeData={treeData}
          defaultExpandAll
          blockNode
          selectedKeys={selectedKeys}
          onSelect={onSelect}
        />
      )}
    </>
  );
}
