import {
  AlertCircle,
  ArrowRight,
  Check,
  LoaderCircle,
  ShieldAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import {
  approvalLabel,
  incidentStatusLabel,
  riskLabel,
  severityLabel,
  titleCase,
} from "@/lib/format";
import type {
  ApprovalStatus,
  IncidentStatus,
  RiskLevel,
  Severity,
  SourceType,
} from "@/types";

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge severity-${severity}`}>
      <span className="badge-dot" />
      {severityLabel(severity)}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`badge status-${status}`}>{incidentStatusLabel(status)}</span>;
}

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const Icon = status === "approved" ? Check : status === "rejected" ? X : ShieldAlert;
  return (
    <span className={`badge approval-${status}`}>
      <Icon size={12} strokeWidth={2.2} />
      {approvalLabel(status)}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`badge risk-${risk}`}>{riskLabel(risk)}</span>;
}

export function SourceBadge({ source }: { source: SourceType }) {
  return <span className="badge source-badge">{titleCase(source)}</span>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="page-header-action">{action}</div> : null}
    </header>
  );
}

export function Metric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  return (
    <article className={`metric metric-${tone}`}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={20} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-panel" role="alert">
      <AlertCircle size={19} />
      <div>
        <strong>Request unavailable</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button className="button button-quiet" onClick={onRetry}>
          Retry
          <ArrowRight size={15} />
        </button>
      ) : null}
    </div>
  );
}

export function EmptyPanel({
  title,
  message,
  icon: Icon,
  action,
}: {
  title: string;
  message: string;
  icon: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="empty-panel">
      <div className="empty-icon">
        <Icon size={22} />
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
  width = "520px",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal"
        style={{ maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
