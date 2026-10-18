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
      setError(cause instanceof Error ? cause.message : "Unable to load audit trail");
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
        eyebrow="IMMUTABLE HISTORY"
        title="Audit trail"
        description="Every incident change, investigation and human decision with actor and time context."
      />

      <section className="audit-stat-band">
        <div>
          <Activity size={18} />
          <span>Recorded events</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <ShieldCheck size={18} />
          <span>Human decisions</span>
          <strong>{humanActions}</strong>
        </div>
        <div>
          <FileKey2 size={18} />
          <span>AI investigations</span>
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
              placeholder="Filter actions or resources"
              aria-label="Filter audit trail"
            />
          </div>
          <div className="filter-label">
            <Filter size={14} />
            Newest first
          </div>
        </div>

        {error ? <ErrorPanel message={error} onRetry={load} /> : null}
        {loading ? <Spinner label="Loading audit trail" /> : null}
        {!loading && !filtered.length ? (
          <EmptyPanel
            title="No audit events"
            message="Actions will appear here as the workspace is used."
            icon={Activity}
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="audit-table">
            <div className="table-head audit-grid">
              <span>Event</span>
              <span>Resource</span>
              <span>Actor</span>
              <span>Timestamp</span>
            </div>
            {filtered.map((event) => (
              <div className="audit-grid audit-row" key={event.id}>
                <div className="audit-event">
                  <span className="audit-dot" />
                  <div>
                    <strong>{titleCase(event.action.replaceAll(".", " "))}</strong>
                    <span>{Object.keys(event.details).slice(0, 3).join(" · ")}</span>
                  </div>
                </div>
                <div className="audit-resource">
                  <span>{titleCase(event.resource_type)}</span>
                  <code>{event.resource_id.slice(0, 12)}</code>
                </div>
                <div className="audit-actor">
                  <UserRound size={14} />
                  <span>{event.actor_id ? event.actor_id.slice(0, 8) : "System"}</span>
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
