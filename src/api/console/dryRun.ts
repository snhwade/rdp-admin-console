import { apiClient } from '../client';

/** 试运行目标类型。 */
export type DryRunTargetType = 'RULE' | 'RULE_PACKAGE' | (string & {});

/** 试运行样本来源。 */
export type DryRunSampleSource = 'ORDER' | 'EVENT' | (string & {});

/** 试运行任务状态。 */
export type DryRunStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | (string & {});

export interface StartDryRunBody {
  targetType: DryRunTargetType;
  targetId: number;
  sampleSource: DryRunSampleSource;
  dataFrom?: string;
  dataTo?: string;
  sampleLimit?: number;
}

export interface DryRunStartView {
  jobId: number;
  status: DryRunStatus;
}

export interface DryRunReportView {
  jobId: number;
  targetType: DryRunTargetType;
  targetId: number;
  sampleSource: DryRunSampleSource;
  status: DryRunStatus;
  totalCount: number;
  hitCount: number;
  hitRate: number | null;
  errorCount: number;
  report: string | null;
}

export async function startDryRun(body: StartDryRunBody): Promise<DryRunStartView> {
  const { data } = await apiClient.post<DryRunStartView>('/dry-run', body);
  return data;
}

export async function getDryRun(id: number | string): Promise<DryRunReportView> {
  const { data } = await apiClient.get<DryRunReportView>(`/dry-run/${id}`);
  return data;
}
