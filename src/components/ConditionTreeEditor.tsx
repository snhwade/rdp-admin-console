import { Button, Input, Select, Space, Typography } from 'antd';
import type {
  ConditionDataType,
  ConditionNode,
  ConditionOperator,
} from '@/api/console';

const { Text } = Typography;

const DATA_TYPE_OPTIONS: { label: string; value: ConditionDataType }[] = [
  { label: '数值', value: 'NUMBER' },
  { label: '字符串', value: 'STRING' },
  { label: '布尔', value: 'BOOLEAN' },
  { label: '日期', value: 'DATE' },
  { label: '集合', value: 'COLLECTION' },
];

const OPERATOR_OPTIONS: { label: string; value: ConditionOperator }[] = [
  { label: '>', value: 'GT' },
  { label: '>=', value: 'GTE' },
  { label: '<', value: 'LT' },
  { label: '<=', value: 'LTE' },
  { label: '=', value: 'EQ' },
  { label: '≠', value: 'NEQ' },
  { label: '包含', value: 'CONTAINS' },
  { label: '前缀', value: 'STARTS_WITH' },
  { label: 'IN', value: 'IN' },
  { label: 'NOT IN', value: 'NOT_IN' },
];

const GROUP_OPS = [
  { label: 'AND（且）', value: 'AND' },
  { label: 'OR（或）', value: 'OR' },
] as const;

export function defaultConditionTree(): ConditionNode {
  return {
    op: 'AND',
    children: [
      {
        op: 'LEAF',
        left: { source: 'FIELD', ref: '', dataType: 'NUMBER' },
        operator: 'GT',
        right: { kind: 'CONST', value: 0 },
      },
    ],
  };
}

function parseConstValue(dataType: ConditionDataType, raw: string): unknown {
  if (dataType === 'NUMBER') {
    return Number(raw);
  }
  if (dataType === 'BOOLEAN') {
    return raw === 'true';
  }
  return raw;
}

function constValueToString(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value);
}

interface LeafEditorProps {
  node: ConditionNode;
  onChange: (next: ConditionNode) => void;
  onRemove?: () => void;
}

function LeafEditor({ node, onChange, onRemove }: LeafEditorProps) {
  const left = node.left ?? { source: 'FIELD', ref: '', dataType: 'NUMBER' as ConditionDataType };
  const operator = node.operator ?? 'GT';
  const rawValue = constValueToString(node.right?.value);

  const updateLeaf = (patch: Partial<ConditionNode>) => {
    onChange({ ...node, op: 'LEAF', ...patch });
  };

  return (
    <Space wrap align="start" style={{ marginBottom: 8 }}>
      <Input
        placeholder="字段名"
        value={left.ref}
        onChange={(e) =>
          updateLeaf({ left: { ...left, ref: e.target.value } })
        }
        style={{ width: 140 }}
      />
      <Select
        value={left.dataType}
        options={DATA_TYPE_OPTIONS}
        onChange={(v) => updateLeaf({ left: { ...left, dataType: v } })}
        style={{ width: 110 }}
      />
      <Select
        value={operator}
        options={OPERATOR_OPTIONS}
        onChange={(v) => updateLeaf({ operator: v })}
        style={{ width: 100 }}
      />
      <Input
        placeholder="常量值"
        value={rawValue}
        onChange={(e) =>
          updateLeaf({
            right: {
              kind: 'CONST',
              value: parseConstValue(left.dataType, e.target.value),
            },
          })
        }
        style={{ width: 120 }}
      />
      {onRemove ? (
        <Button type="link" danger onClick={onRemove}>删除</Button>
      ) : null}
    </Space>
  );
}

interface GroupEditorProps {
  node: ConditionNode;
  onChange: (next: ConditionNode) => void;
  depth?: number;
}

function GroupEditor({ node, onChange, depth = 0 }: GroupEditorProps) {
  const op = node.op === 'OR' ? 'OR' : 'AND';
  const children = node.children ?? [];

  const setOp = (nextOp: 'AND' | 'OR') => {
    onChange({ ...node, op: nextOp, children });
  };

  const setChild = (index: number, child: ConditionNode) => {
    const next = [...children];
    next[index] = child;
    onChange({ ...node, op, children: next });
  };

  const removeChild = (index: number) => {
    const next = children.filter((_, i) => i !== index);
    onChange({ ...node, op, children: next });
  };

  const addLeaf = () => {
    onChange({
      ...node,
      op,
      children: [
        ...children,
        {
          op: 'LEAF',
          left: { source: 'FIELD', ref: '', dataType: 'NUMBER' },
          operator: 'GT',
          right: { kind: 'CONST', value: 0 },
        },
      ],
    });
  };

  const addGroup = () => {
    onChange({
      ...node,
      op,
      children: [
        ...children,
        {
          op: 'AND',
          children: [
            {
              op: 'LEAF',
              left: { source: 'FIELD', ref: '', dataType: 'NUMBER' },
              operator: 'GT',
              right: { kind: 'CONST', value: 0 },
            },
          ],
        },
      ],
    });
  };

  return (
    <div
      style={{
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        background: depth % 2 === 0 ? '#fafafa' : '#fff',
      }}
    >
      <Space style={{ marginBottom: 8 }}>
        <Text strong>条件组</Text>
        <Select
          value={op}
          options={GROUP_OPS.map((g) => ({ label: g.label, value: g.value }))}
          onChange={setOp}
          style={{ width: 120 }}
        />
        <Button size="small" onClick={addLeaf}>添加条件</Button>
        <Button size="small" onClick={addGroup}>添加子组</Button>
      </Space>
      {children.length === 0 ? (
        <Text type="secondary">暂无条件，请添加</Text>
      ) : (
        children.map((child, index) => {
          if (child.op === 'LEAF') {
            return (
              <LeafEditor
                key={index}
                node={child}
                onChange={(next) => setChild(index, next)}
                onRemove={() => removeChild(index)}
              />
            );
          }
          return (
            <GroupEditor
              key={index}
              node={child}
              depth={depth + 1}
              onChange={(next) => setChild(index, next)}
            />
          );
        })
      )}
    </div>
  );
}

export interface ConditionTreeEditorProps {
  value: ConditionNode;
  onChange: (next: ConditionNode) => void;
}

/** 可嵌套 AND/OR 的条件树编辑器。 */
export default function ConditionTreeEditor({ value, onChange }: ConditionTreeEditorProps) {
  if (value.op === 'LEAF') {
    return <LeafEditor node={value} onChange={onChange} />;
  }
  return <GroupEditor node={value} onChange={onChange} />;
}
