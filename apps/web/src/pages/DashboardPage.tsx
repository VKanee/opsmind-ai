import {
  Activity,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  RadioTower,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  ApprovalBadge,
  ErrorPanel,
  Metric,
  PageHeader,
  SeverityBadge,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { getOverview, listApprovals } from "@/lib/api";
import { formatRelativeTime, titleCase } from "@/lib/format";
import type { Approval, Overview } from "@/types";

export function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewData, approvalData] = await Promise.all([
        getOverview(),
        listApprovals("pending"),
      ]);
      setOverview(overviewData);
      setApprovals(approvalData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) return <Spinner label="Loading operations workspace" />;
  if (error && !overview) return <ErrorPanel message={error} onRetry={load} />;
  if (!overview) return null;

  const totalSeverity = Object.values(overview.severity_counts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const sev1 = overview.severity_counts.sev1 ?? 0;
  const sev2 = overview.severity_counts.sev2 ?? 0;
  const sev3 = overview.severity_counts.sev3 ?? 0;
  const sev4 = overview.severity_counts.sev4 ?? 0;
  const activeServices = overview.services.filter((service) => service.active > 0);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="ON-CALL COMMAND"
        title="Operations overview"
        description="Live posture across active incidents, AI investigations and governed actions."
        action={
          <Link className="button button-primary" to="/incidents">
            Open incident queue
            <ArrowRight size={15} />
          </Link>
        }
      />

      <section className="metric-grid" aria-label="Operational metrics">
        <Metric
          label="Active incidents"
          value={overview.active_incidents}
          detail={`${sev1} SEV1 incident${sev1 === 1 ? "" : "s"} in progress`}
          icon={RadioTower}
          tone={sev1 > 0 ? "danger" : "default"}
        />
        <Metric
          label="Pending approvals"
          value={overview.open_approvals}
          detail="Production actions gated"
          icon={ShieldAlert}
          tone={overview.open_approvals > 0 ? "warning" : "success"}
        />
        <Metric
          label="Knowledge sources"
          value={overview.knowledge_documents}
          detail="Verified operational references"
          icon={BookOpenText}
        />
        <Metric
          label="Evidence coverage"
          value={`${Math.round(overview.evidence_coverage * 100)}%`}
          detail={`${overview.investigations} investigations recorded`}
          icon={Sparkles}
          tone="success"
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel panel-main">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">ACTIVE WORK</div>
              <h2>Incident queue</h2>
            </div>
            <Link className="text-link" to="/incidents">
              View all
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="incident-table">
            <div className="table-head incident-table-grid">
              <span>Incident</span>
              <span>Service</span>
              <span>Status</span>
              <span>Age</span>
            </div>
            {overview.recent_incidents.map((incident) => (
              <Link
                key={incident.id}
                to={`/incidents/${incident.id}`}
                className="incident-table-grid table-row"
              >
                <div className="incident-primary">
                  <SeverityBadge severity={incident.severity} />
                  <div>
                    <strong>{incident.title}</strong>
                    <span>{incident.public_id}</span>
                  </div>
                </div>
                <span className="mono-copy">{incident.service}</span>
                <StatusBadge status={incident.status} />
                <span className="muted-copy">{formatRelativeTime(incident.started_at)}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel panel-side">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">RISK DISTRIBUTION</div>
              <h2>Severity mix</h2>
            </div>
            <span className="panel-total">{totalSeverity} total</span>
          </div>
          <div className="severity-stack">
            {[
              ["sev1", sev1, "Critical"],
              ["sev2", sev2, "High"],
              ["sev3", sev3, "Moderate"],
              ["sev4", sev4, "Low"],
            ].map(([severity, count, label]) => (
              <div className="severity-row" key={String(severity)}>
                <div className="severity-row-label">
                  <span className={`severity-marker severity-${severity}`} />
                  <span>{label}</span>
                </div>
                <div className="severity-track">
                  <span
                    className={`severity-fill severity-${severity}`}
                    style={{
                      width: `${totalSeverity ? (Number(count) / totalSeverity) * 100 : 0}%`,
                    }}
                  />
                </div>
                <strong>{String(count)}</strong>
              </div>
            ))}
          </div>
          <div className="panel-rule" />
          <div className="panel-heading compact-heading">
            <div>
              <div className="eyebrow">SERVICE POSTURE</div>
              <h2>Active services</h2>
            </div>
          </div>
          <div className="service-list">
            {activeServices.slice(0, 4).map((service) => (
              <div className="service-row" key={service.name}>
                <div>
                  <strong>{service.name}</strong>
                  <span>{service.active} active</span>
                </div>
                <SeverityBadge severity={service.worst_severity} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel-main">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">HUMAN CONTROL</div>
              <h2>Approval queue</h2>
            </div>
            <Link className="text-link" to="/approvals">
              Review
              <ArrowRight size={14} />
            </Link>
          </div>
          {approvals.length ? (
            <div className="approval-preview-list">
              {approvals.slice(0, 4).map((approval) => (
                <Link
                  to="/approvals"
                  className="approval-preview"
                  key={approval.id}
                >
                  <div className="approval-preview-icon">
                    <ClipboardCheck size={17} />
                  </div>
                  <div className="approval-preview-copy">
                    <strong>{approval.action_title}</strong>
                    <span>{formatRelativeTime(approval.created_at)}</span>
                  </div>
                  <ApprovalBadge status={approval.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="inline-empty">
              <CheckCircle2 size={18} />
              <span>No actions waiting for approval</span>
            </div>
          )}
        </section>

        <section className="panel panel-side">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">GOVERNANCE</div>
              <h2>Recent activity</h2>
            </div>
            <Activity size={17} className="muted-icon" />
          </div>
          <div className="activity-list">
            {overview.recent_audit.slice(0, 5).map((event) => (
              <div className="activity-row" key={event.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{titleCase(event.action.replace(".", " "))}</strong>
                  <span>
                    {event.resource_type} · {formatRelativeTime(event.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="health-band">
        <div className="health-band-lead">
          <DatabaseZap size={18} />
          <div>
            <strong>Control plane health</strong>
            <span>All critical platform dependencies responding</span>
          </div>
        </div>
        <div className="health-stat">
          <span>API</span>
          <strong>Healthy</strong>
        </div>
        <div className="health-stat">
          <span>Retrieval</span>
          <strong>Online</strong>
        </div>
        <div className="health-stat">
          <span>Evidence index</span>
          <strong>{overview.knowledge_documents} sources</strong>
        </div>
        <div className="health-stat">
          <span>Observability</span>
          <strong>Prometheus</strong>
        </div>
      </section>
    </div>
  );
}
