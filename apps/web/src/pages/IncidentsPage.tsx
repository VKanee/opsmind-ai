import {
  ArrowRight,
  Filter,
  Plus,
  RadioTower,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";

import {
  EmptyPanel,
  ErrorPanel,
  Modal,
  PageHeader,
  SeverityBadge,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { createIncident, listIncidents } from "@/lib/api";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import type { Incident, Severity } from "@/types";

export function IncidentsPage() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const canWrite = user?.role === "admin" || user?.role === "responder";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setIncidents(
        await listIncidents({
          status: statusFilter || undefined,
          severity: severityFilter || undefined,
        }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load incidents");
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return incidents;
    return incidents.filter(
      (incident) =>
        incident.title.toLowerCase().includes(needle) ||
        incident.public_id.toLowerCase().includes(needle) ||
        incident.service.toLowerCase().includes(needle),
    );
  }, [incidents, search]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="INCIDENT RESPONSE"
        title="Incident queue"
        description="Prioritize active events, inspect operational signals and open the command workspace."
        action={
          canWrite ? (
            <button className="button button-primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              New incident
            </button>
          ) : undefined
        }
      />

      <section className="panel queue-panel">
        <div className="queue-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search incident, ID or service"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search incidents"
            />
          </div>
          <div className="filter-group">
            <SlidersHorizontal size={15} />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="mitigated">Mitigated</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              aria-label="Filter by severity"
            >
              <option value="">All severities</option>
              <option value="sev1">SEV1</option>
              <option value="sev2">SEV2</option>
              <option value="sev3">SEV3</option>
              <option value="sev4">SEV4</option>
            </select>
          </div>
        </div>

        {error ? <ErrorPanel message={error} onRetry={load} /> : null}
        {loading ? <Spinner label="Loading incident queue" /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyPanel
            title="No matching incidents"
            message="Adjust the filters or create a new incident to start a response."
            icon={Filter}
            action={
              canWrite ? (
                <button className="button button-quiet" onClick={() => setModalOpen(true)}>
                  Create incident
                </button>
              ) : undefined
            }
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="incident-list-table">
            <div className="table-head incident-list-grid">
              <span>Incident</span>
              <span>Service</span>
              <span>State</span>
              <span>Opened</span>
              <span>Duration</span>
              <span />
            </div>
            {filtered.map((incident) => (
              <Link
                to={`/incidents/${incident.id}`}
                className="incident-list-grid table-row incident-row"
                key={incident.id}
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
                <span className="muted-copy">
                  {formatDuration(incident.started_at, incident.resolved_at)}
                </span>
                <ArrowRight size={15} className="row-arrow" />
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      {modalOpen ? (
        <NewIncidentModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function NewIncidentModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [service, setService] = useState("");
  const [severity, setSeverity] = useState<Severity>("sev3");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createIncident({
        title,
        description,
        service,
        severity,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create incident");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New incident" onClose={onClose} width="620px">
      <form className="modal-form" onSubmit={submit}>
        <label className="field field-full">
          <span>Incident title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Describe the customer-visible symptom"
            minLength={4}
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Service</span>
            <input
              value={service}
              onChange={(event) => setService(event.target.value)}
              placeholder="checkout-api"
              required
            />
          </label>
          <label className="field">
            <span>Severity</span>
            <select
              value={severity}
              onChange={(event) => setSeverity(event.target.value as Severity)}
            >
              <option value="sev1">SEV1</option>
              <option value="sev2">SEV2</option>
              <option value="sev3">SEV3</option>
              <option value="sev4">SEV4</option>
            </select>
          </label>
        </div>
        <label className="field field-full">
          <span>Operational description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Include observed symptoms, timing and recent changes."
            rows={5}
            minLength={10}
            required
          />
        </label>
        <label className="field field-full">
          <span>Tags</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="latency, release, customer-impact"
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            <RadioTower size={15} />
            {submitting ? "Creating" : "Create incident"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
