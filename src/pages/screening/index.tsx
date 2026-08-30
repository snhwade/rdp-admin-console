import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Space,
  Tag,
  Typography,
  message,
} from 'antd';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { screen, setScreeningThreshold, type ScreenResult } from '@/api/tools';
import { toFieldErrors, type ApiError } from '@/api/client';

const THRESHOLD_MIN = 0;
const THRESHOLD_MAX = 1;
const THRESHOLD_RANGE_ERROR = '相似度阈值取值范围为 0.00 至 1.00';

const NAME_DIMENSIONS = ['subjectName', 'name', 'payerName', 'counterpartyName'];

/** 名称模糊筛查试运行页（R11）。名单数据维护见「名单管理」菜单。 */
export default function ScreeningPage() {
  const [thresholdForm] = Form.useForm();
  const [subjectName, setSubjectName] = useState('');
  const [screenResult, setScreenResult] = useState<ScreenResult | null>(null);

  const thresholdMutation = useMutation({
    mutationFn: (value: number) => setScreeningThreshold(value),
    onSuccess: () => message.success('相似度阈值已更新'),
    onError: (err: ApiError) => {
      const fieldErrors = toFieldErrors(err);
      const messages = Object.values(fieldErrors);
      if (messages.length > 0) {
        thresholdForm.setFields([{ name: 'value', errors: messages }]);
      } else {
        message.error(err.message ?? '阈值配置失败');
      }
    },
  });

  const screenMutation = useMutation({
    mutationFn: (name: string) => screen(name),
    onSuccess: (result) => setScreenResult(result),
    onError: (err: ApiError) => {
      setScreenResult(null);
      message.error(err.message ?? '筛查失败');
    },
  });

  const runScreen = () => {
    const name = subjectName.trim();
    if (!name) {
      message.warning('请输入交易主体名称');
      return;
    }
    screenMutation.mutate(name);
  };

  const isHit = screenResult?.outcome === 'HIT' || Boolean(screenResult?.matchedEntry);
  const hitTag = isHit ? (
    <Tag color="orange">命中（具体处置由上层引用规则决定）</Tag>
  ) : (
    <Tag color="green">未命中</Tag>
  );

  const canJump =
    isHit &&
    screenResult?.libraryId != null &&
    screenResult?.matchedEntryId != null;

  return (
    <Space direction="vertical" size={16} style={{ display: 'flex', width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="名称模糊筛查"
        description={
          <>
            名单库、维度与记录请在左侧「名单管理」中维护。名单本身不区分黑/白名单类型；规则包、决策流等上层引用命中结果后，
            由引用方决定通过（白名单语义）或拦截（黑名单语义）。
            <br />
            本页仅对 dimension 为 {NAME_DIMENSIONS.join(' / ')} 且标记支持模糊匹配的维度记录做相似度试跑。
            命中名单库条目时可跳转到「名单管理」查看该记录。
          </>
        }
      />
      <Card title="相似度阈值配置">
        <Form
          form={thresholdForm}
          layout="inline"
          initialValues={{ value: 0.85 }}
          onFinish={(values) => thresholdMutation.mutate(values.value)}
        >
          <Form.Item
            label="名称匹配相似度阈值"
            name="value"
            extra="取值范围 0.00 至 1.00，默认 0.85"
            rules={[
              { required: true, message: '请输入相似度阈值' },
              {
                validator: (_, value: number) =>
                  value === undefined ||
                  value === null ||
                  (value >= THRESHOLD_MIN && value <= THRESHOLD_MAX)
                    ? Promise.resolve()
                    : Promise.reject(new Error(THRESHOLD_RANGE_ERROR)),
              },
            ]}
          >
            <InputNumber step={0.01} precision={2} placeholder="0.00 ~ 1.00" style={{ width: 160 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={thresholdMutation.isPending}>
              提交阈值
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="手动筛查（试运行）">
        <Space style={{ marginBottom: 16 }}>
          <Input
            placeholder="输入交易主体名称"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            onPressEnter={runScreen}
            style={{ width: 280 }}
            allowClear
          />
          <Button type="primary" loading={screenMutation.isPending} onClick={runScreen}>
            发起筛查
          </Button>
        </Space>

        {screenResult && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="筛查结果">{hitTag}</Descriptions.Item>
            <Descriptions.Item label="命中来源">{screenResult.source ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="匹配条目">
              {screenResult.matchedEntry ?? '—'}
              {canJump ? (
                <>
                  {' '}
                  <Link
                    to={`/list-libraries?libraryId=${screenResult.libraryId}&highlightEntryId=${screenResult.matchedEntryId}`}
                  >
                    查看名单条目
                  </Link>
                </>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item label="匹配相似度">
              {screenResult.similarity != null ? screenResult.similarity.toFixed(2) : '—'}
            </Descriptions.Item>
            {screenResult.reason && (
              <Descriptions.Item label="说明" span={2}>
                {screenResult.reason}
              </Descriptions.Item>
            )}
            {canJump && (
              <Descriptions.Item label="名单管理" span={2}>
                <Typography.Text type="secondary">
                  命中来自名单库记录，可跳转至名单管理核对维度值与有效期。
                </Typography.Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Card>
    </Space>
  );
}
