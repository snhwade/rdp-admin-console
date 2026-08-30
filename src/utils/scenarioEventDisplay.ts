import type { ScenarioTreeNode } from '@/api/console';

/** 扁平化场景树为事件下拉选项。 */
export function buildEventSelectOptions(tree: ScenarioTreeNode[]): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  for (const scenario of tree) {
    for (const event of scenario.events ?? []) {
      opts.push({ value: event.code, label: `${scenario.name} / ${event.name}` });
    }
  }
  return opts;
}

/** 根据事件 code 解析「场景 / 事件」展示路径。 */
export function resolveEventPath(eventCode: string | undefined | null, tree: ScenarioTreeNode[]): string {
  if (!eventCode) return '—';
  for (const scenario of tree) {
    for (const event of scenario.events ?? []) {
      if (event.code === eventCode) {
        return `${scenario.name} / ${event.name}`;
      }
    }
  }
  return eventCode;
}
