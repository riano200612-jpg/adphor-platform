"""Synthetic test fixtures only; no customer data or network calls."""
import unittest

from backend.src.adphor_ai.snapshot_reconcile import compare_snapshot


class SnapshotReconcileTests(unittest.TestCase):
    def test_exact_property(self):
        r = compare_snapshot("Copropiedades",
                             [["ID_Copropiedad", "Copropiedad"], ["A", "Synthetic A"]],
                             [{"source_row": 2, "source_record_id": "A", "payload": {"property_name_raw": "Synthetic A"}}])
        self.assertTrue(r["source_identical_on_selected_fields"])
        self.assertEqual(r["compared_fields"], 2)
        self.assertFalse(r["mapping_approved"])
        self.assertFalse(r["agent_read_authorized"])

    def test_changed_id_and_event_date_detected_without_values(self):
        drive = [["ID"]] + [["A", "01/01/2026", "Synthetic A", "", "", "Consejo", "", "02/01/2026", "5 PM", "Virtual", "Confirmada"]]
        db = [{"source_row": 2, "source_record_id": "B", "payload": {
            "registered_at_raw": "01/01/2026", "property_name_raw": "Synthetic A", "category": "Consejo",
            "event_date_raw": "03/01/2026", "estimated_start_raw": "5 PM", "modality": "Virtual", "source_status": "Confirmada"}}]
        r = compare_snapshot("Registros", drive, db)
        self.assertEqual(r["changes_by_field"], {"event_date_raw": 1, "source_record_id": 1})
        self.assertEqual(r["changed_source_rows"], [{"source_row": 2, "changed_fields": ["source_record_id", "event_date_raw"]}])
        self.assertNotIn("03/01/2026", str(r))

    def test_repeated_ids_in_distinct_rows_are_preserved(self):
        sheet = [["ID", "Name"], ["A", "Synthetic A"], ["A", "Synthetic B"]]
        db = [{"source_row": 2, "source_record_id": "A", "payload": {"property_name_raw": "Synthetic A"}},
              {"source_row": 3, "source_record_id": "A", "payload": {"property_name_raw": "Synthetic B"}}]
        r = compare_snapshot("Copropiedades", sheet, db)
        self.assertEqual(r["sql_rows"], 2)
        self.assertTrue(r["source_identical_on_selected_fields"])

    def test_changed_row_position_not_misclassified(self):
        sheet = [["ID", "Name"], ["A", "Synthetic A"], ["B", "Synthetic B"]]
        db = [{"source_row": 2, "source_record_id": "A", "payload": {"property_name_raw": "Synthetic A"}},
              {"source_row": 4, "source_record_id": "B", "payload": {"property_name_raw": "Synthetic B"}}]
        r = compare_snapshot("Copropiedades", sheet, db)
        self.assertEqual(r["changes_by_field"], {"missing_in_drive": 1, "missing_in_sql": 1})

    def test_missing_row_in_drive(self):
        r = compare_snapshot("Copropiedades", [["ID", "Name"]],
                             [{"source_row": 2, "source_record_id": "A", "payload": {"property_name_raw": "Synthetic A"}}])
        self.assertEqual(r["changes_by_field"], {"missing_in_drive": 1})

    def test_missing_row_in_sql(self):
        r = compare_snapshot("Copropiedades", [["ID", "Name"], ["A", "Synthetic A"]], [])
        self.assertEqual(r["changes_by_field"], {"missing_in_sql": 1})

    def test_empty_values_consistently_compared(self):
        r = compare_snapshot("PQRS", [["ID"], ["A", "", "", "", "", "", "", "", ""]],
                             [{"source_row": 2, "source_record_id": "A", "payload": {"registered_at_raw": "", "source_status": ""}}])
        self.assertTrue(r["source_identical_on_selected_fields"])

    def test_unknown_sheet_rejected(self):
        with self.assertRaises(ValueError):
            compare_snapshot("PIN", [["ID"]], [])

    def test_repeated_sql_source_row_rejected(self):
        with self.assertRaises(ValueError):
            compare_snapshot("Copropiedades", [["ID"]], [
                {"source_row": 2, "source_record_id": "A", "payload": {}},
                {"source_row": 2, "source_record_id": "B", "payload": {}}])

    def test_empty_drive_rejected(self):
        with self.assertRaises(ValueError):
            compare_snapshot("Copropiedades", [], [])


if __name__ == "__main__":
    unittest.main()
