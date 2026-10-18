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
      setError(cause instanceof Error ? cause.message : "Unable to load approvals");
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
        eyebrow="HUMAN CONTROL"
        title="Approval queue"
        description="Review production-changing recommendations before they leave the control plane."
        action={
          <div className="approval-summary-chip">
            <ShieldAlert size={15} />
            {pendingCount} awaiting decision
          </div>
        }
      />

      <section className="panel approvals-panel">
        <div className="tab-bar" role="tablist" aria-label="Approval status filter">
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
        {loading ? <Spinner label="Loading approvals" /> : null}
        {!loading && !error && approvals.length === 0 ? (
          <EmptyPanel
            title={filter === "pending" ? "Queue is clear" : "No approvals in this view"}
            message={
              filter === "pending"
                ? "Every production action currently has an auditable decision."
                : "Switch filters to inspect other decisions."
            }
            icon={ClipboardCheck}
          />
        ) : null}

        {!loading && approvals.length > 0 ? (
          <div className="approval-table">
            <div className="table-head approval-grid">
              <span>Recommended action</span>
              <span>Risk</span>
              <span>State</span>
              <span>Created</span>
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
                    <span>Investigation {approval.investigation_id.slice(0, 8)}</span>
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
                        title="Approve"
                        aria-label="Approve action"
                        onClick={() => setSelected(approval)}
                      >
                        <Check size={17} />
                      </button>
                      <button
                        className="icon-button reject-icon"
                        title="Reject"
                        aria-label="Reject action"
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
                      Details
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
      setError(cause instanceof Error ? cause.message : "Unable to record decision");
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
        aria-label="Approval details"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">GOVERNED ACTION</div>
            <h2>{approval.status === "pending" ? "Review action" : "Decision record"}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
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
            Requested {formatRelativeTime(approval.created_at)} by investigation{" "}
            {approval.investigation_id.slice(0, 8)}.
          </p>
        </div>
        <label className="field field-full">
          <span>Decision note</span>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            readOnly={!canDecide || approval.status !== "pending"}
            placeholder="Record validation evidence or the reason for rejection."
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
              Reject
            </button>
            <button
              className="button button-primary"
              disabled={submitting}
              onClick={() => void decide("approved")}
            >
              <CheckCircle2 size={15} />
              Approve
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            <button className="button button-quiet" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
