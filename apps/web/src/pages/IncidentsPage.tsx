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
      setError(cause instanceof Error ? cause.message : "无法加载事故列表");
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
        eyebrow="事故响应"
        title="事故队列"
        description="按严重程度处理当前事件，查看运行信号并进入事故处置工作台。"
        action={
          canWrite ? (
            <button className="button button-primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              新建事故
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
              placeholder="搜索事故名称、编号或服务"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="搜索事故"
            />
          </div>
          <div className="filter-group">
            <SlidersHorizontal size={15} />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="按状态筛选"
            >
              <option value="">全部状态</option>
              <option value="open">待处理</option>
              <option value="investigating">调查中</option>
              <option value="mitigated">已缓解</option>
              <option value="resolved">已解决</option>
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              aria-label="按严重程度筛选"
            >
              <option value="">全部等级</option>
              <option value="sev1">SEV1</option>
              <option value="sev2">SEV2</option>
              <option value="sev3">SEV3</option>
              <option value="sev4">SEV4</option>
            </select>
          </div>
        </div>

        {error ? <ErrorPanel message={error} onRetry={load} /> : null}
        {loading ? <Spinner label="正在加载事故队列" /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyPanel
            title="没有匹配的事故"
            message="调整筛选条件，或新建一个事故开始处置。"
            icon={Filter}
            action={
              canWrite ? (
                <button className="button button-quiet" onClick={() => setModalOpen(true)}>
                  新建事故
                </button>
              ) : undefined
            }
          />
        ) : null}

        {!loading && filtered.length > 0 ? (
          <div className="incident-list-table">
            <div className="table-head incident-list-grid">
              <span>事故</span>
              <span>服务</span>
              <span>状态</span>
              <span>开始时间</span>
              <span>持续时间</span>
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
      setError(cause instanceof Error ? cause.message : "无法创建事故");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="新建事故" onClose={onClose} width="620px">
      <form className="modal-form" onSubmit={submit}>
        <label className="field field-full">
          <span>事故标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：支付接口错误率突然升高"
            minLength={4}
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>服务名称</span>
            <input
              value={service}
              onChange={(event) => setService(event.target.value)}
              placeholder="checkout-api"
              required
            />
          </label>
          <label className="field">
            <span>严重程度</span>
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
          <span>事故描述</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="描述现象、影响范围、开始时间以及最近的发布或变更。"
            rows={5}
            minLength={10}
            required
          />
        </label>
        <label className="field field-full">
          <span>标签</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="延迟, 发布, 客户影响"
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            <RadioTower size={15} />
            {submitting ? "正在创建" : "创建事故"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
