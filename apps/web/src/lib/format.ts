import type {
  ApprovalStatus,
  IncidentStatus,
  RiskLevel,
  Severity,
} from "@/types";

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDuration(startedAt: string, resolvedAt?: string | null): string {
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

export function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function severityLabel(value: Severity): string {
  return value.toUpperCase();
}

export function approvalLabel(status: ApprovalStatus): string {
  return titleCase(status);
}

export function riskLabel(risk: RiskLevel): string {
  return titleCase(risk);
}

export function incidentStatusLabel(status: IncidentStatus): string {
  return titleCase(status);
}
