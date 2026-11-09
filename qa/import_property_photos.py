"""Upload verified originals to the private ADPHOR QA bucket via Storage API."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "https://qfctnnnnltghepwujpdm.supabase.co/storage/v1"
BUCKET = "property-photos"
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def request(path, token, payload=None, mime=None):
    headers = {"Authorization": f"Bearer {token}"}
    if payload is not None:
        headers.update({"Content-Type": mime, "x-upsert": "false"})
    for attempt in range(3):
        try:
            with urlopen(Request(BASE + path, data=payload, headers=headers), timeout=30) as response:
                return response.read()
        except HTTPError as error:
            if error.code not in {429, 500, 502, 503, 504} or attempt == 2:
                raise
        except URLError:
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("originals", type=Path)
    parser.add_argument("--upload", action="store_true")
    args = parser.parse_args()
    seen = set()
    verified = []
    for row in json.loads(args.manifest.read_text()):
        project, drive_id = row.get("project_id"), row["drive_id"]
        if project is None:
            continue
        if not re.fullmatch(r"[a-z0-9-]+", project) or not re.fullmatch(r"[\w-]+", drive_id) or project in seen:
            raise ValueError("Invalid or duplicate mapping")
        blob = (args.originals / drive_id).read_bytes()
        digest = hashlib.sha256(blob).hexdigest()
        if digest != row["sha256"] or len(blob) != row["bytes"] or len(blob) > 10 * 1024**2:
            raise ValueError(f"Integrity check failed for {project}")
        filename = f"{digest}.{EXTENSIONS[row['mime']]}"
        verified.append((project, filename, digest, row["mime"], blob))
        seen.add(project)
    print(f"{len(verified)} originals validated")
    if not args.upload:
        return
    token = os.environ["ADPHOR_QA_STORAGE_TOKEN"]
    bucket = json.loads(request(f"/bucket/{BUCKET}", token))
    if bucket.get("public") is not False:
        raise ValueError("Target bucket is not private")
    for project, filename, digest, mime, blob in verified:
        path = f"/object/{BUCKET}/{project}/{filename}"
        try:
            request(path, token, blob, mime)
        except HTTPError as error:
            if error.code not in {400, 409}:
                raise
        remote = request(f"/object/authenticated/{BUCKET}/{project}/{filename}", token)
        if hashlib.sha256(remote).hexdigest() != digest:
            raise ValueError(f"Remote integrity check failed for {project}")
        print(f"Verified {project}/{filename}")


if __name__ == "__main__":
    main()
