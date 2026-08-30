import DecisionToolPage from '../_shared/DecisionToolPage';
import {
  createDecisionTree,
  deleteDecisionTree,
  getDecisionTree,
  listDecisionTrees,
  updateDecisionTree,
} from '@/api/tools';

const NODES_PLACEHOLDER = `[
  {
    "nodeId": "root",
    "leaf": false,
    "children": [
      { "condition": "amount >= 1000", "childNodeId": "high" },
      { "condition": "amount < 1000", "childNodeId": "low" }
    ]
  },
  { "nodeId": "high", "leaf": true, "decision": "MANUAL_REVIEW", "priority": 10 },
  { "nodeId": "low", "leaf": true, "decision": "AUTO_PASS", "priority": 1 }
]`;

/** 决策树配置页（S8）。 */
export default function DecisionTreesPage() {
  return (
    <DecisionToolPage
      title="决策树"
      queryKey="decision-trees"
      list={listDecisionTrees}
      create={createDecisionTree}
      get={getDecisionTree}
      update={updateDecisionTree}
      remove={deleteDecisionTree}
      hint="决策树：从根节点沿分支条件（Aviator 表达式）下钻，叶子节点输出决策。"
      extraFields={[
        { name: 'rootNodeId', label: '根节点 ID', required: true, placeholder: 'root' },
        {
          name: 'nodesJson',
          label: '节点（JSON 数组）',
          type: 'textarea',
          required: true,
          placeholder: NODES_PLACEHOLDER,
        },
      ]}
    />
  );
}
