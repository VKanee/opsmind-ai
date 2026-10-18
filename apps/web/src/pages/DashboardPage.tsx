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
      setError(cause instanceof Error ? cause.message : "无法加载运营总览");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !overview) return <Spinner label="正在加载运营工作区" />;
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
        eyebrow="值班指挥中心"
        title="运营总览"
        description="实时查看进行中事故、AI 调查和待审批的生产变更。"
        action={
          <Link className="button button-primary" to="/incidents">
            打开事故队列
            <ArrowRight size={15} />
          </Link>
        }
      />

      <section className="metric-grid" aria-label="运营指标">
        <Metric
          label="进行中事故"
          value={overview.active_incidents}
          detail={`其中 ${sev1} 个 SEV1 事故正在处理`}
          icon={RadioTower}
          tone={sev1 > 0 ? "danger" : "default"}
        />
        <Metric
          label="待审批操作"
          value={overview.open_approvals}
          detail="生产变更已被审批门禁拦截"
          icon={ShieldAlert}
          tone={overview.open_approvals > 0 ? "warning" : "success"}
        />
        <Metric
          label="知识来源"
          value={overview.knowledge_documents}
          detail="已验证的运维参考资料"
          icon={BookOpenText}
        />
        <Metric
          label="证据覆盖率"
          value={`${Math.round(overview.evidence_coverage * 100)}%`}
          detail={`已记录 ${overview.investigations} 次 AI 调查`}
          icon={Sparkles}
          tone="success"
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel panel-main">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">当前工作</div>
              <h2>事故队列</h2>
            </div>
            <Link className="text-link" to="/incidents">
              查看全部
              <ArrowRight size={14} />
            </Link>
          </div>
          <div className="incident-table">
            <div className="table-head incident-table-grid">
              <span>事故</span>
              <span>服务</span>
              <span>状态</span>
              <span>持续时间</span>
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
              <div className="eyebrow">风险分布</div>
              <h2>事故等级</h2>
            </div>
            <span className="panel-total">共 {totalSeverity} 个</span>
          </div>
          <div className="severity-stack">
            {[
              ["sev1", sev1, "致命"],
              ["sev2", sev2, "严重"],
              ["sev3", sev3, "一般"],
              ["sev4", sev4, "轻微"],
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
              <div className="eyebrow">服务状态</div>
              <h2>存在活动事故的服务</h2>
            </div>
          </div>
          <div className="service-list">
            {activeServices.slice(0, 4).map((service) => (
              <div className="service-row" key={service.name}>
                <div>
                  <strong>{service.name}</strong>
                  <span>{service.active} 个活动事故</span>
                </div>
                <SeverityBadge severity={service.worst_severity} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel panel-main">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">人工控制</div>
              <h2>审批队列</h2>
            </div>
            <Link className="text-link" to="/approvals">
              查看审批
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
              <span>当前没有等待审批的操作</span>
            </div>
          )}
        </section>

        <section className="panel panel-side">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">治理记录</div>
              <h2>最近活动</h2>
            </div>
            <Activity size={17} className="muted-icon" />
          </div>
          <div className="activity-list">
            {overview.recent_audit.slice(0, 5).map((event) => (
              <div className="activity-row" key={event.id}>
                <span className="activity-dot" />
                <div>
                  <strong>{titleCase(event.action)}</strong>
                  <span>
                    {titleCase(event.resource_type)} · {formatRelativeTime(event.created_at)}
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
            <strong>控制面健康状态</strong>
            <span>所有关键平台依赖均正常响应</span>
          </div>
        </div>
        <div className="health-stat">
          <span>API 服务</span>
          <strong>健康</strong>
        </div>
        <div className="health-stat">
          <span>证据检索</span>
          <strong>在线</strong>
        </div>
        <div className="health-stat">
          <span>证据索引</span>
          <strong>{overview.knowledge_documents} 个来源</strong>
        </div>
        <div className="health-stat">
          <span>可观测性</span>
          <strong>Prometheus</strong>
        </div>
      </section>
    </div>
  );
}
