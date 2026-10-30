"""Offline, fail-closed ADPHOR catalog audit. No network, SQL or mapping approvals."""
from __future__ import annotations

import argparse
import csv
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path


class SourceRow(dict):
    """CSV logical record position, including blank records (not physical lines)."""
    def __init__(self, values, source_row):
        super().__init__(values)
        self.source_row = source_row


def cell_text(value):
    return '' if value is None else str(value)


def normalize_name(value: object) -> str:
    raw = unicodedata.normalize("NFKD", str(value or ""))
    plain = "".join(c for c in raw if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", re.sub(r"[^\w]+", " ", plain.casefold())).strip()


def catalog(rows) -> dict:
    names_by_id = {}
    ids_by_name = defaultdict(set)
    conflicts = set()
    count = 0
    for row in rows:
        ident = str(row.get("ID_Copropiedad") or "").strip()
        name = normalize_name(row.get("Copropiedad"))
        if not ident and not name:
            continue
        count += 1
        if not ident or not name:
            conflicts.add(ident or "<empty>")
            continue
        if ident in names_by_id and names_by_id[ident] != name:
            conflicts.add(ident)
        names_by_id[ident] = name
        ids_by_name[name].add(ident)
    return {
        "rows": count, "names_by_id": names_by_id, "ids_by_name": ids_by_name,
        "conflicting_ids": sorted(conflicts),
        "ambiguous_names": sum(len(ids) > 1 for ids in ids_by_name.values()),
    }


def compare_catalogs(master, other) -> dict:
    a = master["names_by_id"]
    b = other["names_by_id"]
    return {
        "missing_ids_in_other": sorted(set(a) - set(b)),
        "extra_ids_in_other": sorted(set(b) - set(a)),
        "changed_name_ids": sorted(k for k in set(a) & set(b) if a[k] != b[k]),
        "conflicting_ids": other["conflicting_ids"],
        "ambiguous_names": other["ambiguous_names"],
    }


def audit_catalogs(master_rows, info_rows, update_rows, event_rows) -> dict:
    master = catalog(master_rows)
    info = catalog(info_rows)
    updates = catalog(update_rows)
    matching = Counter()
    occurrence = Counter()
    missing_id_rows = []
    blank_rows = 0
    positions = set()
    for ordinal, row in enumerate(event_rows, start=2):
        source_row = getattr(row, 'source_row', ordinal)
        if type(source_row) is not int or source_row < 2 or source_row in positions:
            raise ValueError('Invalid or repeated source position')
        positions.add(source_row)
        if not any(cell_text(value).strip() for value in row.values()):
            blank_rows += 1
            continue
        event_id = str(row.get("ID_Registro") or "").strip()
        if not event_id:
            missing_id_rows.append(source_row)
            continue
        occurrence[event_id] += 1
        name = normalize_name(row.get("Copropiedad"))
        candidates = master["ids_by_name"].get(name, set()) if name else set()
        state = "candidate_only" if len(candidates) == 1 else (
            "ambiguous" if candidates else "unmatched"
        )
        matching[state] += 1
    report = {
        "counts": {
            "master": master["rows"], "info": info["rows"],
            "updates": updates["rows"], "events": sum(occurrence.values()),
            "event_rows_received": sum(occurrence.values()) + len(missing_id_rows) + blank_rows,
            "event_rows_missing_id": len(missing_id_rows),
            "event_rows_blank": blank_rows,
        },
        "event_missing_id_source_rows": missing_id_rows,
        "catalog_differences": {
            "info": compare_catalogs(master, info),
            "updates": compare_catalogs(master, updates),
        },
        "master_quality": {
            "conflicting_ids": master["conflicting_ids"],
            "ambiguous_names": master["ambiguous_names"],
        },
        "event_matches": {
            state: matching[state]
            for state in ("candidate_only", "unmatched", "ambiguous")
        },
        "event_duplicate_id_groups": sum(n > 1 for n in occurrence.values()),
        "event_extra_id_occurrences": sum(n - 1 for n in occurrence.values()),
        "mapping_approved": False,
        "gate_open": False,
    }
    return report


def read_csv(path, required_headers=()):
    with Path(path).open("r", newline="", encoding="utf-8-sig") as handle:
        reader = csv.reader(handle, strict=True)
        headers = next(reader, None)
        if not headers or any(not h.strip() for h in headers) or len(set(headers)) != len(headers):
            raise ValueError('Missing or duplicate CSV headers')
        if not set(required_headers).issubset(headers):
            raise ValueError('Required CSV headers missing')
        rows = []
        for number, values in enumerate(reader, start=2):
            if len(values) > len(headers):
                raise ValueError('CSV row has more values than headers')
            rows.append(SourceRow(dict(zip(headers, values + [''] * (len(headers)-len(values)))), number))
        return rows


def main(argv=None):
    parser = argparse.ArgumentParser(description="Offline ADPHOR audit; never opens tenant access")
    for name in ("master", "info", "updates", "events"):
        parser.add_argument(f"--{name}", required=True)
    options = parser.parse_args(argv)
    r = audit_catalogs(
        read_csv(options.master, ('ID_Copropiedad', 'Copropiedad')),
        read_csv(options.info, ('ID_Copropiedad', 'Copropiedad')),
        read_csv(options.updates, ('ID_Copropiedad', 'Copropiedad')),
        read_csv(options.events, ('ID_Registro', 'Copropiedad')),
    )
    print(json.dumps(r, indent=2, sort_keys=True, ensure_ascii=False))
    diffs = r["catalog_differences"].values()
    blocked = (
        r["event_matches"]["unmatched"] or r["event_matches"]["ambiguous"]
        or r["event_duplicate_id_groups"]
        or r["counts"]["event_rows_missing_id"]
        or r["master_quality"]["conflicting_ids"]
        or r["master_quality"]["ambiguous_names"]
        or any(d["missing_ids_in_other"] or d["extra_ids_in_other"]
               or d["changed_name_ids"] or d["conflicting_ids"]
               or d["ambiguous_names"] for d in diffs)
    )
    return 2 if blocked else 0


if __name__ == "__main__":
    raise SystemExit(main())
