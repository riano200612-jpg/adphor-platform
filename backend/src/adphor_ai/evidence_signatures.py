"""Minimal content signature checks for QA evidence uploads.
Only an initial guard; not a replacement for server-side media scanning.
"""
def matches_evidence_signature(media_type: str, data: bytes) -> bool:
    if not isinstance(data, bytes):
        return False
    if media_type == "image/jpeg":
        return data.startswith(bytes.fromhex("ffd8ff"))
    if media_type == "image/png":
        return data.startswith(bytes.fromhex("89504e470d0a1a0a"))
    if media_type == "image/webp":
        return len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if media_type == "application/pdf":
        return data.startswith(b"%PDF-")
    if media_type == "video/mp4":
        return len(data) >= 12 and data[4:8] == b"ftyp"
    if media_type == "video/webm":
        return data.startswith(bytes.fromhex("1a45dfa3"))
    return False
