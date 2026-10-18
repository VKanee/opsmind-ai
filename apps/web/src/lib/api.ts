import type {
  Approval,
  AuditEvent,
  EvidenceItem,
  Incident,
  Investigation,
  KnowledgeDocument,
  LoginResponse,
  Overview,
  SourceType,
  Severity,
  User,
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
const TOKEN_KEY = "opsmind.access_token";
const USER_KEY = "opsmind.user";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getStoredToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const value = window.localStorage.getItem(USER_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as User;
  } catch {
    return null;
  }
}

export function storeSession(session: LoginResponse): void {
  window.localStorage.setItem(TOKEN_KEY, session.access_token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = "请求失败";
    try {
      const body = (await response.json()) as { detail?: string };
      message = body.detail ?? message;
    } catch {
      message = response.statusText;
    }
    if (response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event("opsmind:unauthorized"));
    }
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as T;
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      organization_slug: "acme-cloud",
      email,
      password,
    }),
  });
}

export async function getOverview(): Promise<Overview> {
  return request<Overview>("/system/overview");
}

export async function listIncidents(params?: {
  status?: string;
  severity?: string;
}): Promise<Incident[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set("status", params.status);
  if (params?.severity) query.set("severity", params.severity);
  const suffix = query.size ? `?${query.toString()}` : "";
  return request<Incident[]>(`/incidents${suffix}`);
}

export async function getIncident(id: string): Promise<Incident> {
  return request<Incident>(`/incidents/${id}`);
}

export async function createIncident(payload: {
  title: string;
  description: string;
  service: string;
  severity: Severity;
  tags: string[];
}): Promise<Incident> {
  return request<Incident>("/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateIncidentStatus(
  id: string,
  status: Incident["status"],
): Promise<Incident> {
  return request<Incident>(`/incidents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function listInvestigations(
  incidentId: string,
): Promise<Investigation[]> {
  return request<Investigation[]>(`/incidents/${incidentId}/investigations`);
}

export async function runInvestigation(
  incidentId: string,
): Promise<Investigation> {
  return request<Investigation>(`/incidents/${incidentId}/investigations`, {
    method: "POST",
  });
}

export async function listKnowledge(): Promise<KnowledgeDocument[]> {
  return request<KnowledgeDocument[]>("/knowledge/documents");
}

export async function searchKnowledge(
  query: string,
): Promise<EvidenceItem[]> {
  const response = await request<{ results: EvidenceItem[] }>(
    "/knowledge/search",
    {
      method: "POST",
      body: JSON.stringify({ query, limit: 8 }),
    },
  );
  return response.results;
}

export async function createKnowledge(payload: {
  title: string;
  source_type: SourceType;
  content: string;
  tags: string[];
}): Promise<KnowledgeDocument> {
  return request<KnowledgeDocument>("/knowledge/documents", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      trust_level: "verified",
    }),
  });
}

export async function listApprovals(
  status?: string,
): Promise<Approval[]> {
  const suffix = status ? `?status=${status}` : "";
  return request<Approval[]>(`/approvals${suffix}`);
}

export async function decideApproval(
  id: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<Approval> {
  return request<Approval>(`/approvals/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, note }),
  });
}

export async function listAudit(): Promise<AuditEvent[]> {
  return request<AuditEvent[]>("/audit/events?limit=200");
}
