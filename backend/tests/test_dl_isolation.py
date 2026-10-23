import base64
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image
from adphor_ai.dl_evidence import EvidenciaDL, preparar_imagen
from adphor_ai import dl_isolation as isolated


@unittest.skipUnless(os.sys.platform == 'linux', 'Linux resource limits required')
class IsolatedDecoderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        output = BytesIO()
        with Image.new('RGB', (32, 24), 'blue') as image:
            image.save(output, format='PNG')
        self.content = output.getvalue()
        self.evidence = EvidenciaDL('photo', 'private-property', 'private-case', 'image/png',
                                   len(self.content), sha256(self.content).hexdigest(),
                                   datetime.now(timezone.utc))

    def fixture(self, code):
        path = Path(self.temp.name) / 'fixture.py'
        path.write_text(code)
        return patch.object(isolated, '_WORKER', path)

    def limits(self):
        return f"import runpy\nw = runpy.run_path({str(isolated._WORKER)!r})\nw['apply_limits']()\n"

    def valid_response(self):
        result = preparar_imagen(self.evidence, self.content)
        header = json.dumps({'width': result.ancho, 'height': result.alto,
                             'sha256': result.sha256_preparado}).encode()
        encoded = base64.b64encode(header + b'\n' + result.contenido_png).decode()
        return f"import base64,sys\nsys.stdout.buffer.write(base64.b64decode({encoded!r}))\n"

    def test_real_worker_matches_direct_preparation(self):
        self.assertEqual(isolated.preparar_imagen_aislada(self.evidence, self.content),
                         preparar_imagen(self.evidence, self.content))

    def test_real_worker_rejects_fake_image_and_recovers(self):
        data = b'\x89PNG\r\n\x1a\nfake'
        evidence = EvidenciaDL('photo', 'property', 'case', 'image/png', len(data),
                               sha256(data).hexdigest(), datetime.now(timezone.utc))
        with self.assertRaises(isolated.ErrorProcesamientoDL):
            isolated.preparar_imagen_aislada(evidence, data)
        self.assertEqual(isolated.preparar_imagen_aislada(self.evidence,self.content).ancho,32)

    def test_timeout_kills_and_reaps_worker(self):
        processes = []
        original = subprocess.Popen
        def capture(*args, **kwargs):
            process = original(*args, **kwargs)
            processes.append(process)
            return process
        with self.fixture('import time\ntime.sleep(30)\n'), patch.object(isolated,'TIMEOUT_SECONDS',0.2), patch.object(isolated.subprocess,'Popen',side_effect=capture):
            with self.assertRaisesRegex(isolated.ErrorProcesamientoDL,'tiempo'):
                isolated.preparar_imagen_aislada(self.evidence,self.content)
        self.assertEqual(len(processes),1)
        self.assertIsNotNone(processes[0].poll())
        # Slot must have been released after failure.
        self.assertEqual(isolated.preparar_imagen_aislada(self.evidence,self.content).alto,24)

    def test_cpu_limit_terminates_busy_worker(self):
        with self.fixture(self.limits() + 'while True: pass\n'):
            with self.assertRaisesRegex(isolated.ErrorProcesamientoDL,'rechazada'):
                isolated.preparar_imagen_aislada(self.evidence,self.content)

    def test_address_space_limit_rejects_gigabyte_allocation(self):
        with self.fixture(self.limits() + 'allocation=bytearray(1024*1024*1024)\n'):
            with self.assertRaises(isolated.ErrorProcesamientoDL):
                isolated.preparar_imagen_aislada(self.evidence,self.content)

    def test_output_file_limit_stops_flood(self):
        with self.fixture(self.limits() + "import sys\nfor i in range(20):\n sys.stdout.buffer.write(b'x' * 1024 * 1024)\n sys.stdout.buffer.flush()\n"):
            with self.assertRaises(isolated.ErrorProcesamientoDL):
                isolated.preparar_imagen_aislada(self.evidence,self.content)

    def test_no_environment_secrets_identifiers_or_extra_descriptors(self):
        with tempfile.TemporaryFile() as inherited:
            os.set_inheritable(inherited.fileno(), True)
            code = f'''import os,sys,json
from pathlib import Path
assert sys.flags.isolated
assert 'SUPABASE_AGENT_WRITER_KEY' not in os.environ
assert 'PYTHONPATH' not in os.environ
assert not Path('.env').exists()
try:
    os.fstat({inherited.fileno()})
except OSError:
    pass
else:
    raise RuntimeError('descriptor inherited')
header=json.loads(sys.stdin.buffer.readline())
assert set(header)=={{'mime','sha256','size'}}
sys.stdin.buffer.read()
'''
            with patch.dict(os.environ,{'SUPABASE_AGENT_WRITER_KEY':'test-secret-not-real'}), self.fixture(code+self.valid_response()):
                self.assertEqual(isolated.preparar_imagen_aislada(self.evidence,self.content).ancho,32)

    def test_saturation_fails_without_launching_more_processes(self):
        slots = [isolated._SLOTS.acquire(blocking=False) for _ in range(isolated.MAX_WORKERS)]
        try:
            self.assertTrue(all(slots))
            with patch.object(isolated.subprocess,'Popen') as launch:
                with self.assertRaises(isolated.ProcesadorDLOcupado):
                    isolated.preparar_imagen_aislada(self.evidence,self.content)
                launch.assert_not_called()
        finally:
            for acquired in slots:
                if acquired:
                    isolated._SLOTS.release()

    def test_unsupported_platform_fails_closed(self):
        with patch.object(isolated.sys,'platform','win32'), patch.object(isolated.subprocess,'Popen') as launch:
            with self.assertRaises(isolated.ErrorProcesamientoDL):
                isolated.preparar_imagen_aislada(self.evidence,self.content)
            launch.assert_not_called()

    def test_corrupt_worker_response_rejected(self):
        for output in [b'not-json\n', b'x'*1025+b'\n', b'{"width":99999,"height":1,"sha256":"x"}\n123']:
            code=f'import sys\nsys.stdout.buffer.write({output!r})\n'
            with self.subTest(output=output[:30]), self.fixture(code):
                with self.assertRaises(isolated.ErrorProcesamientoDL):
                    isolated.preparar_imagen_aislada(self.evidence,self.content)

    def test_spawn_error_sanitized_and_slot_released(self):
        with patch.object(isolated.subprocess,'Popen',side_effect=OSError('private-path-secret')):
            with self.assertRaises(isolated.ErrorProcesamientoDL) as failure:
                isolated.preparar_imagen_aislada(self.evidence,self.content)
        self.assertNotIn('private-path-secret',str(failure.exception))
        self.assertEqual(isolated.preparar_imagen_aislada(self.evidence,self.content).ancho,32)
