"""Extract structured medications from free-text discharge summaries using Gemini.

Called during PDF upload onboarding. Returns a best-effort list of medications
found in the document text. An empty list is a valid result (e.g., the document
mentions no medications or the model cannot parse any with confidence).
"""

import json
import logging
import os

import google.genai as genai

logger = logging.getLogger(__name__)

_EXTRACTION_PROMPT = """\
You are a medical data extractor. Read the following discharge document text and \
extract the medication list.

Return ONLY a JSON array. Each element must have these fields:
- "name": medication name (string, required)
- "dosage": dose amount and unit e.g. "500 mg" (string or null)
- "frequency": one of "once-daily","twice-daily","three-times-daily","as-needed","bedtime","with-meals" \
or a plain description if none match (string or null)
- "instructions": any special instructions e.g. "take with food" (string or null)
- "reason": the clinical indication e.g. "Type 2 diabetes mellitus" (string or null)
- "schedule_times": array of HH:MM times e.g. ["08:00","20:00"] (array, may be empty)

Rules:
- Extract only medications explicitly listed in the document.
- Do not invent medications not present in the text.
- If a field is not mentioned, use null (or [] for schedule_times).
- Return [] if no medications are found.

Document text:
\"\"\"
{text}
\"\"\"

JSON array:"""


def _gemini_client() -> genai.Client:
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY not set; cannot extract medications")
    return genai.Client(api_key=api_key)


def extract_medications_from_text(text: str) -> list[dict]:
    """Synchronous: call Gemini Flash to extract medications from PDF text.

    Returns a list of dicts matching the Medication model fields. Errors are
    logged and swallowed; the caller stores an empty list instead of failing the
    upload.
    """
    try:
        client = _gemini_client()
        model = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
        prompt = _EXTRACTION_PROMPT.format(text=text[:20_000])
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        raw = (response.text or "").strip()
        if not raw:
            logger.warning("medication extraction returned empty response")
            return []
        medications: list[dict] = json.loads(raw)
        if not isinstance(medications, list):
            logger.warning(
                "medication extraction returned non-list: %r", type(medications)
            )
            return []
        return medications
    except Exception:
        logger.warning("medication extraction failed", exc_info=True)
        return []
