"""Local PDF text extraction for uploaded discharge summaries (F9).

LiteParse (run-llama) runs fully on-box: a Rust parser with Python bindings,
no cloud calls and no API keys, so an upload never leaves our process before
it reaches the knowledge base.
"""

import logging

from liteparse import LiteParse

logger = logging.getLogger(__name__)

# Below this much extracted text the document is unusable as a knowledge
# base (likely a scan without OCR, an image-only page, or the wrong file).
MIN_TEXT_CHARS = 200


def extract_pdf_text(path: str) -> str:
    """Extract plain text from a PDF on disk. Blocking; run in a thread."""
    result = LiteParse().parse(path)
    return (result.text or "").strip()
