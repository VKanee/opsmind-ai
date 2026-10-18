import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  ApprovalBadge,
  EmptyPanel,
  ErrorPanel,
  PageHeader,
  RiskBadge,
  Spinner,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { decideApproval, listApprovals } from "@/lib/api";
import { formatRelativeTime, titleCase } from "@/lib/format";
import type { Approval, ApprovalStatus } from "@/types";

type FilterValue = ApprovalStatus | "all";

export function ApprovalsPage() {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Approval | null>(null);
  const canDecide = user?.role === "admin" || user?.role === "responder";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setApprovals(await listApprovals(filter === "all" ? undefined : filter));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法加载审批列表");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount =
    filter === "pending" ? approvals.length : approvals.filter((item) => item.status === "pending").length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="人工控制"
        title="审批队列"
        description="所有生产变更建议必须在离开控制面之前完成人工审批。"
        action={
          <div className="approval-summary-chip">
            <ShieldAlert size={15} />
            {pendingCount} 项等待决策
          </div>
        }
      />

      <section className="panel approvals-panel">
        <div className="tab-bar" role="tablist" aria-label="审批状态筛选">
          {(["pending", "approved", "rejected", "all"] as FilterValue[]).map((value) => (
            <button
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? "tab-button active" : "tab-button"}
              onClick={() => setFilter(value)}
            >
              {titleCase(value)}
            </button>
          ))}
        </div>

        {error ? <ErrorPanel message={error} onRetry={load} /> : null}
        {loading ? <Spinner label="正在加载审批队列" /> : null}
        {!loading && !error && approvals.length === 0 ? (
          <EmptyPanel
            title={filter === "pending" ? "审批队列已清空" : "当前视图没有审批记录"}
            message={
              filter === "pending"
                ? "所有生产变更当前都有可审计的决策记录。"
                : "切换筛选条件查看其他审批记录。"
            }
            icon={ClipboardCheck}
          />
        ) : null}

        {!loading && approvals.length > 0 ? (
          <div className="approval-table">
            <div className="table-head approval-grid">
              <span>处置建议</span>
              <span>风险</span>
              <span>状态</span>
              <span>创建时间</span>
              <span />
            </div>
            {approvals.map((approval) => (
              <div className="approval-grid approval-row" key={approval.id}>
                <div className="approval-action">
                  <span className="approval-action-icon">
                    <ShieldAlert size={16} />
                  </span>
                  <div>
                    <strong>{approval.action_title}</strong>
                    <span>调查 {approval.investigation_id.slice(0, 8)}</span>
                  </div>
                </div>
                <RiskBadge risk={approval.risk_level} />
                <ApprovalBadge status={approval.status} />
                <span className="muted-copy">{formatRelativeTime(approval.created_at)}</span>
                <div className="row-actions">
                  {approval.status === "pending" && canDecide ? (
                    <>
                      <button
                        className="icon-button approve-icon"
                        title="批准"
                        aria-label="批准处置建议"
                        onClick={() => setSelected(approval)}
                      >
                        <Check size={17} />
                      </button>
                      <button
                        className="icon-button reject-icon"
                        title="驳回"
                        aria-label="驳回处置建议"
                        onClick={() => setSelected(approval)}
                      >
                        <X size={17} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="button button-quiet button-small"
                      onClick={() => setSelected(approval)}
                    >
                      详情
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {selected ? (
        <ApprovalModal
          approval={selected}
          canDecide={canDecide}
          onClose={() => setSelected(null)}
          onDecided={async () => {
            setSelected(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function ApprovalModal({
  approval,
  canDecide,
  onClose,
  onDecided,
}: {
  approval: Approval;
  canDecide: boolean;
  onClose: () => void;
  onDecided: () => Promise<void>;
}) {
  const [note, setNote] = useState(approval.decision_note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "approved" | "rejected") {
    setSubmitting(true);
    setError("");
    try {
      await decideApproval(approval.id, decision, note);
      await onDecided();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法记录审批决策");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        style={{ maxWidth: "560px" }}
        role="dialog"
        aria-modal="true"
        aria-label="审批详情"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">受控操作</div>
            <h2>{approval.status === "pending" ? "审核处置建议" : "审批记录"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="decision-summary">
          <div className="decision-badges">
            <RiskBadge risk={approval.risk_level} />
            <ApprovalBadge status={approval.status} />
          </div>
          <h3>{approval.action_title}</h3>
          <p>
            由调查 {approval.investigation_id.slice(0, 8)} 于{" "}
            {formatRelativeTime(approval.created_at)}发起。
          </p>
        </div>
        <label className="field field-full">
          <span>审批说明</span>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            readOnly={!canDecide || approval.status !== "pending"}
            placeholder="填写验证依据、批准理由或驳回原因。"
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        {approval.status === "pending" && canDecide ? (
          <div className="modal-actions">
            <button
              className="button button-danger"
              disabled={submitting}
              onClick={() => void decide("rejected")}
            >
              <XCircle size={15} />
              驳回
            </button>
            <button
              className="button button-primary"
              disabled={submitting}
              onClick={() => void decide("approved")}
            >
              <CheckCircle2 size={15} />
              批准
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            <button className="button button-quiet" onClick={onClose}>
              关闭
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
