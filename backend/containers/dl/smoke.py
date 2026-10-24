"""Offline acceptance test. Requires a local Linux Docker daemon and built image.

Uses synthetic bytes only. Never import this tool into the application server.
"""
import hashlib
import json
import os
import select
import subprocess
import tempfile
import uuid
import zlib
import struct
import time

MAX_OUTPUT_BYTES = 16 * 1024 * 1024 + 4096
MAX_INPUT_BYTES = 10 * 1024 * 1024 + 1024
IMAGE = 'adphor-dl-sandbox:test'


def command(name):
    return ['docker', 'run', '--name', name, '--rm', '--interactive',
            '--network=none', '--read-only', '--user=65532:65532',
            '--cap-drop=ALL', '--security-opt=no-new-privileges:true',
            '--memory=512m', '--memory-swap=512m', '--cpus=1', '--pids-limit=16',
            '--ulimit=core=0:0', '--ulimit=nofile=32:32',
            '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=32m,mode=1777',
            '--log-driver=none']


def run(payload=b'', probe=None):
    """Bound stdout *while the container runs*, not after it fills the host disk."""
    if type(payload) is not bytes or len(payload) > MAX_INPUT_BYTES:
        raise ValueError('Smoke-test input exceeds the allowed limit.')
    name = 'adphor-dl-smoke-' + uuid.uuid4().hex
    args = command(name)
    if probe is not None:
        args += ['--entrypoint=python']
    args += [IMAGE]
    if probe is not None:
        args += ['-I', '-B', '-c', probe]

    try:
        # Feed input from a regular temporary file: no blocked stdin writer.
        with tempfile.TemporaryFile() as source:
            source.write(payload)
            source.seek(0)
            process = subprocess.Popen(args, stdin=source, stdout=subprocess.PIPE,
                                       stderr=subprocess.DEVNULL)
            try:
                deadline = time.monotonic() + 20
                captured = bytearray()
                while True:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise subprocess.TimeoutExpired(args, 20)
                    ready, _, _ = select.select([process.stdout], [], [], remaining)
                    if not ready:
                        raise subprocess.TimeoutExpired(args, 20)
                    chunk = os.read(process.stdout.fileno(), 65536)
                    if not chunk:
                        break
                    if len(captured) + len(chunk) > MAX_OUTPUT_BYTES:
                        raise RuntimeError('Docker stdout output quota exceeded.')
                    captured.extend(chunk)
                remaining = max(0.001, deadline - time.monotonic())
                status = process.wait(timeout=remaining)
                return status, bytes(captured)
            finally:
                if process.poll() is None:
                    process.kill()
                process.wait(timeout=3)
                process.stdout.close()
    finally:
        # Killing the Docker client alone does NOT stop the container.
        subprocess.run(['docker', 'rm', '-f', name], stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=10, check=False)

def png():
    def chunk(kind, data):
        return (struct.pack('>I', len(data)) + kind + data
                + struct.pack('>I', zlib.crc32(kind + data)))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b'\0\xff\0\0')) + chunk(b'IEND', b''))


PROBE = r'''
import os, socket
from pathlib import Path
assert os.getuid() == 65532
assert os.statvfs('/').f_flag & os.ST_RDONLY
cgroup = Path('/sys/fs/cgroup')
assert (cgroup / 'memory.max').read_text().strip() == '536870912'
assert (cgroup / 'pids.max').read_text().strip() == '16'
quota, period = map(int, (cgroup / 'cpu.max').read_text().split())
assert quota == period
assert (cgroup / 'memory.swap.max').read_text().strip() == '0'
assert set(os.listdir('/sys/class/net')) == {'lo'}
status = Path('/proc/self/status').read_text()
assert 'NoNewPrivs:\t1' in status
assert int(next(x.split()[1] for x in status.splitlines() if x.startswith('CapEff:')),16) == 0
assert not Path('/var/run/docker.sock').exists()
assert not any('SUPABASE' in k or 'SECRET' in k or k == 'PYTHONPATH' for k in os.environ)
try:
    Path('/opt/adphor/forbidden').write_text('test')
except OSError:
    pass
else:
    raise AssertionError('root filesystem writable')
s = socket.socket()
s.settimeout(1)
try:
    s.connect(('192.0.2.1', 443))
except OSError:
    pass
else:
    raise AssertionError('outbound connection succeeded')
finally:
    s.close()
Path('/tmp/probe').write_text('temporary')
assert Path('/tmp/probe').read_text() == 'temporary'
print('isolation probe passed')
'''


def main():
    code, _ = run(probe=PROBE)
    assert code == 0, 'Runtime isolation probe failed'
    data = png()
    header = {'mime': 'image/png', 'size': len(data),
              'sha256': hashlib.sha256(data).hexdigest()}
    code, output = run(json.dumps(header).encode() + b'\n' + data)
    assert code == 0, 'Synthetic image failed'
    fields, prepared = output.split(b'\n', 1)
    fields = json.loads(fields)
    assert (fields['width'], fields['height']) == (1, 1)
    assert hashlib.sha256(prepared).hexdigest() == fields['sha256']
    assert prepared.startswith(b'\x89PNG\r\n\x1a\n')
    code, _ = run(b'{}\ninvalid')
    assert code != 0, 'Malformed input accepted'

    # A compromised decoder must not be able to fill the runner disk with stdout.
    flood = "import os\nfor _ in range(350): os.write(1, b'x' * 65536)\n"
    try:
        run(probe=flood)
    except RuntimeError as error:
        assert 'output quota' in str(error)
    else:
        raise AssertionError('Unbounded Docker stdout accepted')
    print('DL container: isolation, synthetic PNG, invalid input and stdout quota passed')


if __name__ == '__main__':
    main()
