import DecisionToolPage from '../_shared/DecisionToolPage';
import {
  createDecisionTable,
  deleteDecisionTable,
  getDecisionTable,
  listDecisionTables,
  updateDecisionTable,
} from '@/api/tools';

const COLUMNS_PLACEHOLDER = `[
  { "var": "amount", "source": "context" }
]`;

const ROWS_PLACEHOLDER = `[
  {
    "conditions": [
      { "var": "amount", "op": "GE", "value": 1000, "value2": null, "values": null }
    ],
    "decision": "REVIEW",
    "priority": 10
  }
]`;

/** 决策表配置页（S2）。 */
export default function DecisionTablesPage() {
  return (
    <DecisionToolPage
      title="决策表"
      queryKey="decision-tables"
      list={listDecisionTables}
      create={createDecisionTable}
      get={getDecisionTable}
      update={updateDecisionTable}
      remove={deleteDecisionTable}
      hint="决策表：输入变量列 + 条件行（每行一组条件 → 输出决策）。命中策略 FIRST=首行命中，COLLECT=全部命中参与聚合。"
      extraColumns={[{ title: '命中策略', dataIndex: 'hitPolicy', key: 'hitPolicy', width: 110 }]}
      extraFields={[
        {
          name: 'hitPolicy',
          label: '命中策略',
          type: 'select',
          required: true,
          options: [
            { value: 'FIRST', label: '首行命中（FIRST）' },
            { value: 'COLLECT', label: '全部命中（COLLECT）' },
          ],
        },
        {
          name: 'columnsJson',
          label: '输入列（JSON 数组）',
          type: 'textarea',
          required: true,
          placeholder: COLUMNS_PLACEHOLDER,
        },
        {
          name: 'rowsJson',
          label: '条件行（JSON 数组）',
          type: 'textarea',
          required: true,
          placeholder: ROWS_PLACEHOLDER,
        },
      ]}
    />
  );
}
