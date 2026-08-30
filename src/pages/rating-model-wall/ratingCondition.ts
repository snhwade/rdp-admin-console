/** 条件运算符：用于从字段 + 值构建 Aviator 表达式。 */
export type ConditionOperator = 'EQ' | 'NE' | 'GT' | 'GE' | 'LT' | 'LE' | 'CUSTOM';

export const CONDITION_OPERATOR_OPTIONS: { label: string; value: ConditionOperator }[] = [
  { label: '等于', value: 'EQ' },
  { label: '不等于', value: 'NE' },
  { label: '大于', value: 'GT' },
  { label: '大于等于', value: 'GE' },
  { label: '小于', value: 'LT' },
  { label: '小于等于', value: 'LE' },
  { label: '自定义表达式', value: 'CUSTOM' },
];

function formatLiteral(value: string): string {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed === 'true' || trimmed === 'false') {
    return trimmed;
  }
  return `'${trimmed.replace(/'/g, "\\'")}'`;
}

/** 由字段与条件值构建表达式。 */
export function buildFieldCondition(
  fieldCode: string,
  operator: ConditionOperator,
  value: string,
): string {
  if (operator === 'CUSTOM') {
    return value.trim();
  }
  const lit = formatLiteral(value);
  switch (operator) {
    case 'EQ':
      return `${fieldCode} == ${lit}`;
    case 'NE':
      return `${fieldCode} != ${lit}`;
    case 'GT':
      return `${fieldCode} > ${lit}`;
    case 'GE':
      return `${fieldCode} >= ${lit}`;
    case 'LT':
      return `${fieldCode} < ${lit}`;
    case 'LE':
      return `${fieldCode} <= ${lit}`;
    default:
      return value.trim();
  }
}

/** 尝试从已有表达式反解表单字段（失败则回退为自定义表达式）。 */
export function parseFieldCondition(condition?: string | null): {
  operator: ConditionOperator;
  value: string;
} {
  const raw = (condition ?? '').trim();
  if (!raw) {
    return { operator: 'EQ', value: '' };
  }
  const match = raw.match(/^([\w$.]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (!match) {
    return { operator: 'CUSTOM', value: raw };
  }
  const opToken = match[2];
  let value = match[3].trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    value = value.slice(1, -1);
  }
  const opMap: Record<string, ConditionOperator> = {
    '==': 'EQ',
    '!=': 'NE',
    '>': 'GT',
    '>=': 'GE',
    '<': 'LT',
    '<=': 'LE',
  };
  return { operator: opMap[opToken] ?? 'CUSTOM', value: opToken in opMap ? value : raw };
}
