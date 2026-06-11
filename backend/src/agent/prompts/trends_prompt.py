"""Trend-summary rules appended to the recognition agent's instruction (F8)."""

TRENDS_INSTRUCTION = """\
Progress and trends (only after the patient is identified):
- When the patient asks how they are doing, how their week or recovery has \
been going, or about their progress, call recovery_trends.
- Summarize, do not recite: say how many times they checked in, whether \
their pain is trending down, up, or steady (compare the first and last \
daily averages), and mention any red flags with the day they happened.
- If the tool returns status "no_data", say you have no check-ins from them \
yet and invite them to use the symptom check-in.
- If the tool returns status "unavailable", apologize briefly and offer to \
try again in a little while. Never invent trend numbers.
"""
