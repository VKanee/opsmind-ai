import {
  Activity,
  FileKey2,
  Filter,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  EmptyPanel,
  ErrorPanel,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { listAudit } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";
import type { AuditEvent } from "@/types";

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEvents(await listAudit());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法加载审计日志");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.toLowerCase().trim();
    if (!needle) return events;
    return events.filter(
      (event) =>
        event.action.toLowerCase().includes(needle) ||
        event.resource_type.toLowerCase().includes(needle) ||
        event.resource_id.toLowerCase().includes(needle),
    );
  }, [events, query]);

  const humanActions = events.filter(
    (event) => event.action.startsWith("approval.") || event.action.startsWith("incident."),
  ).length;
  const aiActions = events.filter((event) => event.action.startsWith("investigation.")).length;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="不可变历史"
        title="审计日志"
        description="记录事故变更、AI 调查和人工审批的操作者、时间与上下文。"
      />

      <section className="audit-stat-band">
        <div>
          <Activity size={18} />
          <span>已记录事件</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <ShieldCheck size={18} />
          <span>人工决策</span>
          <strong>{humanActions}</strong>
        </div>
        <div>
          <FileKey2 size={18} />
          <span>AI 调查</span>
          <strong>{aiActions}</strong>
        </div>
      </section>

      <section className="panel audit-panel">
        <div className="queue-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="筛选操作或资源"
              aria-label="筛选审计日志"
            />
          </div>
          <div className="filter-label">
            <Filter size={14} />
            最新优先
          </div>
        </div>

        {error ? <ErrorPanel message={error} onRetry={load} /> : null}
        {loading ? <Spinner label="正在加载审计日志" /> : null}
        {!loading && !filtered.length ? (
          <EmptyPanel
            title="暂无审计事件"
            message="使用工作区后，相关操作会记录在这里。"
            icon={Activity}
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="audit-table">
            <div className="table-head audit-grid">
              <span>事件</span>
              <span>资源</span>
              <span>操作者</span>
              <span>时间</span>
            </div>
            {filtered.map((event) => (
              <div className="audit-grid audit-row" key={event.id}>
                <div className="audit-event">
                  <span className="audit-dot" />
                  <div>
                    <strong>{titleCase(event.action)}</strong>
                    <span>{Object.keys(event.details).slice(0, 3).join(" · ")}</span>
                  </div>
                </div>
                <div className="audit-resource">
                  <span>{titleCase(event.resource_type)}</span>
                  <code>{event.resource_id.slice(0, 12)}</code>
                </div>
                <div className="audit-actor">
                  <UserRound size={14} />
                  <span>{event.actor_id ? event.actor_id.slice(0, 8) : "系统"}</span>
                </div>
                <span className="muted-copy">{formatDateTime(event.created_at)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
