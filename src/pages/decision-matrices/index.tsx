import DecisionToolPage from '../_shared/DecisionToolPage';
import {
  createDecisionMatrix,
  deleteDecisionMatrix,
  getDecisionMatrix,
  listDecisionMatrices,
  updateDecisionMatrix,
} from '@/api/tools';

const BINS_PLACEHOLDER = `[
  { "min": 0, "max": 40 },
  { "min": 40, "max": 100 }
]`;

const CELLS_PLACEHOLDER = `[
  { "row": 0, "col": 0, "decision": "AUTO_PASS", "priority": 1 },
  { "row": 0, "col": 1, "decision": "MANUAL_REVIEW", "priority": 5 },
  { "row": 1, "col": 0, "decision": "MANUAL_REVIEW", "priority": 5 },
  { "row": 1, "col": 1, "decision": "AUTO_REJECT", "priority": 10 }
]`;

/** 决策矩阵配置页（S9）。 */
export default function DecisionMatricesPage() {
  return (
    <DecisionToolPage
      title="决策矩阵"
      queryKey="decision-matrices"
      list={listDecisionMatrices}
      create={createDecisionMatrix}
      get={getDecisionMatrix}
      update={updateDecisionMatrix}
      remove={deleteDecisionMatrix}
      hint="决策矩阵：行维度区间 × 列维度区间 → 单元格决策。cells 使用 row/col 索引（从 0 起），对应 rowBins/colBins 的下标。"
      extraColumns={[
        { title: '行维度', dataIndex: 'rowVar', key: 'rowVar', width: 110 },
        { title: '列维度', dataIndex: 'colVar', key: 'colVar', width: 110 },
      ]}
      extraFields={[
        { name: 'rowVar', label: '行维度字段', required: true, placeholder: 'merchantRating' },
        {
          name: 'rowBinsJson',
          label: '行区间（JSON 数组）',
          type: 'textarea',
          required: true,
          placeholder: BINS_PLACEHOLDER,
        },
        { name: 'colVar', label: '列维度字段', required: true, placeholder: 'amount' },
        {
          name: 'colBinsJson',
          label: '列区间（JSON 数组）',
          type: 'textarea',
          required: true,
          placeholder: BINS_PLACEHOLDER,
        },
        {
          name: 'cellsJson',
          label: '单元格（JSON 数组）',
          type: 'textarea',
          required: true,
          placeholder: CELLS_PLACEHOLDER,
        },
      ]}
    />
  );
}
