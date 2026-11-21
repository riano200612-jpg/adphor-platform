"""Privacy-first manifest planner for Porto Castello documents.

No Drive fetch, no DB writes, no inference; accepts authorized connector metadata.
It never makes a file available to agents merely because it was discovered.
A separately authorized worker must download, scan, checksum, review and then
commit the actual bytes to a private bucket before an agent may see any content.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from hashlib import sha256
from datetime import datetime
from typing import Iterable
import json
import re

ALLOWED_MIME = {
    "application/pdf", "application/vnd.google-apps.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.spreadsheet", "text/plain",
    "image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm",
}
MAX_BYTES = 50 * 1024 * 1024  # Supabase Free project per-file ceiling


def classify(folder: str) -> str:
    name = folder.casefold()
    if "mantenim" in name:
        return "maintenance"
    if "reunion" in name or "reuni" in name or "consejo" in name or "comit" in name:
        return "meeting"
    return "other"  # Legal/administrative classification requires human verification.


@dataclass(frozen=True)
class PlanItem:
    project_source_id: str
    file_id: str
    file_name: str
    mime_type: str
    source_modified_at: str
    classification: str
    fingerprint: str
    permission_status: str = "pending"
    agent_read_authorized: bool = False
    ingest_status: str = "metadata_only"
    delivery_mode: str = "private_storage_candidate"


def _safe_name(value):
    name = re.sub(r"[\x00-\x1f\x7f]", " ", str(value)).strip()
    return name[:240]


def build_plan(items: Iterable[dict], *, project_source_id: str = "22") -> dict:
    accepted, rejected, seen = [], [], set()
    for row in items:
        fid = str(row.get("id") or "").strip()
        mime = str(row.get("mime_type") or "")
        modified = str(row.get("modified_time") or "")
        name = _safe_name(row.get("name") or row.get("title") or "")
        folder = str(row.get("folder") or "")
        size = row.get("size")
        if not fid or not modified or not name or mime not in ALLOWED_MIME:
            rejected.append({"file_id": fid, "reason": "missing metadata or unsupported MIME"})
            continue
        try:
            datetime.fromisoformat(modified.replace("Z", "+00:00"))
        except ValueError:
            rejected.append({"file_id": fid, "reason": "invalid modification timestamp"})
            continue
        external_only = size is not None and int(size) > MAX_BYTES
        unique_key = (fid, modified)
        if unique_key in seen:
            continue
        seen.add(unique_key)
        fingerprint = sha256(json.dumps([fid,modified,mime,name],ensure_ascii=False).encode()).hexdigest()
        row_obj=asdict(PlanItem(project_source_id, fid, name, mime, modified,
                                classify(folder), fingerprint))
        if external_only:
            row_obj["delivery_mode"]="external_reference_only"
        accepted.append(row_obj)
    return {"project_source_id": project_source_id, "files": accepted,
            "rejections": rejected, "agent_read_authorized": False,
            "requires_authorized_content_review": True}
