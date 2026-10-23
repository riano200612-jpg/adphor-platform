"""Resource-bounded subprocess decoding for offline Linux use.

This is crash/resource containment, NOT a filesystem or network security sandbox.
Before a public API: run as a dedicated unprivileged identity in a networkless
container with read-only code, no secrets mounted, and aggregate memory/PID quotas.
"""
from hashlib import sha256
import json
import os
from pathlib import Path
import signal
import struct
import subprocess
import sys
import tempfile
import threading

from .dl_evidence import (
    EvidenciaDL, ImagenPreparadaDL, MAX_OUTPUT_BYTES, MAX_OUTPUT_DIMENSION,
    _verificar_integridad,
)

TIMEOUT_SECONDS = 8
MAX_WORKERS = 2
_SLOTS = threading.BoundedSemaphore(MAX_WORKERS)
_WORKER = Path(__file__).with_name('_dl_worker.py').resolve()


class ErrorProcesamientoDL(ValueError):
    pass


class ProcesadorDLOcupado(ErrorProcesamientoDL):
    pass


def _read_result(output, original_hash):
    output.seek(0)
    header = output.readline(1025)
    if len(header) > 1024 or not header.endswith(b'\n'):
        raise ErrorProcesamientoDL('Respuesta inválida del procesador de fotografías.')
    try:
        fields = json.loads(header)
        if set(fields) != {'width', 'height', 'sha256'}:
            raise ValueError()
        width, height = fields['width'], fields['height']
        if any(type(x) is not int or not 0 < x <= MAX_OUTPUT_DIMENSION for x in (width, height)):
            raise ValueError()
        content = output.read(MAX_OUTPUT_BYTES + 1)
        if not 33 <= len(content) <= MAX_OUTPUT_BYTES:
            raise ValueError()
        if content[:16] != b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR':
            raise ValueError()
        if struct.unpack('>II', content[16:24]) != (width, height):
            raise ValueError()
        digest = sha256(content).hexdigest()
        if fields['sha256'] != digest:
            raise ValueError()
    except (ValueError, TypeError, KeyError, UnicodeError) as error:
        raise ErrorProcesamientoDL('Respuesta inválida del procesador de fotografías.') from error
    return ImagenPreparadaDL(width, height, content, original_hash, digest)


def preparar_imagen_aislada(evidencia: EvidenciaDL, contenido: bytes) -> ImagenPreparadaDL:
    """Synchronous, bounded operation. Do not call directly on an ASGI event loop.

    Fails closed on unsupported platforms or saturation; never falls back to
    in-process decoding. Concurrency quota is per parent Python process.
    """
    if sys.platform != 'linux':
        raise ErrorProcesamientoDL('El procesador aislado requiere Linux.')
    _verificar_integridad(evidencia, contenido)
    if not _SLOTS.acquire(blocking=False):
        raise ProcesadorDLOcupado('El procesador de fotografías está ocupado. Reintenta después.')
    try:
        fields = {'mime': evidencia.mime, 'sha256': evidencia.sha256_hex, 'size': evidencia.tamano}
        payload = json.dumps(fields, separators=(',', ':')).encode() + b'\n' + contenido
        with tempfile.TemporaryDirectory(prefix='adphor-dl-') as directory:
            with tempfile.TemporaryFile(dir=directory) as output:
                # stdout is a file bounded by RLIMIT_FSIZE, not an unbounded RAM pipe.
                with subprocess.Popen(
                    [sys.executable, '-I', '-B', str(_WORKER)], stdin=subprocess.PIPE,
                    stdout=output, stderr=subprocess.DEVNULL, cwd=directory,
                    env={'LANG': 'C.UTF-8'}, close_fds=True, start_new_session=True,
                ) as process:
                    try:
                        process.communicate(input=payload, timeout=TIMEOUT_SECONDS)
                    except subprocess.TimeoutExpired:
                        raise ErrorProcesamientoDL('La fotografía superó el tiempo permitido.') from None
                    finally:
                        # Also clean up descendants on timeout/failure/success.
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        process.wait()
                    if process.returncode != 0:
                        raise ErrorProcesamientoDL('La fotografía fue rechazada o excedió los límites del procesador.')
                return _read_result(output, evidencia.sha256_hex)
    except OSError:
        raise ErrorProcesamientoDL('No se pudo iniciar o completar el procesador de fotografías.') from None
    finally:
        _SLOTS.release()
