"""Plan private QA intake; never writes to Supabase or grants project mappings.

Source records and generated SQL must stay outside any Git repository.
"""
import argparse
import hashlib
import json
from pathlib import Path
import uuid
import zipfile

QA_REF = 'qfctnnnnltghepwujpdm'
FILES = {
    'pqrs': ('pqrs_history.jsonl', 'ID Caso', {
        '_source_sheet', '_source_row', 'ID Caso', 'Fecha_Registro',
        'ID_Delegado', 'Nombre', 'Motivo', 'Detalle', 'Adjunto (Link)',
        'T&C Aceptados', 'Estado', '_historical_only', '_write_to_live_pqrs'}),
    'delegates': ('delegates_directory_no_credentials.jsonl', 'ID_Delegado', {
        '_source_sheet', '_source_row', 'ID_Delegado', 'Delegado', 'Foto',
        'Rol', 'Correo', 'Estado', 'Leyenda Rol', 'nivelAdmin',
        'Sector Coordinado', '_no_auth_account_creation'}),
    'projects': ('projects.jsonl', 'ID_Copropiedad', {
        '_source_sheet', '_source_row', 'ID_Copropiedad', 'Copropiedad',
        'ID_Delegado', 'Delegado', 'Correo Electrónico', 'Foto', 'Sector',
        'ID_Coordinador'}),
}
MAX_FILE = 8 * 1024 * 1024


def canonical(row):
    return json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def load_plan(archive, project_ref):
    if project_ref != QA_REF:
        raise ValueError('Only the isolated ADPHOR QA project is allowed')
    raw = Path(archive).read_bytes()
    fingerprint = hashlib.sha256(raw).hexdigest()
    batch = str(uuid.uuid5(uuid.NAMESPACE_URL, 'adphor:qa:' + fingerprint))
    collections = {}
    with zipfile.ZipFile(archive) as z:
        for kind, (filename, key, allowed) in FILES.items():
            if z.namelist().count(filename) != 1:
                raise ValueError('Missing or duplicate source member: ' + filename)
            info = z.getinfo(filename)
            if info.file_size > MAX_FILE:
                raise ValueError('Source exceeds size limit')
            rows = [json.loads(line) for line in z.read(filename).decode('utf-8').splitlines() if line.strip()]
            seen_rows, seen_keys = set(), set()
            for row in rows:
                if not isinstance(row, dict) or set(row) - allowed:
                    raise ValueError('Unexpected source fields; review privately before import')
                if any(isinstance(value, (dict, list)) for value in row.values()):
                    raise ValueError('Nested source values require private review')
                number = row.get('_source_row')
                source_key = str(row.get(key, '')).strip()
                if type(number) is not int or number < 2 or number in seen_rows:
                    raise ValueError('Invalid or duplicate source row')
                if not source_key or source_key in seen_keys:
                    raise ValueError('Missing or duplicate source key')
                seen_rows.add(number)
                seen_keys.add(source_key)
            collections[kind] = rows
    return {'project_ref': project_ref, 'archive_sha256': fingerprint,
            'batch_id': batch, 'collections': collections}


def mapping_candidates(plan):
    """Suggestions only: delegate assignment is not approval or proof of case ownership."""
    index = {}
    for project in plan['collections']['projects']:
        index.setdefault(str(project.get('ID_Delegado', '')), []).append({
            'source_project_id': str(project['ID_Copropiedad']),
            'source_project_name': project['Copropiedad']})
    return [{'source_row': row['_source_row'], 'source_case_id': str(row['ID Caso']),
             'candidates': index.get(str(row.get('ID_Delegado', '')), []),
             'approved': False}
            for row in plan['collections']['pqrs']]


def quote(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


def render_sql(plan):
    if plan['project_ref'] != QA_REF:
        raise ValueError('Invalid QA target')
    sql = ['BEGIN;']
    fields = {'source_registered_at': 'Fecha_Registro', 'source_delegate_id': 'ID_Delegado',
              'requester_name': 'Nombre', 'reason': 'Motivo', 'detail': 'Detalle',
              'terms_accepted': 'T&C Aceptados', 'source_status': 'Estado',
              'attachment_link': 'Adjunto (Link)'}
    for kind, rows in plan['collections'].items():
        for row in rows:
            payload = canonical(row)
            if kind == 'pqrs':
                values = {'id': str(uuid.uuid5(uuid.UUID(plan['batch_id']), str(row['_source_row']))),
                          'batch_id': plan['batch_id'], 'source_row': row['_source_row'],
                          'source_case_id': row['ID Caso'],
                          **{column: row.get(source) for column, source in fields.items()},
                          'raw_payload': payload}
                table = 'pilot_private.pqrs_sources'
                conflict = 'batch_id,source_row'
            else:
                values = {'batch_id': plan['batch_id'], 'source_kind': kind,
                          'source_row': row['_source_row'], 'source_key': row[FILES[kind][1]],
                          'payload_sha256': hashlib.sha256(payload.encode()).hexdigest(),
                          'payload': payload}
                table = 'pilot_private.directory_sources'
                conflict = 'batch_id,source_kind,source_row'
            sql.append('INSERT INTO ' + table + ' (' + ','.join(values) + ') VALUES (' +
                       ','.join(quote(v) for v in values.values()) + ') ON CONFLICT (' +
                       conflict + ') DO NOTHING;')
    return '\n'.join(sql + ['COMMIT;']) + '\n'


def write_private(path, content):
    path = Path(path).resolve()
    if any((parent / '.git').exists() for parent in [path.parent, *path.parents]):
        raise ValueError('Private output must be outside every Git repository')
    # Never overwrite another artifact or follow an existing symlink.
    import os
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as output:
        output.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', required=True)
    parser.add_argument('--project-ref', required=True)
    parser.add_argument('--sql-output')
    parser.add_argument('--review-output')
    args = parser.parse_args()
    plan = load_plan(args.archive, args.project_ref)
    review = mapping_candidates(plan)
    if args.sql_output:
        write_private(args.sql_output, render_sql(plan))
    if args.review_output:
        write_private(args.review_output, json.dumps(review, ensure_ascii=False, indent=2))
    print(json.dumps({'batch_id': plan['batch_id'], 'archive_sha256': plan['archive_sha256'],
                      'counts': {kind: len(rows) for kind, rows in plan['collections'].items()},
                      'mapping_approvals': 0, 'database_writes': 0}))


if __name__ == '__main__':
    main()
