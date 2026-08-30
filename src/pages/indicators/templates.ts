/** 指标模版类型（对齐指标模版体系）。 */
export type IndicatorTemplateType =
  | 'COUNT'
  | 'AMOUNT'
  | 'RATIO'
  | 'ARITHMETIC'
  | 'GENERAL_STATS'
  | 'DATA_FETCH'
  | 'COMPOSITE'
  | 'LIST'
  | 'TIME_DIFF'
  | 'DISTANCE_DIFF'
  | 'ASSOC_STATS'
  | 'ASSOC_2D';

export interface IndicatorTemplateMeta {
  type: IndicatorTemplateType;
  name: string;
  format: string;
  examples: string[];
  /** 是否使用通用统计配置页（维度+时间+对象+函数）。 */
  useStatsStepper?: boolean;
}

export interface IndicatorTemplateGroup {
  key: string;
  title: string;
  templates: IndicatorTemplateMeta[];
}

export const INDICATOR_TEMPLATE_GROUPS: IndicatorTemplateGroup[] = [
  {
    key: 'basic',
    title: '基础累计模版',
    templates: [
      {
        type: 'COUNT',
        name: '数量模版',
        format: '维度 + 时间 + (过滤条件) + 的累计次数',
        examples: [
          '同一商户过去x小时内，交易时间在1:00-3:00且返回码为55的交易次数',
          '同一商户过去1小时内，交易金额大于10000元的累计交易笔数',
        ],
        useStatsStepper: true,
      },
      {
        type: 'AMOUNT',
        name: '金额模版',
        format: '维度 + 时间 + (过滤条件) + 的累计交易金额',
        examples: [
          '同一商户过去1小时内的累计交易金额',
          '同一用户过去5天内，商品类目为虚拟商品的累计交易金额',
        ],
        useStatsStepper: true,
      },
      {
        type: 'RATIO',
        name: '占比模版',
        format: '分子 + 占 + 分母 + 的比例',
        examples: [
          '同一商户过去24小时内，贷记卡交易金额占该商户总交易金额的比例',
          '同一用户过去24小时内交易总额占近6个月日均交易总额的比例',
        ],
      },
      {
        type: 'ARITHMETIC',
        name: '四则运算模版',
        format: '变量 + 运算符 + 变量',
        examples: [
          '同一用户单日实物商品交易总额 - 近30日实物商品日均交易总额',
          '同一申请人近3个月通话频次前10联系人占通讯录总联系人数比例',
        ],
      },
    ],
  },
  {
    key: 'advanced',
    title: '高级统计模版',
    templates: [
      {
        type: 'GENERAL_STATS',
        name: '通用统计模版',
        format: '维度 + 时间 + (过滤条件) + 对象 + 函数',
        examples: [
          '同一商户过去1小时内，交易金额大于5000元且交易笔数大于2笔的银行卡数',
          '同一用户过去30天内，商品类目为虚拟商品的笔均交易金额',
        ],
        useStatsStepper: true,
      },
      {
        type: 'DATA_FETCH',
        name: '取数模版',
        format: '获取维度在适用事件的最新对象信息',
        examples: [
          '获取申请人用户在央行征信的最新逾期次数信息',
          '获取申请人用户在用户表的最新身份证号信息',
        ],
      },
      {
        type: 'COMPOSITE',
        name: '复合运算模版',
        format: '变量/常量 + 运算符 + 变量/常量',
        examples: [
          '同一用户单日实物商品交易总额 - 近30日实物商品日均交易总额',
          '同一申请人近3个月通话频次前10联系人占通讯录总联系人数比例',
        ],
      },
      {
        type: 'LIST',
        name: '名单模版',
        format: '【维度】+【字段】在【名单(类型)】中',
        examples: [
          '注册手机号是否在手机号维度黑名单中',
          '商户关联收款卡号是否在同商户同卡维度可信名单中',
        ],
      },
    ],
  },
  {
    key: 'relation',
    title: '关联与差值模版',
    templates: [
      {
        type: 'TIME_DIFF',
        name: '时间差模版',
        format: '维度 + (过滤) + 时间对象 + 与 + 维度 + (过滤) + 时间对象 + 的时间间隔',
        examples: [
          '同一用户，当前交易与上次登录的时间间隔',
          '同一银行卡，当前交易与上次交易的时间间隔',
        ],
      },
      {
        type: 'DISTANCE_DIFF',
        name: '距离差模版',
        format: '维度 + (过滤) + 距离对象 + 与 + 维度 + (过滤) + 距离对象 + 的距离',
        examples: [
          '同一用户，当前交易位置与上次交易位置的距离',
          '同一银行卡，当前交易位置与上次交易位置的距离',
        ],
      },
      {
        type: 'ASSOC_STATS',
        name: '关联统计模版',
        format: '维度 + 时间 + 关联 + (过滤) + 对象 + 计数',
        examples: [
          '同一设备过去1小时内，关联登录账户数',
          '同一商户过去24小时内，关联交易金额大于10000元的银行卡数',
        ],
        useStatsStepper: true,
      },
      {
        type: 'ASSOC_2D',
        name: '二维关联统计模版',
        format: '维度 + 时间 + (关联)对象 + (二次关联)对象 + 计算函数 + 结果函数',
        examples: [
          '同一设备指纹过去90天内，最近一次交易对应不同身份证号的征信查询总次数',
          '同一WIFI过去90天内，对应不同身份证号的家庭电话总数',
        ],
      },
    ],
  },
];

export const INDICATOR_TEMPLATES: IndicatorTemplateMeta[] = INDICATOR_TEMPLATE_GROUPS.flatMap(
  (g) => g.templates,
);

export function getTemplateMeta(type: IndicatorTemplateType): IndicatorTemplateMeta {
  return INDICATOR_TEMPLATES.find((t) => t.type === type) ?? INDICATOR_TEMPLATES[4];
}

export const TIME_UNIT_OPTIONS = [
  { label: '分钟', value: 'MINUTE' as const },
  { label: '小时', value: 'HOUR' as const },
  { label: '天', value: 'DAY' as const },
];

export const AGGREGATE_FUNCTION_OPTIONS = [
  { label: '计数', value: 'COUNT' as const },
  { label: '求和', value: 'SUM' as const },
  { label: '平均值', value: 'AVG' as const },
  { label: '最大值', value: 'MAX' as const },
  { label: '最小值', value: 'MIN' as const },
  { label: '去重计数', value: 'DISTINCT_COUNT' as const },
];

export const FILTER_OPERATOR_OPTIONS = [
  { label: '等于', value: 'EQ' as const },
  { label: '不等于', value: 'NE' as const },
  { label: '大于', value: 'GT' as const },
  { label: '大于等于', value: 'GE' as const },
  { label: '小于', value: 'LT' as const },
  { label: '小于等于', value: 'LE' as const },
];

export type TimeUnit = (typeof TIME_UNIT_OPTIONS)[number]['value'];
export type AggregateFunction = (typeof AGGREGATE_FUNCTION_OPTIONS)[number]['value'];
export type FilterOperator = (typeof FILTER_OPERATOR_OPTIONS)[number]['value'];

export interface TemplateFilterCondition {
  field: string;
  operator: FilterOperator;
  value: string;
}

export interface StatsTemplateConfig {
  dataSource: 'FACT_TABLE';
  eventTypeCodes: string[];
  dimension: string;
  timeValue: number;
  timeUnit: TimeUnit;
  objectField: string;
  aggregateFunction: AggregateFunction;
  filters: TemplateFilterCondition[];
  includeCurrentTxn: boolean;
}

export interface RatioTemplateConfig {
  eventTypeCodes: string[];
  dimension: string;
  timeValue: number;
  timeUnit: TimeUnit;
  numeratorField: string;
  denominatorField: string;
  filters: TemplateFilterCondition[];
}

export interface ExpressionTemplateConfig {
  eventTypeCodes: string[];
  dimension: string;
  timeValue: number;
  timeUnit: TimeUnit;
  expression: string;
}

export interface DataFetchTemplateConfig {
  eventTypeCodes: string[];
  dimension: string;
  targetField: string;
}

export interface ListTemplateConfig {
  eventTypeCodes: string[];
  dimension: string;
  field: string;
  listType: 'BLACK' | 'WHITE' | 'WATCH';
}

export interface DiffTemplateConfig {
  eventTypeCodes: string[];
  dimension: string;
  leftField: string;
  rightField: string;
  diffKind: 'TIME' | 'DISTANCE';
}

export interface Assoc2DTemplateConfig {
  eventTypeCodes: string[];
  dimension: string;
  timeValue: number;
  timeUnit: TimeUnit;
  primaryAssocField: string;
  secondaryAssocField: string;
  aggregateFunction: AggregateFunction;
}

export type IndicatorTemplateConfig =
  | StatsTemplateConfig
  | RatioTemplateConfig
  | ExpressionTemplateConfig
  | DataFetchTemplateConfig
  | ListTemplateConfig
  | DiffTemplateConfig
  | Assoc2DTemplateConfig;

export function defaultStatsConfig(partial?: Partial<StatsTemplateConfig>): StatsTemplateConfig {
  return {
    dataSource: 'FACT_TABLE',
    eventTypeCodes: [],
    dimension: '',
    timeValue: 1,
    timeUnit: 'HOUR',
    objectField: '',
    aggregateFunction: 'COUNT',
    filters: [],
    includeCurrentTxn: false,
    ...partial,
  };
}

export function defaultTemplateConfig(type: IndicatorTemplateType): IndicatorTemplateConfig {
  switch (type) {
    case 'COUNT':
      return defaultStatsConfig({ aggregateFunction: 'COUNT', objectField: '' });
    case 'AMOUNT':
      return defaultStatsConfig({ aggregateFunction: 'SUM' });
    case 'ASSOC_STATS':
      return defaultStatsConfig({ aggregateFunction: 'DISTINCT_COUNT' });
    case 'GENERAL_STATS':
      return defaultStatsConfig();
    case 'RATIO':
      return {
        eventTypeCodes: [],
        dimension: '',
        timeValue: 24,
        timeUnit: 'HOUR',
        numeratorField: '',
        denominatorField: '',
        filters: [],
      };
    case 'ARITHMETIC':
    case 'COMPOSITE':
      return {
        eventTypeCodes: [],
        dimension: '',
        timeValue: 1,
        timeUnit: 'DAY',
        expression: 'current + 0',
      };
    case 'DATA_FETCH':
      return { eventTypeCodes: [], dimension: '', targetField: '' };
    case 'LIST':
      return { eventTypeCodes: [], dimension: '', field: '', listType: 'BLACK' };
    case 'TIME_DIFF':
      return {
        eventTypeCodes: [],
        dimension: '',
        leftField: 'eventTime',
        rightField: 'lastEventTime',
        diffKind: 'TIME',
      };
    case 'DISTANCE_DIFF':
      return {
        eventTypeCodes: [],
        dimension: '',
        leftField: 'location',
        rightField: 'lastLocation',
        diffKind: 'DISTANCE',
      };
    case 'ASSOC_2D':
      return {
        eventTypeCodes: [],
        dimension: '',
        timeValue: 90,
        timeUnit: 'DAY',
        primaryAssocField: '',
        secondaryAssocField: '',
        aggregateFunction: 'COUNT',
      };
    default:
      return defaultStatsConfig();
  }
}

export function isStatsTemplate(type: IndicatorTemplateType): boolean {
  return getTemplateMeta(type).useStatsStepper === true;
}

export function parseTemplateConfig(
  type: IndicatorTemplateType,
  raw?: Record<string, unknown> | null,
): IndicatorTemplateConfig {
  if (!raw) {
    return defaultTemplateConfig(type);
  }
  return { ...defaultTemplateConfig(type), ...raw } as IndicatorTemplateConfig;
}
