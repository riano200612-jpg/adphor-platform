"""Synthetic-only tests. Never fetch, store or publish customer spreadsheets."""
import unittest

from backend.src.adphor_ai.catalog_audit import audit_catalogs, normalize_name


def property_row(ident, name):
    return {"ID_Copropiedad": ident, "Copropiedad": name}


def event_row(ident, name):
    return {"ID_Registro": ident, "Copropiedad": name}


class CatalogAuditTests(unittest.TestCase):
    def setUp(self):
        self.master = [property_row("11", "Conjunto A"), property_row("12", "Conjunto B")]

    def run_audit(self, info=None, updates=None, events=None):
        return audit_catalogs(
            self.master,
            self.master if info is None else info,
            self.master if updates is None else updates,
            [event_row("E1", "Conjunto A")] if events is None else events,
        )

    def test_normalization(self):
        self.assertEqual(normalize_name("   Álamo   P.H.  "), "alamo p h")

    def test_name_match_never_approves_tenant_mapping(self):
        r = self.run_audit()
        self.assertEqual(r["event_matches"]["candidate_only"], 1)
        self.assertFalse(r["mapping_approved"])
        self.assertFalse(r["gate_open"])

    def test_swapped_catalog_ids(self):
        wrong = [property_row("11", "Conjunto B"), property_row("12", "Conjunto A")]
        r = self.run_audit(info=wrong)
        self.assertEqual(r["catalog_differences"]["info"]["changed_name_ids"], ["11", "12"])

    def test_missing_new_property(self):
        r = self.run_audit(updates=[property_row("11", "Conjunto A")])
        self.assertEqual(r["catalog_differences"]["updates"]["missing_ids_in_other"], ["12"])

    def test_unknown_property_no_implicit_mapping(self):
        r = self.run_audit(events=[event_row("E1", "Conjunto No Registrado")])
        self.assertEqual(r["event_matches"]["unmatched"], 1)
        self.assertFalse(r["gate_open"])

    def test_similar_property_name_no_fuzzy_approval(self):
        r = self.run_audit(events=[event_row("E1", "Conjunto A Anexo")])
        self.assertEqual(r["event_matches"]["unmatched"], 1)

    def test_ambiguous_property_name(self):
        self.master.append(property_row("13", "Conjunto A"))
        r = self.run_audit()
        self.assertEqual(r["event_matches"]["ambiguous"], 1)
        self.assertFalse(r["gate_open"])

    def test_repeated_event_ids_not_discarded(self):
        r = self.run_audit(events=[
            event_row("E1", "Conjunto A"),
            event_row("E1", "Conjunto A"),
            event_row("E2", "Conjunto B"),
        ])
        self.assertEqual(r["event_duplicate_id_groups"], 1)
        self.assertEqual(r["event_extra_id_occurrences"], 1)
        self.assertEqual(r["counts"]["events"], 3)

    def test_empty_event_id_not_counted(self):
        r = self.run_audit(events=[event_row("", "Conjunto A"), event_row("E1", "Conjunto A")])
        self.assertEqual(r["counts"]["events"], 1)

    def test_duplicate_catalog_id_cannot_implicitly_be_accepted(self):
        self.master.append(property_row("11", "Conjunto C"))
        r = self.run_audit()
        self.assertEqual(r["master_quality"]["conflicting_ids"], ["11"])
        self.assertFalse(r["gate_open"])


if __name__ == "__main__":
    unittest.main()
