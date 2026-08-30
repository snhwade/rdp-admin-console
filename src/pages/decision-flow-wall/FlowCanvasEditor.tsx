import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Empty, Spin, Typography, message, Modal } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getDecisionFlow,
  getDecisionFlowCanvasByVersion,
  listDecisionFlowVersions,
  saveDecisionFlowCanvas,
  type FlowCanvas,
} from '@/api/console';
import { type ApiError } from '@/api/client';
import { canvasEquals, canvasFromBackend } from '@/utils/flowCanvasMapper';
import FlowCanvasBoard from './FlowCanvasBoard';

export interface FlowCanvasEditorHandle {
  save: () => void;
  reset: () => void;
}

export interface FlowCanvasEditorProps {
  flowId?: number | string;
  readonly?: boolean;
  version?: number;
  onDirtyChange?: (dirty: boolean) => void;
  /** 全屏沉浸式：仅渲染画布，占满父容器。 */
  immersive?: boolean;
}

const FlowCanvasEditor = forwardRef<FlowCanvasEditorHandle, FlowCanvasEditorProps>(
  function FlowCanvasEditor(
    { flowId, readonly, version, onDirtyChange, immersive = false },
    ref,
  ) {
    const queryClient = useQueryClient();
    const [draftCanvas, setDraftCanvas] = useState<FlowCanvas>({ nodes: [], edges: [] });
    const [baselineCanvas, setBaselineCanvas] = useState<FlowCanvas>({ nodes: [], edges: [] });
    const [flowMeta, setFlowMeta] = useState<{ name: string; eventTypeCode: string } | null>(null);

    const { data: versions = [], isLoading: versionsLoading } = useQuery({
      queryKey: ['decision-flow-versions', flowId],
      queryFn: () => listDecisionFlowVersions(flowId!),
      enabled: flowId != null,
    });

    const targetVersion = useMemo(() => {
      if (versions.length === 0) {
        return undefined;
      }
      if (readonly) {
        if (version != null) {
          return versions.find((v) => v.version === version);
        }
        return versions.find((v) => String(v.status) === 'ONLINE');
      }
      return [...versions].sort((a, b) => b.version - a.version)[0];
    }, [versions, readonly, version]);

    const { data: flowDetail, isLoading: detailLoading } = useQuery({
      queryKey: ['decision-flow-detail', flowId],
      queryFn: () => getDecisionFlow(flowId!),
      enabled: flowId != null && !readonly,
    });

    const readonlyVersionNo = readonly ? (version ?? targetVersion?.version) : undefined;

    const { data: readonlyCanvas, isLoading: snapshotLoading } = useQuery({
      queryKey: ['decision-flow-canvas', flowId, readonlyVersionNo],
      queryFn: () => getDecisionFlowCanvasByVersion(flowId!, readonlyVersionNo!),
      enabled: flowId != null && readonly && readonlyVersionNo != null,
    });

    useEffect(() => {
      if (readonly || !flowDetail) {
        return;
      }
      const loaded = canvasFromBackend(flowDetail.nodes, flowDetail.edges);
      setDraftCanvas(loaded);
      setBaselineCanvas(loaded);
      setFlowMeta({ name: flowDetail.name, eventTypeCode: flowDetail.eventTypeCode });
    }, [flowDetail, readonly]);

    useEffect(() => {
      if (!readonly || !readonlyCanvas) {
        return;
      }
      setDraftCanvas(readonlyCanvas);
      setBaselineCanvas(readonlyCanvas);
    }, [readonly, readonlyCanvas]);

    const dirty = !readonly && !canvasEquals(draftCanvas, baselineCanvas);

    useEffect(() => {
      onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);

    const saveMutation = useMutation({
      mutationFn: (payload: FlowCanvas) => {
        const meta = flowMeta ?? {
          name: flowDetail?.name ?? '决策流',
          eventTypeCode: flowDetail?.eventTypeCode ?? '',
        };
        return saveDecisionFlowCanvas(flowId!, meta.name, meta.eventTypeCode, payload);
      },
      onSuccess: (created) => {
        message.success(`已保存为新版本 v${created.version}`);
        setBaselineCanvas(draftCanvas);
        queryClient.invalidateQueries({ queryKey: ['decision-flow-versions', flowId] });
        queryClient.invalidateQueries({ queryKey: ['decision-flow-detail', flowId] });
      },
      onError: (err: ApiError) => message.error(err.message ?? '保存失败'),
    });

    const handleSave = () => {
      if (draftCanvas.nodes.length === 0) {
        message.warning('画布为空，请先拖拽节点编排');
        return;
      }
      const endNodes = draftCanvas.nodes.filter((n) => n.type === 'END');
      if (endNodes.length === 0) {
        message.warning('决策流需至少包含一个结束节点');
        return;
      }
      const missingDecision = endNodes.filter((n) => !n.config?.endDecision);
      if (missingDecision.length > 0) {
        message.error('存在未配置决策结果的结束节点，请在节点配置抽屉中补全');
        return;
      }
      saveMutation.mutate(draftCanvas);
    };

    const handleReset = () => {
      if (!dirty) {
        setDraftCanvas(baselineCanvas);
        return;
      }
      Modal.confirm({
        title: '重置画布？',
        content: '将丢弃当前未保存的编辑内容。',
        okText: '重置',
        cancelText: '取消',
        onOk: () => setDraftCanvas(baselineCanvas),
      });
    };

    useImperativeHandle(ref, () => ({ save: handleSave, reset: handleReset }), [
      draftCanvas,
      baselineCanvas,
      dirty,
      flowDetail,
      flowMeta,
      flowId,
    ]);

    if (flowId == null) {
      return <Empty description="请选择决策流" />;
    }

    const loading = versionsLoading || (readonly ? snapshotLoading : detailLoading);

    if (loading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Spin />
        </div>
      );
    }

    if (readonly && !targetVersion && !readonlyVersionNo) {
      return <Empty description="暂无上线版本可展示" />;
    }

    if (immersive) {
      return (
        <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {readonly && readonlyVersionNo != null ? (
            <Typography.Text
              type="secondary"
              style={{ padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid #f0f0f0' }}
            >
              运行区 · 当前上线版本 v{readonlyVersionNo}
            </Typography.Text>
          ) : null}
          <div style={{ flex: 1, minHeight: 0 }}>
            <FlowCanvasBoard
              value={draftCanvas}
              onChange={readonly ? () => {} : setDraftCanvas}
              readonly={readonly}
              fillHeight
            />
          </div>
        </div>
      );
    }

    return (
      <FlowCanvasBoard
        value={draftCanvas}
        onChange={readonly ? () => {} : setDraftCanvas}
        readonly={readonly}
      />
    );
  },
);

export default FlowCanvasEditor;
