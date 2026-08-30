import { describe, expect, it } from 'vitest';
import { validateGradeBands } from './GradeBandEditor';
import type { GradeBand } from '@/api/console';

/**
 * 等级区间校验单元测试（risk-console-redesign 任务 14.5 / R11.1 / R11.4）。
 *
 * 校验 validateGradeBands：合法当且仅当各区间互不重叠且在 [rangeMin, rangeMax] 内
 * 连续覆盖（无缺口）；重叠、缺口、越界、空集均判为不合法并给出错误信息。
 * 等级数量不受限制（R11.2）。
 */

function band(minScore: number, maxScore: number, grade: string): GradeBand {
  return { minScore, maxScore, grade };
}

describe('validateGradeBands', () => {
  it('空集判为不合法', () => {
    expect(validateGradeBands([], 0, 100)).not.toHaveLength(0);
  });

  it('单个区间完整覆盖范围时合法', () => {
    expect(validateGradeBands([band(0, 100, '一级')], 0, 100)).toHaveLength(0);
  });

  it('连续且不重叠的多区间合法（任意数量等级，R11.2）', () => {
    const bands = [
      band(0, 30, '一级'),
      band(30, 60, '二级'),
      band(60, 80, '三级'),
      band(80, 100, '四级'),
    ];
    expect(validateGradeBands(bands, 0, 100)).toHaveLength(0);
  });

  it('区间乱序但连续覆盖时仍合法（内部排序）', () => {
    const bands = [band(60, 100, '三级'), band(0, 30, '一级'), band(30, 60, '二级')];
    expect(validateGradeBands(bands, 0, 100)).toHaveLength(0);
  });

  it('区间重叠判为不合法（R11.4）', () => {
    const bands = [band(0, 50, '一级'), band(40, 100, '二级')];
    const errors = validateGradeBands(bands, 0, 100);
    expect(errors.some((e) => e.includes('重叠'))).toBe(true);
  });

  it('区间存在覆盖缺口判为不合法（R11.4）', () => {
    const bands = [band(0, 40, '一级'), band(60, 100, '二级')];
    const errors = validateGradeBands(bands, 0, 100);
    expect(errors.some((e) => e.includes('缺口'))).toBe(true);
  });

  it('未覆盖到下界判为不合法', () => {
    const errors = validateGradeBands([band(10, 100, '一级')], 0, 100);
    expect(errors.some((e) => e.includes('下界'))).toBe(true);
  });

  it('未覆盖到上界时，仅在指定 rangeMax 时校验', () => {
    expect(validateGradeBands([band(0, 90, '一级')], 0)).toHaveLength(0);
    const errors = validateGradeBands([band(0, 90, '一级')], 0, 100);
    expect(errors.some((e) => e.includes('上界'))).toBe(true);
  });

  it('下界不小于上界判为不合法', () => {
    const errors = validateGradeBands([band(50, 50, '一级')], 0, 100);
    expect(errors.length).toBeGreaterThan(0);
  });
});
