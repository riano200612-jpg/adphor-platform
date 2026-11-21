"""Offline comparison of reduced ADPHOR projections; no network or writes.

Input is already-authorized data supplied locally by an operator. Never upload
raw exports to git or CI. The report contains field names and row numbers only.
"""
from collections import Counter

PROJECTIONS = {
    "Copropiedades": {"source_record_id": 0, "property_name_raw": 1},
    "PQRS": {"source_record_id": 0, "registered_at_raw": 1, "source_status": 8},
    "Registros": {
        "source_record_id": 0,
        "registered_at_raw": 1,
        "property_name_raw": 2,
        "category": 5,
        "event_date_raw": 7,
        "estimated_start_raw": 8,
        "modality": 9,
        "source_status": 10,
    },
}


def _str(value):
    return "" if value is None else str(value)


def compare_snapshot(source_sheet, drive_values, db_rows):
    """Compare Sheets A1 values with SQL source_rows; never return customer values.

    drive_values: list of row arrays, including row 1 column headers.
    db_rows: dicts {source_row, source_record_id, payload} from private SQL.
    Neither source is changed; a passing result is not tenant authorization.
    """
    if source_sheet not in PROJECTIONS:
        raise ValueError("Unsupported source sheet")
    if not drive_values:
        raise ValueError("Drive sheet lacks headers")
    colmap = PROJECTIONS[source_sheet]
    rows = {}
    for obj in db_rows:
        number = obj["source_row"]
        if not isinstance(number, int) or number < 2 or number in rows:
            raise ValueError("Invalid or repeated source row index in SQL snapshot")
        if not isinstance(obj.get("payload"), dict):
            raise ValueError("SQL snapshot missing JSON payload")
        rows[number] = obj

    changed = {}
    source_found = set()
    for number, fields in enumerate(drive_values[1:], start=2):
        if not any(_str(v).strip() for v in fields):
            continue
        source_found.add(number)
        stored = rows.get(number)
        if stored is None:
            changed[number] = ["missing_in_sql"]
            continue
        different = []
        for field, index in colmap.items():
            source_value = _str(fields[index] if index < len(fields) else None)
            target_value = _str(stored["source_record_id"] if field == "source_record_id"
                                else stored["payload"].get(field))
            if source_value != target_value:
                different.append(field)
        if different:
            changed[number] = different
    for number in rows.keys() - source_found:
        changed[number] = ["missing_in_drive"]
    field_changes = Counter(f for fs in changed.values() for f in fs)
    return {
        "sheet": source_sheet,
        "drive_rows": len(source_found),
        "sql_rows": len(rows),
        "compared_fields": len(colmap) * len(source_found & rows.keys()),
        "changed_row_count": len(changed),
        "changes_by_field": dict(sorted(field_changes.items())),
        "changed_source_rows": [
            {"source_row": n, "changed_fields": changed[n]}
            for n in sorted(changed)
        ],
        "source_identical_on_selected_fields": not changed,
        "mapping_approved": False,
        "agent_read_authorized": False,
    }
