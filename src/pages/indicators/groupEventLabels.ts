import type { ScenarioTreeNode } from '@/api/console';

export interface EventDisplayLine {
  scenarioName: string;
  eventLabels: string[];
}

/** 将分组绑定的事件 code 格式化为「场景(事件1、事件2)」展示行。 */
export function formatGroupEventLines(
  eventTypeCodes: string[],
  scenarioTree: ScenarioTreeNode[],
): EventDisplayLine[] {
  if (!eventTypeCodes.length) {
    return [];
  }
  const codeToEvent = new Map<string, { scenarioName: string; eventName: string }>();
  for (const scenario of scenarioTree) {
    for (const event of scenario.events ?? []) {
      codeToEvent.set(event.code, { scenarioName: scenario.name, eventName: event.name });
    }
  }
  const grouped = new Map<string, string[]>();
  for (const code of eventTypeCodes) {
    const hit = codeToEvent.get(code);
    const scenarioName = hit?.scenarioName ?? '未知场景';
    const eventName = hit?.eventName ?? code;
    const list = grouped.get(scenarioName) ?? [];
    list.push(eventName);
    grouped.set(scenarioName, list);
  }
  return [...grouped.entries()].map(([scenarioName, eventLabels]) => ({ scenarioName, eventLabels }));
}

export function summarizeGroupEvents(lines: EventDisplayLine[], maxEvents = 4): string {
  if (!lines.length) {
    return '未绑定事件';
  }
  return lines
    .map(({ scenarioName, eventLabels }) => {
      const shown = eventLabels.slice(0, maxEvents);
      const suffix = eventLabels.length > maxEvents ? '…' : '';
      return `${scenarioName}(${shown.join('、')}${suffix})`;
    })
    .join('，');
}
