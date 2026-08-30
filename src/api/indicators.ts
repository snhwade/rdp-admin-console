import { apiClient } from './client';

/** 指标读取结果（对应 indicator-store GET /api/v1/indicators/{refName}）。 */
export interface IndicatorValueView {
  refName: string;
  dimensionKey: string;
  value: number;
  /** REDIS | ES | DEFAULT */
  source: string;
  missing: boolean;
  elapsedMs: number;
}

export interface QueryIndicatorParams {
  refName: string;
  dimensionKey: string;
  windowDays: number;
  granularity: 'MINUTE' | 'HOUR' | 'DAY';
  defaultValue?: number;
}

/** 经 BFF 读取指标当前值。 */
export async function queryIndicator(params: QueryIndicatorParams): Promise<IndicatorValueView> {
  const { refName, dimensionKey, windowDays, granularity, defaultValue } = params;
  const { data } = await apiClient.get<IndicatorValueView>(`/indicators/${encodeURIComponent(refName)}`, {
    params: {
      dimensionKey,
      windowDays,
      granularity,
      ...(defaultValue != null ? { defaultValue } : {}),
    },
  });
  return data;
}
