from app.services.embeddings import cosine_similarity, embed_text, tokenize


def test_chinese_text_uses_character_bigrams() -> None:
    tokens = tokenize("数据库连接池耗尽")
    assert "数据" in tokens
    assert "连接" in tokens
    assert "耗尽" in tokens


def test_related_chinese_text_has_higher_similarity() -> None:
    dimensions = 256
    query = embed_text("数据库连接池耗尽", dimensions)
    related = embed_text("检查数据库连接池等待时间和最大连接数", dimensions)
    unrelated = embed_text("移动端证书轮换导致认证失败", dimensions)
    assert cosine_similarity(query, related) > cosine_similarity(query, unrelated)
