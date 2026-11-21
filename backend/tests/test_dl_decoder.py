import unittest
from dataclasses import replace
from datetime import datetime, timezone
from hashlib import sha256
from io import BytesIO
import struct
from unittest.mock import patch
import zlib

from PIL import Image, ImageFile, PngImagePlugin
from adphor_ai.dl_evidence import (
    EvidenciaDL, preparar_imagen, verificar_archivo, MAX_BYTES,
)


def photo(fmt='PNG', **kwargs):
    output = BytesIO()
    with Image.new('RGB', (32, 24), 'blue') as image:
        image.save(output, format=fmt, **kwargs)
    return output.getvalue()


def evidence(data, mime='image/png'):
    return EvidenciaDL('photo-1', 'demo-01', 'case-1', mime, len(data),
                       sha256(data).hexdigest(), datetime.now(timezone.utc))


def png_dimensions(data, width, height):
    # Change only IHDR and its CRC; rejection must occur before pixel allocation.
    ihdr = struct.pack('>II', width, height) + data[24:29]
    crc = struct.pack('>I', zlib.crc32(b'IHDR' + ihdr))
    return data[:16] + ihdr + crc + data[33:]


class DecoderTests(unittest.TestCase):
    def test_real_jpeg_png_webp(self):
        for fmt, mime in [('JPEG','image/jpeg'), ('PNG','image/png'), ('WEBP','image/webp')]:
            with self.subTest(fmt=fmt):
                data = photo(fmt)
                output = preparar_imagen(evidence(data, mime), data)
                self.assertEqual((output.ancho, output.alto), (32, 24))
                self.assertEqual(output.sha256_original, sha256(data).hexdigest())
                self.assertEqual(output.sha256_preparado, sha256(output.contenido_png).hexdigest())
                with Image.open(BytesIO(output.contenido_png)) as image:
                    image.load()
                    self.assertEqual(image.format, 'PNG')
                    self.assertEqual(image.mode, 'RGB')

    def test_truncated_images_with_matching_hash_are_rejected(self):
        for fmt, mime in [('JPEG','image/jpeg'), ('PNG','image/png'), ('WEBP','image/webp')]:
            data = photo(fmt)[:-20]
            with self.subTest(fmt=fmt), self.assertRaises(ValueError):
                verificar_archivo(evidence(data, mime), data)

    def test_crc_corruption_rejected(self):
        data = bytearray(photo())
        data[29] ^= 1
        data = bytes(data)
        with self.assertRaises(ValueError):
            verificar_archivo(evidence(data), data)

    def test_resolution_and_pixel_limits_before_decode(self):
        for width, height in [(8193,1),(1,8193),(4000,4000)]:
            data = png_dimensions(photo(), width, height)
            with self.subTest(size=(width,height)), self.assertRaisesRegex(ValueError,'Resolución'):
                verificar_archivo(evidence(data), data)

    def test_bomb_warning_is_fatal(self):
        data = photo()
        with patch.object(Image, 'MAX_IMAGE_PIXELS', 500), self.assertRaises(ValueError):
            verificar_archivo(evidence(data), data)

    def test_cannot_relax_truncated_image_policy(self):
        data = photo()
        with patch.object(ImageFile, 'LOAD_TRUNCATED_IMAGES', True), self.assertRaises(ValueError):
            verificar_archivo(evidence(data), data)

    def test_animation_rejected(self):
        for fmt, mime in [('PNG','image/png'),('WEBP','image/webp')]:
            output = BytesIO()
            with Image.new('RGB',(32,24),'blue') as first, Image.new('RGB',(32,24),'red') as second:
                first.save(output, format=fmt, save_all=True, append_images=[second],duration=100,loop=0)
            data = output.getvalue()
            with self.subTest(fmt=fmt), self.assertRaisesRegex(ValueError,'animadas'):
                verificar_archivo(evidence(data,mime),data)

    def test_metadata_and_trailing_payload_not_forwarded(self):
        metadata=PngImagePlugin.PngInfo()
        metadata.add_text('GPS','private-marker-123')
        data=photo(pnginfo=metadata) + b'<script>private-marker-123</script>'
        result=preparar_imagen(evidence(data),data)
        self.assertNotIn(b'private-marker-123', result.contenido_png)
        with Image.open(BytesIO(result.contenido_png)) as image:
            self.assertFalse(image.info)
            self.assertFalse(image.getexif())

    def test_orientation_applied_without_forwarding_exif(self):
        exif=Image.Exif()
        exif[274]=6
        exif[315]='private-author'
        data=photo('JPEG',exif=exif)
        result=preparar_imagen(evidence(data,'image/jpeg'),data)
        self.assertEqual((result.ancho,result.alto),(24,32))
        self.assertNotIn(b'private-author',result.contenido_png)

    def test_transparent_pixels_composited_on_white(self):
        output=BytesIO()
        with Image.new('RGBA',(2,2),(255,0,0,0)) as image:
            image.save(output,format='PNG')
        data=output.getvalue()
        result=preparar_imagen(evidence(data),data)
        with Image.open(BytesIO(result.contenido_png)) as image:
            self.assertEqual(image.getpixel((0,0)),(255,255,255))

    def test_rejects_spoofed_mime(self):
        data=photo('JPEG')
        with self.assertRaises(ValueError):
            verificar_archivo(evidence(data,'image/png'),data)

    def test_rejects_oversized_input_and_invalid_hash_types(self):
        original=evidence(photo())
        for value in [None,64,b'a'*64]:
            with self.subTest(hash=value), self.assertRaises(ValueError):
                replace(original,sha256_hex=value)
        with self.assertRaises(ValueError):
            replace(original,tamano=MAX_BYTES+1)

    def test_input_unchanged_and_repeatable(self):
        data=photo()
        original=data[:]
        manifest=evidence(data)
        self.assertEqual(preparar_imagen(manifest,data),preparar_imagen(manifest,data))
        self.assertEqual(data,original)

    def test_output_resized_without_changing_original(self):
        output=BytesIO()
        with Image.new('RGB',(3000,1000),'green') as image:
            image.save(output,format='PNG')
        data=output.getvalue()
        result=preparar_imagen(evidence(data),data)
        self.assertEqual(result.ancho,2048)
        self.assertLessEqual(result.alto,2048)
        with Image.open(BytesIO(data)) as image:
            self.assertEqual(image.size,(3000,1000))
