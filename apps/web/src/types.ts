export type Role = "admin" | "responder" | "viewer";
export type Severity = "sev1" | "sev2" | "sev3" | "sev4";
export type IncidentStatus =
  | "open"
  | "investigating"
  | "mitigated"
  | "resolved";
export type RiskLevel = "low" | "medium" | "high";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type SourceType = "runbook" | "postmortem" | "service_doc" | "policy";

export interface User {
  id: string;
  organization_id: string;
  email: string;
  display_name: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Signal {
  name: string;
  value: string;
  unit?: string | null;
  status: "normal" | "warning" | "critical";
}

export interface Incident {
  id: string;
  public_id: string;
  title: string;
  description: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  owner_id: string | null;
  owner_name: string | null;
  started_at: string;
  detected_at: string;
  resolved_at: string | null;
  tags: string[];
  signals: Signal[];
  created_at: string;
  updated_at: string;
}

export interface EvidenceItem {
  chunk_id: string;
  document_id: string;
  document_title: string;
  source_type: SourceType;
  snippet: string;
  relevance_score: number;
}

export interface Hypothesis {
  id: string;
  title: string;
  confidence: number;
  rationale: string;
  evidence_ids: string[];
}

export interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  risk_level: RiskLevel;
  approval_required: boolean;
  evidence_ids: string[];
  status: "proposed" | "approved" | "rejected";
  simulation_only: boolean;
}

export interface Investigation {
  id: string;
  incident_id: string;
  status: "completed" | "failed";
  summary: string;
  hypotheses: Hypothesis[];
  evidence: EvidenceItem[];
  actions: RecommendedAction[];
  trace: Array<{
    step: string;
    status: string;
    details: string;
  }>;
  model_name: string;
  prompt_version: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  created_by_id: string;
  created_at: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  source_type: SourceType;
  content: string;
  tags: string[];
  version: number;
  trust_level: "verified" | "draft" | "deprecated";
  created_at: string;
  updated_at: string;
}

export interface Approval {
  id: string;
  investigation_id: string;
  action_index: number;
  action_title: string;
  risk_level: RiskLevel;
  status: ApprovalStatus;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  actor_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface IncidentSummary {
  id: string;
  public_id: string;
  title: string;
  service: string;
  severity: Severity;
  status: IncidentStatus;
  started_at: string;
}

export interface Overview {
  organization_name: string;
  active_incidents: number;
  open_approvals: number;
  knowledge_documents: number;
  investigations: number;
  evidence_coverage: number;
  severity_counts: Record<string, number>;
  recent_incidents: IncidentSummary[];
  recent_audit: AuditEvent[];
  services: Array<{
    name: string;
    active: number;
    resolved: number;
    worst_severity: Severity;
  }>;
}
