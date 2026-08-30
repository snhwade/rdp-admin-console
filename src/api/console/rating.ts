import { apiClient } from '../client';

/**
 * 评级模型（Rating Model）中性 API 模块。
 *
 * 覆盖需求：R10（卡片墙与版本管理）、R11（等级区间）、R12（评分定级）、R13（直接定级）。
 */

/** 执行方式：实时 / 定时（R10.3）。 */
export type RatingExecutionMode = 'REALTIME' | 'SCHEDULED' | (string & {});
/** 评级主体：商户 / 对私客户（R10.3）。 */
export type RatingSubject = 'MERCHANT' | 'INDIVIDUAL' | (string & {});
/** 定级方式：评分定级 / 直接定级 / 混合（同一模型可同时配置两类子项）。 */
export type RatingGradingMode = 'SCORE_BASED' | 'DIRECT' | 'MIXED' | (string & {});
/** 评级模型状态：已上线 / 已下线。 */
export type RatingModelStatus = 'ONLINE' | 'OFFLINE' | (string & {});

/** 等级区间（R11）。 */
export interface GradeBand {
  minScore: number;
  maxScore: number;
  grade: string;
  orderNo?: number;
}

/** 评级子项（评分定级，R12.1）/ 定级项（直接定级，R13.1）后端合一承载。 */
export interface RatingItem {
  category?: string | null;
  /** 事件字段 code。 */
  subItem?: string | null;
  condition?: string | null;
  /** 子项分值（评分定级，仅配置分值，不配置等级）。 */
  score?: number | null;
  subItemCap?: number | null;
  importance?: string | null;
  /** 命中等级（直接定级）。 */
  grade?: string | null;
}

/** 定级项（直接定级，R13.1）—— 前端编辑视图。 */
export interface DirectGradingItem {
  fieldCode?: string | null;
  fieldName?: string | null;
  condition?: string | null;
  grade: string;
}

/** 评级模型卡片视图（R10.1）。 */
export interface RatingModelCardView {
  id: number | string;
  name: string;
  eventPath?: string | null;
  executionMode: RatingExecutionMode;
  subject: RatingSubject;
  gradingMode: RatingGradingMode;
  status: RatingModelStatus;
}

/** 创建评级模型请求（R10.2/10.3）。 */
export interface CreateRatingModelBody {
  name: string;
  eventCode: string;
  executionMode: RatingExecutionMode;
  subject: RatingSubject;
  gradingMode: RatingGradingMode;
}

/** 评级模型详情视图（含等级区间与定级配置，R10.4/10.5）。 */
export interface RatingModelDetailView extends RatingModelCardView {
  version: number;
  gradeBands: GradeBand[];
  items?: RatingItem[];
  directItems?: DirectGradingItem[];
  sourceJson?: string | null;
  versions?: RatingModelVersionView[];
}

/** 评级模型版本摘要（R10.6）。 */
export interface RatingModelVersionView {
  version: number;
  createdBy?: string | null;
  createdAt?: string | null;
}

interface RatingModelRawView {
  id: number | string;
  name: string;
  eventTypeCode?: string | null;
  executionMode?: RatingExecutionMode | null;
  subject?: RatingSubject | null;
  gradingMode?: RatingGradingMode | null;
  status?: RatingModelStatus | null;
  version?: number;
  gradeBands?: GradeBand[];
  items?: RatingItem[];
}

interface RatingModelDetailRaw {
  model?: RatingModelRawView;
  sourceJson?: string | null;
  versions?: RatingModelVersionView[];
}

function toRatingModelCardView(raw: RatingModelRawView): RatingModelCardView {
  return {
    id: raw.id,
    name: raw.name,
    eventPath: raw.eventTypeCode ?? null,
    executionMode: (raw.executionMode ?? 'REALTIME') as RatingExecutionMode,
    subject: (raw.subject ?? 'MERCHANT') as RatingSubject,
    gradingMode: (raw.gradingMode ?? 'SCORE_BASED') as RatingGradingMode,
    status: (raw.status ?? 'OFFLINE') as RatingModelStatus,
  };
}

function toNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeGradeBand(raw: GradeBand): GradeBand {
  return {
    grade: raw.grade ?? '',
    minScore: toNumber(raw.minScore) ?? 0,
    maxScore: toNumber(raw.maxScore) ?? 0,
    orderNo: raw.orderNo,
  };
}

function normalizeRatingItem(raw: RatingItem): RatingItem {
  return {
    category: raw.category ?? null,
    subItem: raw.subItem ?? null,
    condition: raw.condition ?? null,
    score: toNumber(raw.score),
    subItemCap: toNumber(raw.subItemCap),
    importance: raw.importance ?? null,
    grade: raw.grade ?? null,
  };
}

/** 是否为直接定级子项（以 grade 字段区分）。 */
export function isDirectRatingItem(item: RatingItem): boolean {
  return Boolean(item.grade?.trim());
}

/** 将后端 items 按字段拆分为评分子项 / 直接定级项（与 gradingMode 无关）。 */
export function splitRatingItems(
  rawItems: RatingItem[] | undefined,
): Pick<RatingModelDetailView, 'items' | 'directItems'> {
  const list = (rawItems ?? []).map(normalizeRatingItem);
  const directItems = list.filter(isDirectRatingItem).map((item) => ({
    fieldCode: item.subItem ?? null,
    fieldName: item.category ?? null,
    condition: item.condition,
    grade: item.grade ?? '',
  }));
  const scoreItems = list.filter((item) => !isDirectRatingItem(item));
  return { items: scoreItems, directItems };
}

/** 推断定级方式：同时存在两类子项时为 MIXED。 */
export function inferGradingMode(
  scoreItems: RatingItem[],
  directItems: DirectGradingItem[],
): RatingGradingMode {
  const hasScore = scoreItems.length > 0;
  const hasDirect = directItems.length > 0;
  if (hasScore && hasDirect) {
    return 'MIXED';
  }
  if (hasDirect) {
    return 'DIRECT';
  }
  return 'SCORE_BASED';
}

/** 将前端编辑态合并为后端保存用的 items 列表。 */
export function mergeRatingItemsForSave(
  scoreItems: RatingItem[],
  directItems: DirectGradingItem[],
): RatingItem[] {
  const scoreRows = scoreItems.map((item) => ({
    category: item.category ?? null,
    subItem: item.subItem ?? null,
    condition: item.condition ?? null,
    score: item.score ?? null,
    subItemCap: null,
    importance: item.importance ?? null,
    grade: null,
  }));
  const directRows = directItems.map((item) => ({
    category: item.fieldName ?? item.fieldCode ?? null,
    subItem: item.fieldCode ?? null,
    condition: item.condition ?? null,
    score: null,
    subItemCap: null,
    importance: null,
    grade: item.grade,
  }));
  return [...scoreRows, ...directRows];
}

/** 取等级区间下界，用于直接定级项展示得分。 */
export function getGradeMinScore(bands: GradeBand[], grade: string): number | null {
  const band = bands.find((b) => b.grade === grade);
  return band != null ? band.minScore : null;
}

function unwrapDetailModel(data: RatingModelDetailRaw | RatingModelRawView): RatingModelRawView {
  if ('model' in data && data.model) {
    return data.model;
  }
  return data as RatingModelRawView;
}

/** 列出评级模型卡片（R10.1）。 */
export async function listRatingModels(params?: {
  eventCode?: string;
  executionMode?: RatingExecutionMode;
  subject?: RatingSubject;
}): Promise<RatingModelCardView[]> {
  const { data } = await apiClient.get<RatingModelRawView[]>('/rating-models', {
    params: {
      eventTypeCode: params?.eventCode,
      executionMode: params?.executionMode,
      subject: params?.subject,
    },
  });
  return (data ?? []).map(toRatingModelCardView);
}

/** 评级模型详情（R10.4/10.5）。 */
export async function getRatingModel(
  id: number | string,
): Promise<RatingModelDetailView> {
  const { data } = await apiClient.get<RatingModelDetailRaw>(`/rating-models/${id}`);
  const model = unwrapDetailModel(data);
  const card = toRatingModelCardView(model);
  const split = splitRatingItems(model.items);
  return {
    ...card,
    version: model.version ?? 1,
    gradeBands: (model.gradeBands ?? []).map(normalizeGradeBand),
    ...split,
    sourceJson: data.sourceJson ?? null,
    versions: data.versions ?? [],
  };
}

/** 创建评级模型（执行方式与主体校验，R10.2/10.3）。 */
export async function createRatingModel(
  body: CreateRatingModelBody,
): Promise<RatingModelCardView> {
  const { data } = await apiClient.post<RatingModelRawView>('/rating-models', {
    name: body.name,
    eventTypeCode: body.eventCode,
    executionMode: body.executionMode,
    subject: body.subject,
    gradingMode: body.gradingMode,
  });
  return toRatingModelCardView(data);
}

/** 保存评级模型编辑 → 新建版本（含等级区间校验，R10.6/11.5）。 */
export async function saveRatingModel(
  id: number | string,
  body: {
    name?: string;
    gradingMode?: RatingGradingMode;
    gradeBands?: GradeBand[];
    items?: RatingItem[];
  },
): Promise<RatingModelDetailView> {
  const { data } = await apiClient.put<RatingModelRawView>(`/rating-models/${id}`, body);
  const card = toRatingModelCardView(data);
  const split = splitRatingItems(data.items);
  return {
    ...card,
    version: data.version ?? 1,
    gradeBands: (data.gradeBands ?? []).map(normalizeGradeBand),
    ...split,
  };
}

/** 查询评级模型版本历史（R10.6，来自详情接口 versions 字段）。 */
export async function listRatingModelVersions(
  id: number | string,
): Promise<RatingModelVersionView[]> {
  const detail = await getRatingModel(id);
  return detail.versions ?? [];
}

/** 上线 / 下线评级模型（R10.7）。 */
export async function updateRatingModelStatus(
  id: number | string,
  status: RatingModelStatus,
): Promise<RatingModelCardView> {
  const action = status === 'ONLINE' ? 'online' : 'offline';
  const { data } = await apiClient.post<RatingModelRawView>(`/rating-models/${id}:${action}`);
  return toRatingModelCardView(data);
}
