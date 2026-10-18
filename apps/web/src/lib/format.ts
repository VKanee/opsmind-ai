import type {
  ApprovalStatus,
  IncidentStatus,
  RiskLevel,
  Severity,
} from "@/types";

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatRelativeTime(value: string): string {
  const difference = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function formatDuration(startedAt: string, resolvedAt?: string | null): string {
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const minutes = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours} 小时 ${remainder} 分钟`;
}

const LABELS: Record<string, string> = {
  admin: "管理员",
  responder: "响应者",
  viewer: "只读用户",
  runbook: "处置手册",
  postmortem: "复盘报告",
  service_doc: "服务文档",
  policy: "制度规范",
  pending: "待审批",
  approved: "已批准",
  rejected: "已拒绝",
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  open: "待处理",
  investigating: "调查中",
  mitigated: "已缓解",
  resolved: "已解决",
  completed: "已完成",
  failed: "失败",
  verified: "已验证",
  draft: "草稿",
  deprecated: "已废弃",
  all: "全部",
  normalize_incident: "解析事故信息",
  retrieve_evidence: "检索证据",
  correlate_history: "关联历史事故",
  generate_hypotheses: "生成故障假设",
  policy_check: "安全策略检查",
  "investigation.completed": "完成 AI 调查",
  "approval.approved": "批准处置建议",
  "approval.rejected": "驳回处置建议",
  "incident.created": "创建事故",
  "incident.updated": "更新事故",
  "knowledge.created": "新增知识",
  "auth.login": "用户登录",
  approval: "审批",
  incident: "事故",
  investigation: "调查",
  knowledge_document: "知识文档",
  session: "登录会话",
};

export function titleCase(value: string): string {
  const normalized = value.toLowerCase();
  if (LABELS[normalized]) return LABELS[normalized];
  if (LABELS[value]) return LABELS[value];
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
