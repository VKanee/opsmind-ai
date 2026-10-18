from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select

from app.dependencies import CurrentUser, DbSession, require_roles
from app.models import KnowledgeDocument, Role
from app.schemas import (
    KnowledgeDocumentCreate,
    KnowledgeDocumentResponse,
    SearchRequest,
    SearchResponse,
)
from app.services.audit import record_audit
from app.services.retrieval import index_document, search_knowledge

router = APIRouter(prefix="/knowledge", tags=["知识库"])


@router.get(
    "/documents",
    response_model=list[KnowledgeDocumentResponse],
    summary="查询知识文档",
    description="返回当前组织的处置手册、复盘报告、服务文档和制度规范。",
)
def list_documents(
    db: DbSession,
    user: CurrentUser,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[KnowledgeDocumentResponse]:
    rows = db.scalars(
        select(KnowledgeDocument)
        .where(KnowledgeDocument.organization_id == user.organization_id)
        .order_by(KnowledgeDocument.updated_at.desc())
        .limit(limit)
    ).all()
    return [KnowledgeDocumentResponse.model_validate(row) for row in rows]


@router.post(
    "/documents",
    response_model=KnowledgeDocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="新增知识文档",
    description="仅管理员可以新增知识来源，系统会自动切分并建立检索索引。",
)
def create_document(
    payload: KnowledgeDocumentCreate,
    request: Request,
    db: DbSession,
    user: CurrentUser,
) -> KnowledgeDocumentResponse:
    require_roles(Role.ADMIN)(user)
    document = KnowledgeDocument(
        organization_id=user.organization_id,
        title=payload.title,
        source_type=payload.source_type,
        content=payload.content,
        tags=payload.tags,
        trust_level=payload.trust_level,
        created_by_id=user.id,
    )
    db.add(document)
    db.flush()
    index_document(db, document, settings=request.app.state.settings)
    record_audit(
        db,
        organization_id=user.organization_id,
        actor_id=user.id,
        action="knowledge.created",
        resource_type="knowledge_document",
        resource_id=document.id,
        details={"title": document.title, "source_type": document.source_type.value},
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(document)
    return KnowledgeDocumentResponse.model_validate(document)


@router.get(
    "/documents/{document_id}",
    response_model=KnowledgeDocumentResponse,
    summary="获取知识文档",
    description="查询单个知识文档的完整正文和元数据。",
)
def get_document(
    document_id: str,
    db: DbSession,
    user: CurrentUser,
) -> KnowledgeDocumentResponse:
    document = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.id == document_id,
            KnowledgeDocument.organization_id == user.organization_id,
        )
    )
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识文档不存在")
    return KnowledgeDocumentResponse.model_validate(document)


@router.post(
    "/search",
    response_model=SearchResponse,
    summary="搜索知识证据",
    description="使用中文分词、词法匹配和向量相似度检索相关证据片段。",
)
def search(
    payload: SearchRequest,
    request: Request,
    db: DbSession,
    user: CurrentUser,
) -> SearchResponse:
    results = search_knowledge(
        db,
        organization_id=user.organization_id,
        query=payload.query,
        settings=request.app.state.settings,
        limit=payload.limit,
    )
    return SearchResponse(query=payload.query, results=results)
