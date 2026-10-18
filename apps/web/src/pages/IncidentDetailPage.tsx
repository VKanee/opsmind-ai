import {
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Cpu,
  FileText,
  GitBranch,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  RadioTower,
  ShieldAlert,
  Sparkles,
  Tag,
  TerminalSquare,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ApprovalBadge,
  ErrorPanel,
  PageHeader,
  RiskBadge,
  SeverityBadge,
  SourceBadge,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import {
  decideApproval,
  getIncident,
  listApprovals,
  listInvestigations,
  runInvestigation,
  updateIncidentStatus,
} from "@/lib/api";
import {
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  titleCase,
} from "@/lib/format";
import type {
  Approval,
  EvidenceItem,
  Incident,
  IncidentStatus,
  Investigation,
  RecommendedAction,
} from "@/types";

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [error, setError] = useState("");
  const [decisionApproval, setDecisionApproval] = useState<Approval | null>(null);
  const canWrite = user?.role === "admin" || user?.role === "responder";

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [incidentData, investigationData, approvalData] = await Promise.all([
        getIncident(id),
        listInvestigations(id),
        listApprovals(),
      ]);
      setIncident(incidentData);
      setInvestigation(investigationData[0] ?? null);
      setApprovals(approvalData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load incident");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function investigate() {
    if (!incident) return;
    setRunning(true);
    setError("");
    try {
      const result = await runInvestigation(incident.id);
      setInvestigation(result);
      setIncident(await getIncident(incident.id));
      setApprovals(await listApprovals());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Investigation failed");
    } finally {
      setRunning(false);
    }
  }

  async function changeStatus(nextStatus: IncidentStatus) {
    if (!incident) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateIncidentStatus(incident.id, nextStatus);
      setIncident(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update status");
    } finally {
      setUpdatingStatus(false);
    }
  }

  if (loading && !incident) return <Spinner label="Opening incident workspace" />;
  if (error && !incident) return <ErrorPanel message={error} onRetry={load} />;
  if (!incident) return null;

  const matchingApprovals = approvals.filter(
    (approval) => approval.investigation_id === investigation?.id,
  );

  return (
    <div className="page-stack">
      <Link className="back-link" to="/incidents">
        <ArrowLeft size={15} />
        Incident queue
      </Link>

      <section className="incident-command-header">
        <div className="incident-command-main">
          <div className="incident-identity">
            <SeverityBadge severity={incident.severity} />
            <span className="mono-copy">{incident.public_id}</span>
            <StatusBadge status={incident.status} />
          </div>
          <PageHeader
            title={incident.title}
            description={incident.description}
            action={
              canWrite ? (
                <div className="header-actions">
                  {incident.status !== "mitigated" && incident.status !== "resolved" ? (
                    <button
                      className="button button-quiet"
                      disabled={updatingStatus}
                      onClick={() => void changeStatus("mitigated")}
                    >
                      <CheckCircle2 size={15} />
                      Mitigate
                    </button>
                  ) : null}
                  {incident.status !== "resolved" ? (
                    <button
                      className="button button-primary"
                      disabled={updatingStatus}
                      onClick={() => void changeStatus("resolved")}
                    >
                      Resolve
                    </button>
                  ) : null}
                </div>
              ) : undefined
            }
          />
        </div>
        <div className="incident-meta-strip">
          <div>
            <span>Service</span>
            <strong>{incident.service}</strong>
          </div>
          <div>
            <span>Started</span>
            <strong>{formatDateTime(incident.started_at)}</strong>
          </div>
          <div>
            <span>Duration</span>
            <strong>{formatDuration(incident.started_at, incident.resolved_at)}</strong>
          </div>
          <div>
            <span>Owner</span>
            <strong>{incident.owner_name ?? "Unassigned"}</strong>
          </div>
        </div>
      </section>

      {error ? <ErrorPanel message={error} onRetry={load} /> : null}

      <section className="signal-strip" aria-label="Incident signals">
        {incident.signals.map((signal) => (
          <article className={`signal-card signal-${signal.status}`} key={signal.name}>
            <div>
              <span>{signal.name}</span>
              <span className={`signal-status signal-${signal.status}`}>
                {signal.status === "critical"
                  ? "Critical"
                  : signal.status === "warning"
                    ? "Elevated"
                    : "Normal"}
              </span>
            </div>
            <strong>
              {signal.value}
              {signal.unit ? <small>{signal.unit}</small> : null}
            </strong>
          </article>
        ))}
        <article className="signal-card signal-neutral">
          <div>
            <span>Tags</span>
            <Tag size={14} />
          </div>
          <strong className="signal-tags">
            {incident.tags.length ? incident.tags.join(" / ") : "No tags"}
          </strong>
        </article>
      </section>

      <div className="detail-grid">
        <div className="detail-main-stack">
          {investigation ? (
            <InvestigationWorkspace
              investigation={investigation}
              approvals={matchingApprovals}
              onRun={investigate}
              running={running}
              canWrite={canWrite}
              onDecision={setDecisionApproval}
            />
          ) : (
            <section className="investigation-launch">
              <div className="investigation-launch-icon">
                <Sparkles size={25} />
              </div>
              <div>
                <div className="eyebrow">AI INVESTIGATION</div>
                <h2>Build an evidence-backed response</h2>
                <p>
                  Correlate incident signals with runbooks, service maps and prior postmortems.
                </p>
              </div>
              <button
                className="button button-primary"
                disabled={!canWrite || running}
                onClick={() => void investigate()}
              >
                {running ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
                {running ? "Investigating" : "Run investigation"}
              </button>
            </section>
          )}
        </div>

        <aside className="detail-rail">
          <section className="panel rail-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">INCIDENT POSTURE</div>
                <h2>Response facts</h2>
              </div>
              <RadioTower size={17} />
            </div>
            <dl className="fact-list">
              <div>
                <dt>Detected</dt>
                <dd>{formatRelativeTime(incident.detected_at)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatRelativeTime(incident.updated_at)}</dd>
              </div>
              <div>
                <dt>Resolution</dt>
                <dd>{incident.resolved_at ? formatDateTime(incident.resolved_at) : "Open"}</dd>
              </div>
              <div>
                <dt>Investigation</dt>
                <dd>{investigation ? titleCase(investigation.status) : "Not started"}</dd>
              </div>
            </dl>
          </section>
          {investigation ? (
            <section className="panel rail-panel">
              <div className="panel-heading">
                <div>
                  <div className="eyebrow">AGENT TRACE</div>
                  <h2>Execution path</h2>
                </div>
                <GitBranch size={17} />
              </div>
              <div className="trace-list">
                {investigation.trace.map((step, index) => (
                  <div className="trace-row" key={step.step}>
                    <span className="trace-index">{index + 1}</span>
                    <div>
                      <strong>{titleCase(step.step)}</strong>
                      <span>{step.details}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="model-footnote">
                <Cpu size={14} />
                <span>
                  {investigation.model_name} · {investigation.latency_ms} ms
                </span>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {decisionApproval ? (
        <DecisionModal
          approval={decisionApproval}
          onClose={() => setDecisionApproval(null)}
          onDecided={async () => {
            setDecisionApproval(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function InvestigationWorkspace({
  investigation,
  approvals,
  onRun,
  running,
  canWrite,
  onDecision,
}: {
  investigation: Investigation;
  approvals: Approval[];
  onRun: () => Promise<void>;
  running: boolean;
  canWrite: boolean;
  onDecision: (approval: Approval) => void;
}) {
  function approvalFor(actionIndex: number) {
    return approvals.find((approval) => approval.action_index === actionIndex);
  }

  return (
    <section className="investigation-panel">
      <div className="investigation-header">
        <div>
          <div className="eyebrow">AI INVESTIGATION</div>
          <h2>RCA workspace</h2>
        </div>
        <div className="investigation-header-meta">
          <span className="model-chip">
            <Sparkles size={13} />
            {investigation.model_name}
          </span>
          <span>{formatRelativeTime(investigation.created_at)}</span>
          {canWrite ? (
            <button
              className="button button-quiet button-small"
              onClick={() => void onRun()}
              disabled={running}
            >
              {running ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}
              Re-run
            </button>
          ) : null}
        </div>
      </div>

      <div className="analysis-summary">
        <div className="analysis-summary-icon">
          <Lightbulb size={20} />
        </div>
        <p>{investigation.summary}</p>
      </div>

      <AnalysisSection
        icon={GitBranch}
        eyebrow="RANKED CAUSES"
        title="Hypotheses"
        count={investigation.hypotheses.length}
      >
        <div className="hypothesis-list">
          {investigation.hypotheses.map((hypothesis, index) => (
            <article className="hypothesis" key={hypothesis.id}>
              <div className="hypothesis-head">
                <span className="hypothesis-rank">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{hypothesis.title}</strong>
                  <span>{hypothesis.rationale}</span>
                </div>
                <div className="confidence">
                  <strong>{Math.round(hypothesis.confidence * 100)}%</strong>
                  <span>confidence</span>
                </div>
              </div>
              <div className="confidence-track">
                <span style={{ width: `${hypothesis.confidence * 100}%` }} />
              </div>
            </article>
          ))}
        </div>
      </AnalysisSection>

      <AnalysisSection
        icon={BookOpenText}
        eyebrow="RETRIEVAL"
        title="Evidence chain"
        count={investigation.evidence.length}
      >
        <div className="evidence-grid">
          {investigation.evidence.map((evidence, index) => (
            <EvidenceCard evidence={evidence} index={index} key={evidence.chunk_id} />
          ))}
        </div>
      </AnalysisSection>

      <AnalysisSection
        icon={ListChecks}
        eyebrow="CONTROLLED RESPONSE"
        title="Action plan"
        count={investigation.actions.length}
      >
        <div className="action-list">
          {investigation.actions.map((action, index) => (
            <ActionRow
              key={action.id}
              action={action}
              approval={approvalFor(index)}
              canWrite={canWrite}
              onDecision={onDecision}
            />
          ))}
        </div>
      </AnalysisSection>
    </section>
  );
}

function AnalysisSection({
  icon: Icon,
  eyebrow,
  title,
  count,
  children,
}: {
  icon: typeof GitBranch;
  eyebrow: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="analysis-section">
      <div className="analysis-section-head">
        <div className="analysis-section-title">
          <Icon size={17} />
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h3>{title}</h3>
          </div>
        </div>
        <span className="count-chip">{count}</span>
      </div>
      {children}
    </div>
  );
}

function EvidenceCard({ evidence, index }: { evidence: EvidenceItem; index: number }) {
  return (
    <article className="evidence-card">
      <div className="evidence-head">
        <span className="evidence-index">E{index + 1}</span>
        <SourceBadge source={evidence.source_type} />
        <span className="match-score">{Math.round(evidence.relevance_score * 100)}% match</span>
      </div>
      <h4>{evidence.document_title}</h4>
      <p>{evidence.snippet}</p>
      <div className="evidence-foot">
        <FileText size={13} />
        <span>Chunk {evidence.chunk_id.slice(0, 8)}</span>
      </div>
    </article>
  );
}

function ActionRow({
  action,
  approval,
  canWrite,
  onDecision,
}: {
  action: RecommendedAction;
  approval?: Approval;
  canWrite: boolean;
  onDecision: (approval: Approval) => void;
}) {
  return (
    <article className="action-row">
      <div className="action-icon">
        {action.approval_required ? <ShieldAlert size={17} /> : <TerminalSquare size={17} />}
      </div>
      <div className="action-copy">
        <div className="action-title-line">
          <strong>{action.title}</strong>
          <RiskBadge risk={action.risk_level} />
          {approval ? <ApprovalBadge status={approval.status} /> : null}
        </div>
        <p>{action.description}</p>
        <span>
          {action.approval_required ? "Human approval required" : "Read-only diagnostic"} ·{" "}
          {action.evidence_ids.length} evidence sources
        </span>
      </div>
      {approval?.status === "pending" && canWrite ? (
        <button className="button button-quiet button-small" onClick={() => onDecision(approval)}>
          Decide
          <ChevronRight size={14} />
        </button>
      ) : null}
      {!approval && action.simulation_only ? (
        <span className="simulation-flag">
          <CircleDot size={12} />
          Dry run
        </span>
      ) : null}
    </article>
  );
}

function DecisionModal({
  approval,
  onClose,
  onDecided,
}: {
  approval: Approval;
  onClose: () => void;
  onDecided: () => Promise<void>;
}) {
  const [note, setNote] = useState("");
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
        aria-label="Review approval"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="eyebrow">PRODUCTION ACTION</div>
            <h2>Review recommendation</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <ArrowLeft size={17} />
          </button>
        </div>
        <div className="decision-summary">
          <RiskBadge risk={approval.risk_level} />
          <h3>{approval.action_title}</h3>
          <p>This demo records the decision without executing infrastructure commands.</p>
        </div>
        <label className="field field-full">
          <span>Decision note</span>
          <textarea
            rows={4}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Record the evidence or operational reason for this decision."
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button
            className="button button-danger"
            disabled={submitting}
            onClick={() => void decide("rejected")}
          >
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
      </section>
    </div>
  );
}
