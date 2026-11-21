"""Trusted Linux worker entrypoint. stdin/stdout only; never load dotenv."""
import json
from pathlib import Path
import resource
import sys

MEMORY_BYTES = 512 * 1024 * 1024
CPU_SECONDS = 3
OUTPUT_LIMIT = 16 * 1024 * 1024 + 4096


def apply_limits():
    # Executed before importing Pillow and before reading untrusted bytes.
    for kind, target in (
        (resource.RLIMIT_CORE, 0),
        (resource.RLIMIT_AS, MEMORY_BYTES),
        (resource.RLIMIT_CPU, CPU_SECONDS),
        (resource.RLIMIT_FSIZE, OUTPUT_LIMIT),
        (resource.RLIMIT_NOFILE, 32),
    ):
        _, hard = resource.getrlimit(kind)
        limit = target if hard == resource.RLIM_INFINITY else min(target, hard)
        resource.setrlimit(kind, (limit, limit))


def main():
    try:
        apply_limits()
        # -I ignores PYTHONPATH and cwd. Only the trusted source tree is added.
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from datetime import datetime, timezone
        from adphor_ai.dl_evidence import EvidenciaDL, preparar_imagen, MAX_BYTES

        header = sys.stdin.buffer.readline(1025)
        if len(header) > 1024 or not header.endswith(b'\n'):
            return 2
        fields = json.loads(header)
        if set(fields) != {'mime', 'sha256', 'size'}:
            return 2
        content = sys.stdin.buffer.read(MAX_BYTES + 1)
        # No identity, JWT, property IDs or user metadata cross this boundary.
        evidence = EvidenciaDL('worker', 'worker', 'worker', fields['mime'],
                              fields['size'], fields['sha256'], datetime.now(timezone.utc))
        result = preparar_imagen(evidence, content)
        response = json.dumps({'width': result.ancho, 'height': result.alto,
                               'sha256': result.sha256_preparado}, separators=(',', ':')).encode()
        sys.stdout.buffer.write(response + b'\n' + result.contenido_png)
        sys.stdout.buffer.flush()
        return 0
    except Exception:
        # No decoder exception, byte contents, file paths or secrets in logs.
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
