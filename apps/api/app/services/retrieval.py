import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import KnowledgeChunk, KnowledgeDocument, SourceType
from app.schemas import EvidenceItem
from app.services.embeddings import cosine_similarity, embed_text, tokenize

MAX_CHUNK_CHARS = 900
CHUNK_OVERLAP = 120


@dataclass(frozen=True)
class IndexedChunk:
    chunk: KnowledgeChunk
    document: KnowledgeDocument


def chunk_content(content: str) -> list[str]:
    paragraphs = [part.strip() for part in re.split(r"\n\s*\n", content) if part.strip()]
    chunks: list[str] = []
    current = ""

    for paragraph in paragraphs:
        candidate = f"{current}\n\n{paragraph}".strip()
        if len(candidate) <= MAX_CHUNK_CHARS:
            current = candidate
            continue

        if current:
            chunks.append(current)
        while len(paragraph) > MAX_CHUNK_CHARS:
            split_at = paragraph.rfind(" ", 0, MAX_CHUNK_CHARS)
            split_at = split_at if split_at > 0 else MAX_CHUNK_CHARS
            chunks.append(paragraph[:split_at].strip())
            paragraph = paragraph[max(0, split_at - CHUNK_OVERLAP) :].strip()
        current = paragraph

    if current:
        chunks.append(current)
    return chunks or [content.strip()]


def index_document(
    db: Session,
    document: KnowledgeDocument,
    *,
    settings: Settings,
) -> None:
    for ordinal, content in enumerate(chunk_content(document.content)):
        db.add(
            KnowledgeChunk(
                organization_id=document.organization_id,
                document_id=document.id,
                ordinal=ordinal,
                content=content,
                embedding=embed_text(content, settings.embedding_dimensions),
            )
        )


def search_knowledge(
    db: Session,
    *,
    organization_id: str,
    query: str,
    settings: Settings,
    limit: int = 6,
) -> list[EvidenceItem]:
    query_vector = embed_text(query, settings.embedding_dimensions)
    query_tokens = set(tokenize(query))
    rows = db.execute(
        select(KnowledgeChunk, KnowledgeDocument)
        .join(KnowledgeDocument, KnowledgeDocument.id == KnowledgeChunk.document_id)
        .where(
            KnowledgeChunk.organization_id == organization_id,
            KnowledgeDocument.trust_level != "deprecated",
        )
    ).all()

    ranked: list[tuple[float, KnowledgeChunk, KnowledgeDocument]] = []
    for chunk, document in rows:
        chunk_tokens = set(tokenize(chunk.content))
        overlap = len(query_tokens & chunk_tokens)
        lexical_score = overlap / max(1, len(query_tokens))
        title_overlap = len(query_tokens & set(tokenize(document.title)))
        title_score = title_overlap / max(1, len(query_tokens))
        vector_score = cosine_similarity(query_vector, chunk.embedding)
        score = min(1.0, 0.68 * vector_score + 0.22 * lexical_score + 0.10 * title_score)
        if score > 0:
            ranked.append((score, chunk, document))

    ranked.sort(key=lambda item: item[0], reverse=True)
    results: list[EvidenceItem] = []
    for score, chunk, document in ranked[:limit]:
        snippet = " ".join(chunk.content.split())
        if len(snippet) > 360:
            snippet = f"{snippet[:357]}..."
        results.append(
            EvidenceItem(
                chunk_id=chunk.id,
                document_id=document.id,
                document_title=document.title,
                source_type=SourceType(document.source_type),
                snippet=snippet,
                relevance_score=round(score, 4),
            )
        )
    return results
