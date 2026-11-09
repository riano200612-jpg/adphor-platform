"""Read-only reconciliation. Private output must stay outside the Git checkout.
No uploads, database writes, credential sheets, or permission grants.
"""
import argparse
import collections
import hashlib
import io
import json
from pathlib import Path
import re
import unicodedata
import zipfile
import xml.etree.ElementTree as ET


def key(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().lower())


def digest(data):
    return hashlib.sha256(data).hexdigest()


def reconcile(rows, photos, id_field, name_field):
    results = []
    ids = collections.Counter(str(r.get(id_field, '')) for r in rows)
    for row in rows:
        identity, name = str(row.get(id_field, '')), key(row.get(name_field))
        candidates = [p for p in photos if p['source_id'] == identity and p['name_key'] == name]
        hashes = {p['sha256'] for p in candidates}
        status = 'matched' if len(hashes) == 1 and ids[identity] == 1 else 'conflict' if candidates else 'missing'
        results.append({'source_id': identity, 'source_row': row.get('_source_row'),
                        'status': status, 'photos': candidates,
                        'permission': 'not_granted', 'target_project_id': None})
    return results


def source_rows(workbook, sheet):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    relns = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
    with zipfile.ZipFile(io.BytesIO(workbook)) as book:
        strings = []
        if 'xl/sharedStrings.xml' in book.namelist():
            strings = [''.join(si.itertext()) for si in ET.fromstring(book.read('xl/sharedStrings.xml'))]
        sheets = ET.fromstring(book.read('xl/workbook.xml')).find('m:sheets', ns)
        rid = next(s.attrib[relns] for s in sheets if s.attrib['name'] == sheet)
        rels = ET.fromstring(book.read('xl/_rels/workbook.xml.rels'))
        target = next(r.attrib['Target'] for r in rels if r.attrib['Id'] == rid)
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        rows = {}
        for row in ET.fromstring(book.read(target)).find('m:sheetData', ns):
            cells = {}
            for cell in row:
                col = re.sub(r'\d', '', cell.attrib.get('r', ''))
                value = cell.find('m:v', ns)
                value = value.text if value is not None else ''
                if cell.attrib.get('t') == 's':
                    value = strings[int(value)] if value else ''
                elif cell.attrib.get('t') == 'inlineStr':
                    value = ''.join(cell.find('m:is', ns).itertext())
                cells[col] = value
            rows[int(row.attrib['r'])] = cells
        headers = rows[min(rows)]
        return {number: {headers.get(col, col): value for col, value in cells.items()} for number, cells in rows.items()}


def verify_identities(workbook, rows, id_field, name_field):
    by_sheet = {}
    for row in rows:
        sheet = row['_source_sheet']
        if sheet not in by_sheet:
            by_sheet[sheet] = source_rows(workbook, sheet)
        source = by_sheet[sheet].get(int(row['_source_row']), {})
        source_id = re.sub(r'\.0+$', '', str(source.get(id_field)))
        if source_id != str(row.get(id_field)) or key(source.get(name_field)) != key(row.get(name_field)):
            raise ValueError('Source identity mismatch at row ' + str(row['_source_row']))
    return len(rows)


def inspect(media_paths, package, private_output):
    archives, images, workbooks = [], [], []
    master_bytes = None
    for path in [*media_paths, package]:
        with zipfile.ZipFile(path) as archive:
            bad = archive.testzip()
            if bad:
                raise ValueError('CRC failed: ' + path.name)
            entries = archive.infolist()
            if len({e.filename for e in entries}) != len(entries):
                raise ValueError('Duplicate ZIP paths')
            if any(Path(e.filename).is_absolute() or '..' in Path(e.filename).parts for e in entries):
                raise ValueError('Unsafe ZIP path')
            archives.append({'file': path.name, 'bytes': path.stat().st_size,
                             'sha256': digest(path.read_bytes()), 'entries': len(entries), 'crc': 'passed'})
            for entry in entries:
                suffix = Path(entry.filename).suffix.lower()
                if suffix in ('.jpg', '.jpeg', '.png', '.webp'):
                    data = archive.read(entry)
                    from PIL import Image
                    with Image.open(io.BytesIO(data)) as image:
                        image.verify()
                    match = re.fullmatch(r'(\d+)\.\s*(.+)', Path(entry.filename).stem)
                    group = key(str(Path(entry.filename).parent))
                    kind = 'property' if 'copropiedades' in group else 'staff' if 'colaboradores' in group or 'delegados' in group else 'branding'
                    images.append({'archive': path.name, 'path': entry.filename, 'kind': kind,
                                   'source_id': match[1] if match else None,
                                   'name_key': key(match[2]) if match else '', 'bytes': len(data),
                                   'sha256': digest(data)})
                elif suffix == '.xlsx':
                    data = archive.read(entry)
                    if Path(entry.filename).name == 'Master_ADPHOR.xlsx':
                        master_bytes = data
                    with zipfile.ZipFile(io.BytesIO(data)) as book:
                        ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                        root = ET.fromstring(book.read('xl/workbook.xml'))
                        sheets = [s.attrib['name'] for s in root.find('m:sheets', ns)]
                    workbooks.append({'path': entry.filename, 'sha256': digest(data), 'sheets': sheets})
    with zipfile.ZipFile(package) as archive:
        manifest = json.loads(archive.read('QA_MANIFEST.json'))
        counts = {}
        for name, expected in manifest['row_counts'].items():
            rows = [json.loads(line) for line in archive.read(name).decode().splitlines() if line.strip()]
            if len(rows) != expected:
                raise ValueError('Manifest count mismatch: ' + name)
            counts[name] = len(rows)
        projects = [json.loads(l) for l in archive.read('projects.jsonl').decode().splitlines() if l.strip()]
        staff = [json.loads(l) for l in archive.read('delegates_directory_no_credentials.jsonl').decode().splitlines() if l.strip()]
    master = [w for w in workbooks if Path(w['path']).name == 'Master_ADPHOR.xlsx']
    if len(master) != 1 or master[0]['sha256'] != manifest['master_sha256']:
        raise ValueError('Master workbook hash mismatch')
    identities = {'properties': verify_identities(master_bytes, projects, 'ID_Copropiedad', 'Copropiedad'),
                  'staff': verify_identities(master_bytes, staff, 'ID_Delegado', 'Delegado')}
    properties = reconcile(projects, [i for i in images if i['kind'] == 'property'], 'ID_Copropiedad', 'Copropiedad')
    people = reconcile(staff, [i for i in images if i['kind'] == 'staff'], 'ID_Delegado', 'Delegado')
    private = {'archives': archives, 'workbooks': workbooks, 'images': images,
               'properties': properties, 'staff': people, 'import_authorized': False}
    private_output.parent.mkdir(parents=True, exist_ok=True)
    private_output.write_text(json.dumps(private, ensure_ascii=False, indent=2))
    private_output.chmod(0o600)
    return {'archives': archives, 'master_hash_verified': True, 'source_identities_verified': identities, 'row_counts_verified': counts,
            'images_verified': len(images), 'unique_image_hashes': len({i['sha256'] for i in images}),
            'properties': dict(collections.Counter(x['status'] for x in properties)),
            'staff': dict(collections.Counter(x['status'] for x in people)),
            'authorization': 'No target mappings or access grants inferred. No database or storage writes.'}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--media', action='append', required=True, type=Path)
    parser.add_argument('--package', required=True, type=Path)
    parser.add_argument('--private-output', required=True, type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[1]
    if args.private_output.resolve().is_relative_to(repo):
        parser.error('Private output must be outside the Git checkout')
    print(json.dumps(inspect(args.media, args.package, args.private_output), ensure_ascii=False, indent=2))
