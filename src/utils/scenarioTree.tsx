import type { DataNode } from 'antd/es/tree';
import TreeNodeWithCodeHint from '@/components/CodeHintLabel';
import type { ScenarioTreeEvent, ScenarioTreeNode } from '@/api/console';

/** 按场景名/事件名/事件编码过滤场景树。 */
export function filterScenarioTree(tree: ScenarioTreeNode[], keyword: string): ScenarioTreeNode[] {
  const k = keyword.trim().toLowerCase();
  if (!k) {
    return tree;
  }
  return tree
    .map((s) => {
      const scenarioMatch =
        s.name.toLowerCase().includes(k) || s.code.toLowerCase().includes(k);
      const matchedEvents = s.events.filter(
        (e) => e.name.toLowerCase().includes(k) || e.code.toLowerCase().includes(k),
      );
      if (scenarioMatch) {
        return { ...s, events: s.events };
      }
      if (matchedEvents.length > 0) {
        return { ...s, events: matchedEvents };
      }
      return null;
    })
    .filter((s): s is ScenarioTreeNode => s != null);
}

/** 场景树 → Ant Design Tree 数据（节点仅展示名称，编码悬浮可见）。 */
export function scenarioTreeToDataNodes(
  tree: ScenarioTreeNode[],
  options?: { scenarioSelectable?: boolean },
): DataNode[] {
  const scenarioSelectable = options?.scenarioSelectable ?? false;
  return tree.map((s) => ({
    key: `scenario:${s.id}`,
    title: (
      <TreeNodeWithCodeHint
        label={`${s.name}（${s.events.length}）`}
        code={s.code}
      />
    ),
    selectable: scenarioSelectable,
    children: s.events.map((e: ScenarioTreeEvent) => ({
      key: `event:${s.id}:${e.code}`,
      title: <TreeNodeWithCodeHint label={e.name} code={e.code} />,
      selectable: true,
      isLeaf: true,
    })),
  }));
}
