import {
  BookOpenText,
  Clock3,
  FilePlus2,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Tags,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  EmptyPanel,
  ErrorPanel,
  Modal,
  PageHeader,
  SourceBadge,
  Spinner,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import {
  createKnowledge,
  listKnowledge,
  searchKnowledge,
} from "@/lib/api";
import { formatRelativeTime, titleCase } from "@/lib/format";
import type {
  EvidenceItem,
  KnowledgeDocument,
  SourceType,
} from "@/types";

export function KnowledgePage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [selected, setSelected] = useState<KnowledgeDocument | null>(null);
  const [results, setResults] = useState<EvidenceItem[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const canManage = user?.role === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listKnowledge();
      setDocuments(data);
      setSelected((current) => current ?? data[0] ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load knowledge");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError("");
    try {
      setResults(await searchKnowledge(query));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="RETRIEVAL LIBRARY"
        title="Knowledge base"
        description="Verified runbooks, service context and incident learning used by investigations."
        action={
          canManage ? (
            <button className="button button-primary" onClick={() => setModalOpen(true)}>
              <Plus size={16} />
              Add source
            </button>
          ) : undefined
        }
      />

      <section className="knowledge-search-band">
        <form className="knowledge-search" onSubmit={submitSearch}>
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search runbooks, policies and incident history"
            aria-label="Search knowledge base"
          />
          <button className="button button-primary" disabled={searching}>
            {searching ? "Searching" : "Search"}
          </button>
        </form>
        <div className="knowledge-stats">
          <span>
            <ShieldCheck size={14} />
            {documents.filter((document) => document.trust_level === "verified").length} verified
          </span>
          <span>
            <FileText size={14} />
            {documents.length} sources
          </span>
        </div>
      </section>

      {error ? <ErrorPanel message={error} onRetry={load} /> : null}
      {results.length > 0 ? (
        <section className="panel search-results-panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">RETRIEVAL RESULTS</div>
              <h2>Top evidence for “{query}”</h2>
            </div>
            <button className="button button-quiet button-small" onClick={() => setResults([])}>
              Clear
            </button>
          </div>
          <div className="search-result-list">
            {results.map((result, index) => (
              <article className="search-result" key={result.chunk_id}>
                <span className="search-result-rank">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <div className="search-result-title">
                    <strong>{result.document_title}</strong>
                    <SourceBadge source={result.source_type} />
                  </div>
                  <p>{result.snippet}</p>
                </div>
                <span className="match-score">
                  {Math.round(result.relevance_score * 100)}%
                </span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {loading && !documents.length ? <Spinner label="Loading knowledge sources" /> : null}
      {!loading && !documents.length ? (
        <EmptyPanel
          title="No knowledge sources"
          message="Add a runbook or incident postmortem to make it available for retrieval."
          icon={BookOpenText}
          action={
            canManage ? (
              <button className="button button-quiet" onClick={() => setModalOpen(true)}>
                Add source
              </button>
            ) : undefined
          }
        />
      ) : null}

      {documents.length > 0 ? (
        <div className="knowledge-layout">
          <section className="panel knowledge-list-panel">
            <div className="panel-heading">
              <div>
                <div className="eyebrow">SOURCE CATALOG</div>
                <h2>Operational references</h2>
              </div>
              <span className="panel-total">{documents.length}</span>
            </div>
            <div className="document-list">
              {documents.map((document) => (
                <button
                  key={document.id}
                  className={
                    selected?.id === document.id ? "document-row active" : "document-row"
                  }
                  onClick={() => setSelected(document)}
                >
                  <span className="document-icon">
                    <FileText size={17} />
                  </span>
                  <span className="document-copy">
                    <strong>{document.title}</strong>
                    <span>
                      {titleCase(document.source_type)} · v{document.version}
                    </span>
                  </span>
                  <SourceBadge source={document.source_type} />
                </button>
              ))}
            </div>
          </section>

          {selected ? (
            <article className="panel document-preview">
              <div className="document-preview-head">
                <SourceBadge source={selected.source_type} />
                <span className="trust-chip">
                  <ShieldCheck size={13} />
                  {titleCase(selected.trust_level)}
                </span>
              </div>
              <h2>{selected.title}</h2>
              <div className="document-meta">
                <span>
                  <Clock3 size={13} />
                  Updated {formatRelativeTime(selected.updated_at)}
                </span>
                <span>Version {selected.version}</span>
              </div>
              <div className="document-tags">
                <Tags size={14} />
                {selected.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="document-content">
                {selected.content.split("\n\n").map((paragraph, index) => (
                  <p key={`${selected.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </article>
          ) : null}
        </div>
      ) : null}

      {modalOpen ? (
        <KnowledgeModal
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

function KnowledgeModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("runbook");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createKnowledge({
        title,
        source_type: sourceType,
        content,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add source");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Add knowledge source" onClose={onClose} width="680px">
      <form className="modal-form" onSubmit={submit}>
        <label className="field field-full">
          <span>Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Service runbook or incident postmortem title"
            required
          />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Source type</span>
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as SourceType)}
            >
              <option value="runbook">Runbook</option>
              <option value="postmortem">Postmortem</option>
              <option value="service_doc">Service document</option>
              <option value="policy">Policy</option>
            </select>
          </label>
          <label className="field">
            <span>Tags</span>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="checkout, latency, database"
            />
          </label>
        </div>
        <label className="field field-full">
          <span>Content</span>
          <textarea
            rows={10}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Operational guidance, recovery thresholds and escalation policy."
            minLength={40}
            required
          />
        </label>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="button button-quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button-primary" disabled={submitting}>
            <FilePlus2 size={15} />
            {submitting ? "Adding source" : "Add source"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
