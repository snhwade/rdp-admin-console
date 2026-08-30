import type {
  AggregateFunction,
  Assoc2DTemplateConfig,
  DataFetchTemplateConfig,
  DiffTemplateConfig,
  ExpressionTemplateConfig,
  IndicatorTemplateConfig,
  IndicatorTemplateType,
  ListTemplateConfig,
  RatioTemplateConfig,
  StatsTemplateConfig,
  TemplateFilterCondition,
  TimeUnit,
} from './templates';

export interface CompiledIndicator {
  eventTypeCodes: string[];
  dimensions: string[];
  windowDays: number;
  sliceGranularity: 'MINUTE' | 'HOUR' | 'DAY';
  accScript: string;
  defaultValueStrategy: string;
  templateConfig: Record<string, unknown>;
}

export function timeToWindow(timeValue: number, timeUnit: TimeUnit): {
  windowDays: number;
  sliceGranularity: 'MINUTE' | 'HOUR' | 'DAY';
} {
  const v = Math.max(1, timeValue || 1);
  switch (timeUnit) {
    case 'MINUTE':
      return { windowDays: Math.min(365, Math.max(1, Math.ceil(v / 1440))), sliceGranularity: 'MINUTE' };
    case 'HOUR':
      return { windowDays: Math.min(365, Math.max(1, Math.ceil(v / 24))), sliceGranularity: 'HOUR' };
    case 'DAY':
    default:
      return { windowDays: Math.min(365, v), sliceGranularity: 'DAY' };
  }
}

function filterExpr(filters: TemplateFilterCondition[]): string {
  if (!filters.length) {
    return 'true';
  }
  return filters
    .filter((f) => f.field)
    .map((f) => {
      const field = f.field;
      const val = f.value;
      switch (f.operator) {
        case 'EQ':
          return `${field} == '${val}'`;
        case 'NE':
          return `${field} != '${val}'`;
        case 'GT':
          return `${field} > ${val}`;
        case 'GE':
          return `${field} >= ${val}`;
        case 'LT':
          return `${field} < ${val}`;
        case 'LE':
          return `${field} <= ${val}`;
        default:
          return 'true';
      }
    })
    .join(' && ') || 'true';
}

function aggregateAccScript(fn: AggregateFunction, objectField: string, matchExpr: string): string {
  switch (fn) {
    case 'COUNT':
    case 'DISTINCT_COUNT':
      return `current + (${matchExpr} ? 1 : 0)`;
    case 'SUM':
      return `current + (${matchExpr} ? (${objectField} != nil ? ${objectField} : 0) : 0)`;
    case 'AVG':
      return `current + (${matchExpr} ? (${objectField} != nil ? ${objectField} : 0) : 0)`;
    case 'MAX':
      return `math.max(current, ${matchExpr} && ${objectField} != nil ? ${objectField} : current)`;
    case 'MIN':
      return `current == 0 && ${matchExpr} && ${objectField} != nil ? ${objectField} : math.min(current, ${matchExpr} && ${objectField} != nil ? ${objectField} : current)`;
    default:
      return `current + (${matchExpr} ? 1 : 0)`;
  }
}

function compileStats(cfg: StatsTemplateConfig): CompiledIndicator {
  const { windowDays, sliceGranularity } = timeToWindow(cfg.timeValue, cfg.timeUnit);
  const matchExpr = filterExpr(cfg.filters);
  const accScript = aggregateAccScript(cfg.aggregateFunction, cfg.objectField || 'amount', matchExpr);
  return {
    eventTypeCodes: cfg.eventTypeCodes,
    dimensions: cfg.dimension ? [cfg.dimension] : [],
    windowDays,
    sliceGranularity,
    accScript,
    defaultValueStrategy: 'ZERO',
    templateConfig: { ...cfg },
  };
}

function compileRatio(cfg: RatioTemplateConfig): CompiledIndicator {
  const { windowDays, sliceGranularity } = timeToWindow(cfg.timeValue, cfg.timeUnit);
  const matchExpr = filterExpr(cfg.filters);
  const num = cfg.numeratorField || 'numerator';
  const den = cfg.denominatorField || 'denominator';
  return {
    eventTypeCodes: cfg.eventTypeCodes,
    dimensions: cfg.dimension ? [cfg.dimension] : [],
    windowDays,
    sliceGranularity,
    accScript: `let n = ${matchExpr} && ${num} != nil ? ${num} : 0; let d = ${matchExpr} && ${den} != nil ? ${den} : 0; d == 0 ? current : n / d`,
    defaultValueStrategy: 'ZERO',
    templateConfig: { ...cfg },
  };
}

function compileExpression(cfg: ExpressionTemplateConfig): CompiledIndicator {
  const { windowDays, sliceGranularity } = timeToWindow(cfg.timeValue, cfg.timeUnit);
  return {
    eventTypeCodes: cfg.eventTypeCodes,
    dimensions: cfg.dimension ? [cfg.dimension] : [],
    windowDays,
    sliceGranularity,
    accScript: cfg.expression?.trim() || 'current + 0',
    defaultValueStrategy: 'ZERO',
    templateConfig: { ...cfg },
  };
}

function compileDataFetch(cfg: DataFetchTemplateConfig): CompiledIndicator {
  const field = cfg.targetField || 'value';
  return {
    eventTypeCodes: cfg.eventTypeCodes,
    dimensions: cfg.dimension ? [cfg.dimension] : [],
    windowDays: 1,
    sliceGranularity: 'DAY',
    accScript: `${field} != nil ? ${field} : current`,
    defaultValueStrategy: 'MISSING',
    templateConfig: { ...cfg },
  };
}

function compileList(cfg: ListTemplateConfig): CompiledIndicator {
  const field = cfg.field || 'value';
  return {
    eventTypeCodes: cfg.eventTypeCodes,
    dimensions: cfg.dimension ? [cfg.dimension] : [],
    windowDays: 365,
    sliceGranularity: 'DAY',
    accScript: `${field} != nil && ${field} != '' ? 1 : 0`,
    defaultValueStrategy: 'ZERO',
    templateConfig: { ...cfg },
  };
}

function compileDiff(cfg: DiffTemplateConfig): CompiledIndicator {
  const left = cfg.leftField || 'leftValue';
  const right = cfg.rightField || 'rightValue';
  return {
    eventTypeCodes: cfg.eventTypeCodes,
    dimensions: cfg.dimension ? [cfg.dimension] : [],
    windowDays: 30,
    sliceGranularity: 'DAY',
    accScript: `${left} != nil && ${right} != nil ? math.abs(${left} - ${right}) : current`,
    defaultValueStrategy: 'ZERO',
    templateConfig: { ...cfg },
  };
}

function compileAssoc2D(cfg: Assoc2DTemplateConfig): CompiledIndicator {
  const { windowDays, sliceGranularity } = timeToWindow(cfg.timeValue, cfg.timeUnit);
  const dims = [cfg.dimension, cfg.primaryAssocField, cfg.secondaryAssocField].filter(Boolean);
  const accScript = aggregateAccScript(cfg.aggregateFunction, cfg.secondaryAssocField || 'value', 'true');
  return {
    eventTypeCodes: cfg.eventTypeCodes,
    dimensions: dims,
    windowDays,
    sliceGranularity,
    accScript,
    defaultValueStrategy: 'ZERO',
    templateConfig: { ...cfg },
  };
}

export function compileTemplate(
  type: IndicatorTemplateType,
  config: IndicatorTemplateConfig,
): CompiledIndicator {
  switch (type) {
    case 'COUNT':
    case 'AMOUNT':
    case 'GENERAL_STATS':
    case 'ASSOC_STATS':
      return compileStats(config as StatsTemplateConfig);
    case 'RATIO':
      return compileRatio(config as RatioTemplateConfig);
    case 'ARITHMETIC':
    case 'COMPOSITE':
      return compileExpression(config as ExpressionTemplateConfig);
    case 'DATA_FETCH':
      return compileDataFetch(config as DataFetchTemplateConfig);
    case 'LIST':
      return compileList(config as ListTemplateConfig);
    case 'TIME_DIFF':
    case 'DISTANCE_DIFF':
      return compileDiff(config as DiffTemplateConfig);
    case 'ASSOC_2D':
      return compileAssoc2D(config as Assoc2DTemplateConfig);
    default:
      return compileStats(config as StatsTemplateConfig);
  }
}

export function buildPreviewText(
  type: IndicatorTemplateType,
  config: IndicatorTemplateConfig,
  labels?: { dimension?: string; object?: string; fn?: string; time?: string },
): string {
  if (type === 'GENERAL_STATS' || type === 'COUNT' || type === 'AMOUNT' || type === 'ASSOC_STATS') {
    const c = config as StatsTemplateConfig;
    const dim = labels?.dimension ?? c.dimension ?? '维度';
    const time = labels?.time ?? `近${c.timeValue}${c.timeUnit === 'MINUTE' ? '分钟' : c.timeUnit === 'HOUR' ? '小时' : '天'}`;
    const obj = labels?.object ?? c.objectField ?? '对象';
    const fn = labels?.fn ?? c.aggregateFunction ?? '函数';
    return `${dim} ${time} 在适用事件的 ${obj} ${fn}（数据精准度：${c.timeUnit === 'DAY' ? '天' : '时间'}）`;
  }
  if (type === 'RATIO') {
    const c = config as RatioTemplateConfig;
    return `${c.dimension || '维度'} 近${c.timeValue}单位 ${c.numeratorField || '分子'} 占 ${c.denominatorField || '分母'} 的比例`;
  }
  if (type === 'DATA_FETCH') {
    const c = config as DataFetchTemplateConfig;
    return `获取 ${c.dimension || '维度'} 在适用事件的最新 ${c.targetField || '字段'} 信息`;
  }
  if (type === 'LIST') {
    const c = config as ListTemplateConfig;
    return `${c.dimension || '维度'} 的 ${c.field || '字段'} 是否在 ${c.listType} 名单中`;
  }
  if (type === 'TIME_DIFF' || type === 'DISTANCE_DIFF') {
    const c = config as DiffTemplateConfig;
    return `${c.dimension || '维度'} ${c.leftField} 与 ${c.rightField} 的${c.diffKind === 'TIME' ? '时间间隔' : '距离'}`;
  }
  if (type === 'ASSOC_2D') {
    const c = config as Assoc2DTemplateConfig;
    return `${c.dimension || '维度'} 近${c.timeValue}天 ${c.primaryAssocField} × ${c.secondaryAssocField} ${c.aggregateFunction}`;
  }
  const c = config as ExpressionTemplateConfig;
  return c.expression || '变量 + 运算符 + 变量';
}
