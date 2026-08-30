import { apiClient } from './client';

async function getList<T>(url: string, params?: Record<string, unknown>): Promise<T[]> {
  try {
    const { data } = await apiClient.get<T[]>(url, { params });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ==================== 名单维度 ==================== */

export interface ListDimensionView {
  id: number | string;
  code: string;
  name: string;
  maskRule?: string;
  fuzzyEnabled: boolean;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const listDimensions = (keyword?: string) =>
  getList<ListDimensionView>('/list-dimensions', keyword ? { keyword } : undefined);

export async function createListDimension(body: {
  code: string;
  name: string;
  maskRule?: string;
  fuzzyEnabled?: boolean;
  updatedBy?: string;
}) {
  const { data } = await apiClient.post<ListDimensionView>('/list-dimensions', body);
  return data;
}

export async function updateListDimension(
  id: number | string,
  body: Partial<{ name: string; maskRule: string; fuzzyEnabled: boolean; updatedBy: string }>,
) {
  const { data } = await apiClient.put<ListDimensionView>(`/list-dimensions/${id}`, body);
  return data;
}

export async function deleteListDimensions(ids: (number | string)[]) {
  await apiClient.post('/list-dimensions/batch-delete', { ids });
}

/* ==================== 名单附加属性 ==================== */

export type ListAttrInputType = 'TEXT' | 'SELECT' | 'DATE' | 'NUMBER';

export interface ListAttrDefView {
  id: number | string;
  code: string;
  name: string;
  inputType: ListAttrInputType;
  required: boolean;
  multiValue: boolean;
  maskRule?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const listAttrDefs = (keyword?: string) =>
  getList<ListAttrDefView>('/list-attr-defs', keyword ? { keyword } : undefined);

export async function createListAttrDef(body: {
  code: string;
  name: string;
  inputType?: ListAttrInputType;
  required?: boolean;
  multiValue?: boolean;
  maskRule?: string;
}) {
  const { data } = await apiClient.post<ListAttrDefView>('/list-attr-defs', body);
  return data;
}

export async function updateListAttrDef(
  id: number | string,
  body: Partial<{
    name: string;
    inputType: ListAttrInputType;
    required: boolean;
    multiValue: boolean;
    maskRule: string;
  }>,
) {
  const { data } = await apiClient.put<ListAttrDefView>(`/list-attr-defs/${id}`, body);
  return data;
}

export async function deleteListAttrDefs(ids: (number | string)[]) {
  await apiClient.post('/list-attr-defs/batch-delete', { ids });
}

/* ==================== 名单库 ==================== */

export interface ListLibraryView {
  id: number | string;
  code: string;
  name: string;
  description?: string | null;
  remark?: string | null;
  enabled: boolean;
  entryCount: number;
  enabledCount?: number;
  expiringSoon?: number;
  expiringSoonDays?: number;
  createdAt?: string;
  updatedAt?: string;
}

export const listLibraries = (keyword?: string) =>
  getList<ListLibraryView>('/list-libraries', keyword ? { keyword } : undefined);

export async function createListLibrary(body: {
  code: string;
  name: string;
  description?: string;
  remark?: string;
}) {
  const { data } = await apiClient.post<ListLibraryView>('/list-libraries', body);
  return data;
}

export async function updateListLibrary(
  id: number | string,
  body: Partial<{ name: string; description: string; remark: string; enabled: boolean }>,
) {
  const { data } = await apiClient.put<ListLibraryView>(`/list-libraries/${id}`, body);
  return data;
}

export async function deleteListLibrary(id: number | string) {
  await apiClient.delete(`/list-libraries/${id}`);
}

export async function listLibraryReferences(id: number | string): Promise<string[]> {
  const { data } = await apiClient.get<{ references: string[] }>(`/list-libraries/${id}/references`);
  return data?.references ?? [];
}

export async function syncListLibrary(
  id: number | string,
  body?: { source?: string; batchId?: string; entryCount?: number },
) {
  const { data } = await apiClient.post<{
    auditId: number;
    batchId: string;
    status: string;
    message: string;
    entryCount: number;
  }>(`/list-libraries/${id}/sync`, body ?? {});
  return data;
}

export async function listLibraryImportAudits(id: number | string, limit = 20) {
  const { data } = await apiClient.get<
    Array<{
      id: number;
      source: string;
      batchId?: string;
      entryCount: number;
      status: string;
      message?: string;
      createdAt?: string;
    }>
  >(`/list-libraries/${id}/import-audits`, { params: { limit } });
  return Array.isArray(data) ? data : [];
}

/* ==================== 库内记录 ==================== */

export interface ListEntryView {
  id: number | string;
  libraryId: number | string;
  dimensionCode: string;
  dimensionValue: string;
  effectiveAt?: string | null;
  expireAt?: string | null;
  enabled: boolean;
  source?: string;
  remark?: string | null;
  extraAttrs?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}

export const listEntries = (params: {
  libraryId: number | string;
  dimensionCode?: string;
  keyword?: string;
}) => getList<ListEntryView>('/list-entries', params);

export async function createListEntry(body: {
  libraryId: number | string;
  dimensionCode: string;
  dimensionValue: string;
  effectiveAt?: string | null;
  expireAt?: string | null;
  extraAttrs?: Record<string, unknown>;
  remark?: string | null;
}) {
  const { data } = await apiClient.post<ListEntryView>('/list-entries', body);
  return data;
}

export async function updateListEntry(
  id: number | string,
  body: Partial<{
    dimensionValue: string;
    effectiveAt: string | null;
    expireAt: string | null;
    enabled: boolean;
    extraAttrs: Record<string, unknown>;
    remark: string | null;
  }>,
) {
  const { data } = await apiClient.put<ListEntryView>(`/list-entries/${id}`, body);
  return data;
}

export async function deleteListEntries(ids: (number | string)[]) {
  await apiClient.post('/list-entries/batch-delete', { ids });
}

export async function batchSetListEntriesEnabled(ids: (number | string)[], enabled: boolean) {
  await apiClient.post('/list-entries/batch-enabled', { ids, enabled });
}

export interface ListEntryCheckResult {
  hit: boolean;
  hits: unknown[];
}

export async function checkListEntries(params: {
  dimensionCode: string;
  value: string;
  libraryCode?: string;
}): Promise<ListEntryCheckResult> {
  const { data } = await apiClient.get<ListEntryCheckResult>('/list-entries/check', { params });
  return data ?? { hit: false, hits: [] };
}
