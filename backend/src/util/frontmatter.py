def parse_front_matter(raw: str) -> tuple[dict[str, str], str]:
    """Parse a simple '---' delimited front matter block.

    Returns (metadata, body). If there is no front matter, metadata is empty and
    body is the original text.
    """
    if not raw.startswith("---"):
        return {}, raw
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return {}, raw
    meta: dict[str, str] = {}
    for line in parts[1].strip().splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    return meta, parts[2].strip()
