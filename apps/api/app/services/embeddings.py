import hashlib
import math
import re

TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._/-]*|[\u4e00-\u9fff]+")
STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "were",
    "with",
}
CJK_NOISE_CHARS = set("的了在是和与及着地被把将对从到中")


def tokenize(text: str) -> list[str]:
    tokens: list[str] = []
    for raw_token in TOKEN_PATTERN.findall(text):
        token = raw_token.lower()
        if token.isascii():
            if len(token) > 1 and token not in STOP_WORDS:
                tokens.append(token)
            continue

        # Chinese text has no spaces. Character bigrams provide a portable,
        # deterministic lexical representation without an external segmenter.
        cleaned = "".join(char for char in token if char not in CJK_NOISE_CHARS)
        if len(cleaned) == 1:
            tokens.append(cleaned)
        else:
            tokens.extend(cleaned[index : index + 2] for index in range(len(cleaned) - 1))
    return tokens


def embed_text(text: str, dimensions: int) -> list[float]:
    vector = [0.0] * dimensions
    tokens = tokenize(text)
    if not tokens:
        return vector

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        weight = 1.0 + min(len(token), 20) / 20
        vector[index] += sign * weight

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [round(value / norm, 8) for value in vector]


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    score = sum(a * b for a, b in zip(left, right, strict=True))
    return max(0.0, min(1.0, score))
