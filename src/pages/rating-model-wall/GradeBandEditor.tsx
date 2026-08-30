import { useMemo } from 'react';
import { Alert, Button, Card, InputNumber, Slider, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { GradeBand } from '@/api/console';

const { Text } = Typography;

/**
 * 可视化等级区间滑条编辑器（risk-console-redesign R11.1）。
 *
 * - 顶部以 Ant Design 区间滑条直观呈现各等级（一级/二级/三级/四级…）的分值边界，
 *   拖动滑块即可调整相邻等级的分界点（边界共享，保证连续且不重叠）。
 * - 下方表格可编辑每个等级的名称与上下界，可新增/删除任意数量等级（R11.2）。
 * - 实时校验区间是否互不重叠且连续覆盖模型分值范围，存在重叠或缺口时给出提示（R11.4）。
 *
 * 本组件为受控组件：通过 `value`/`onChange` 与外部表单状态同步，保存动作由外部
 * 调用 `saveRatingModel` 完成（R11.5）。
 */

export interface GradeBandEditorProps {
  /** 当前等级区间集合（按下界升序）。 */
  value: GradeBand[];
  /** 区间变更回调。 */
  onChange: (bands: GradeBand[]) => void;
  /** 模型分值范围下界（默认 0）。 */
  rangeMin?: number;
  /** 模型分值范围上界（默认 100）。 */
  rangeMax?: number;
  /** 只读模式（如运行区展示当前上线版本）。 */
  readonly?: boolean;
}

/** 等级配色（按序循环），用于滑条轨道与标签着色。 */
const BAND_COLORS = ['#52c41a', '#1677ff', '#faad14', '#fa541c', '#722ed1', '#13c2c2'];

/** 默认等级名称（一级、二级…），超出长度回退为「第 N 级」。 */
const DEFAULT_GRADE_NAMES = ['一级', '二级', '三级', '四级', '五级', '六级'];

function defaultGradeName(index: number): string {
  return DEFAULT_GRADE_NAMES[index] ?? `第 ${index + 1} 级`;
}

/** 将区间按下界升序排序（拷贝，不修改入参）。 */
function sortBands(bands: GradeBand[]): GradeBand[] {
  return [...bands].sort((a, b) => a.minScore - b.minScore);
}

/**
 * 校验等级区间：互不重叠且在 [rangeMin, rangeMax] 内连续覆盖（无缺口）。
 * 返回错误信息数组，为空表示合法。
 */
export function validateGradeBands(
  bands: GradeBand[],
  rangeMin: number = 0,
  rangeMax?: number,
): string[] {
  const errors: string[] = [];
  if (bands.length === 0) {
    errors.push('至少需要配置一个等级区间。');
    return errors;
  }
  const sorted = sortBands(bands);
  for (const b of sorted) {
    if (b.minScore >= b.maxScore) {
      errors.push(`等级「${b.grade || '(未命名)'}」的下界须小于上界。`);
    }
  }
  if (sorted[0].minScore !== rangeMin) {
    errors.push(`首个等级须从分值下界 ${rangeMin} 开始，存在覆盖缺口。`);
  }
  if (rangeMax != null && sorted[sorted.length - 1].maxScore !== rangeMax) {
    errors.push(`末个等级须覆盖到分值上界 ${rangeMax}，存在覆盖缺口。`);
  }
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.minScore < prev.maxScore) {
      errors.push(`等级「${prev.grade || '(未命名)'}」与「${cur.grade || '(未命名)'}」区间重叠。`);
    } else if (cur.minScore > prev.maxScore) {
      errors.push(`等级「${prev.grade || '(未命名)'}」与「${cur.grade || '(未命名)'}」之间存在覆盖缺口。`);
    }
  }
  return errors;
}

export default function GradeBandEditor({
  value,
  onChange,
  rangeMin = 0,
  rangeMax,
  readonly = false,
}: GradeBandEditorProps) {
  const bands = useMemo(() => sortBands(value), [value]);

  const sliderMax = useMemo(() => {
    const bandMax = bands.length > 0 ? Math.max(...bands.map((b) => b.maxScore)) : 0;
    return Math.max(rangeMax ?? 0, bandMax, 100);
  }, [bands, rangeMax]);

  const errors = useMemo(
    () => validateGradeBands(bands, rangeMin, rangeMax),
    [bands, rangeMin, rangeMax],
  );

  // 滑条内部分界点（去掉首尾边界，仅暴露可拖动的中间分界点）
  const sliderBoundaries = useMemo(() => {
    if (bands.length <= 1) {
      return [] as number[];
    }
    return bands.slice(0, -1).map((b) => b.maxScore);
  }, [bands]);

  // 滑条刻度标记：每个等级名称落在其区间中点
  const sliderMarks = useMemo(() => {
    const marks: Record<number, React.ReactNode> = {};
    marks[rangeMin] = String(rangeMin);
    marks[sliderMax] = String(sliderMax);
    bands.forEach((b, i) => {
      const mid = (b.minScore + b.maxScore) / 2;
      marks[mid] = (
        <span style={{ color: BAND_COLORS[i % BAND_COLORS.length], whiteSpace: 'nowrap' }}>
          {b.grade || defaultGradeName(i)}
        </span>
      );
    });
    return marks;
  }, [bands, rangeMin, sliderMax]);

  /** 拖动滑条调整中间分界点，更新相邻区间共享边界。 */
  const handleSliderChange = (boundaries: number[]) => {
    if (readonly || bands.length <= 1) {
      return;
    }
    const sortedBoundaries = [...boundaries].sort((a, b) => a - b);
    const next = bands.map((b, i) => {
      const lower = i === 0 ? rangeMin : sortedBoundaries[i - 1];
      const upper = i === bands.length - 1 ? sliderMax : sortedBoundaries[i];
      return { ...b, minScore: lower, maxScore: upper };
    });
    onChange(next);
  };

  /** 编辑单个区间字段。 */
  const updateBand = (orderIndex: number, patch: Partial<GradeBand>) => {
    const next = bands.map((b, i) => (i === orderIndex ? { ...b, ...patch } : b));
    onChange(next);
  };

  /** 在末尾追加一个等级：从当前末区间二分出新区间。 */
  const addBand = () => {
    if (bands.length === 0) {
      const initialMax = rangeMax ?? Math.max(100, rangeMin + 100);
      onChange([{ minScore: rangeMin, maxScore: initialMax, grade: defaultGradeName(0), orderNo: 0 }]);
      return;
    }
    const last = bands[bands.length - 1];
    const mid = (last.minScore + last.maxScore) / 2;
    const next: GradeBand[] = [
      ...bands.slice(0, -1),
      { ...last, maxScore: mid },
      {
        minScore: mid,
        maxScore: last.maxScore,
        grade: defaultGradeName(bands.length),
        orderNo: bands.length,
      },
    ];
    onChange(next.map((b, i) => ({ ...b, orderNo: i })));
  };

  /** 删除某等级：将其区间并入前一个等级（或后一个），保持连续覆盖。 */
  const removeBand = (orderIndex: number) => {
    if (bands.length <= 1) {
      return;
    }
    const next = bands.filter((_, i) => i !== orderIndex);
    // 修补边界，保证连续覆盖
    next[0] = { ...next[0], minScore: rangeMin };
    next[next.length - 1] = { ...next[next.length - 1], maxScore: sliderMax };
    for (let i = 1; i < next.length; i += 1) {
      next[i] = { ...next[i], minScore: next[i - 1].maxScore };
    }
    onChange(next.map((b, i) => ({ ...b, orderNo: i })));
  };

  const columns: ColumnsType<GradeBand & { orderIndex: number }> = [
    {
      title: '等级',
      dataIndex: 'grade',
      key: 'grade',
      render: (_, row) => (
        <Tag color={BAND_COLORS[row.orderIndex % BAND_COLORS.length]}>
          {row.grade || defaultGradeName(row.orderIndex)}
        </Tag>
      ),
    },
    {
      title: '等级名称',
      key: 'gradeName',
      render: (_, row) =>
        readonly ? (
          <Text>{row.grade || defaultGradeName(row.orderIndex)}</Text>
        ) : (
          <input
            aria-label="等级名称"
            value={row.grade}
            placeholder={defaultGradeName(row.orderIndex)}
            onChange={(e) => updateBand(row.orderIndex, { grade: e.target.value })}
            style={{ width: 120, padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
        ),
    },
    {
      title: '下界（含）',
      key: 'minScore',
      render: (_, row) =>
        readonly ? (
          <Text>{row.minScore}</Text>
        ) : (
          <InputNumber
            value={row.minScore}
            disabled={row.orderIndex === 0}
            onChange={(v) => {
              if (v == null) return;
              updateBand(row.orderIndex, { minScore: v });
              if (row.orderIndex > 0) {
                updateBand(row.orderIndex - 1, { maxScore: v });
              }
            }}
          />
        ),
    },
    {
      title: '上界（含）',
      key: 'maxScore',
      render: (_, row) =>
        readonly ? (
          <Text>{row.maxScore}</Text>
        ) : (
          <InputNumber
            value={row.maxScore}
            onChange={(v) => {
              if (v == null) return;
              updateBand(row.orderIndex, { maxScore: v });
              if (row.orderIndex < bands.length - 1) {
                updateBand(row.orderIndex + 1, { minScore: v });
              }
            }}
          />
        ),
    },
    ...(readonly
      ? []
      : [
          {
            title: '操作',
            key: 'action',
            render: (_: unknown, row: GradeBand & { orderIndex: number }) => (
              <Button
                type="link"
                size="small"
                danger
                disabled={bands.length <= 1}
                onClick={() => removeBand(row.orderIndex)}
              >
                删除
              </Button>
            ),
          },
        ]),
  ];

  const tableData = bands.map((b, i) => ({ ...b, orderIndex: i, key: i }));

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card size="small" title="等级区间可视化">
        <div style={{ padding: '8px 16px 0' }}>
          <Slider
            range
            disabled={readonly || bands.length <= 1}
            min={rangeMin}
            max={sliderMax}
            value={sliderBoundaries}
            marks={sliderMarks}
            onChange={(v) => handleSliderChange(v as number[])}
            tooltip={{ open: false }}
          />
        </div>
      </Card>

      {errors.length > 0 ? (
        <Alert
          type="error"
          showIcon
          message="等级区间不合法"
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          }
        />
      ) : (
        <Alert type="success" showIcon message="等级区间合法：互不重叠且连续覆盖模型分值范围。" />
      )}

      <Table
        size="small"
        rowKey="key"
        columns={columns}
        dataSource={tableData}
        pagination={false}
      />

      {!readonly && (
        <Button onClick={addBand} type="dashed" block>
          新增等级
        </Button>
      )}
    </Space>
  );
}
