"""Synthetic CSV and schema-drift regression tests."""
from pathlib import Path
import tempfile
import unittest

from backend.src.adphor_ai.catalog_audit import read_csv, audit_catalogs, SourceRow
from backend.src.adphor_ai.snapshot_reconcile import compare_snapshot


class SourcePositionsTests(unittest.TestCase):
    def read(self, content):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'synthetic.csv'
            path.write_text(content)
            return read_csv(path, ('ID_Registro', 'Copropiedad'))

    def audit(self, rows):
        return audit_catalogs([], [], [], rows)

    def test_blank_records_preserve_positions(self):
        rows = self.read('ID_Registro,Copropiedad\nE1,A\n\n,A\n')
        result = self.audit(rows)
        self.assertEqual([r.source_row for r in rows], [2, 3, 4])
        self.assertEqual(result['event_missing_id_source_rows'], [4])
        self.assertEqual(result['counts']['event_rows_received'], 3)
        self.assertEqual(result['counts']['event_rows_blank'], 1)

    def test_multiline_cell_is_one_source_record(self):
        result = self.audit(self.read('ID_Registro,Copropiedad\nE1,"Synthetic\nA"\n,A\n'))
        self.assertEqual(result['event_missing_id_source_rows'], [3])

    def test_duplicate_missing_or_extra_columns_rejected(self):
        for content in ['ID_Registro,ID_Registro\nA,B\n',
                        'Wrong,Copropiedad\nA,B\n',
                        'ID_Registro,Copropiedad\nA,B,C\n']:
            with self.subTest(content=content), self.assertRaises(ValueError): self.read(content)

    def test_explicit_positions_survive_filtering(self):
        result = self.audit([SourceRow({'ID_Registro': '', 'Copropiedad': 'A'}, 525)])
        self.assertEqual(result['event_missing_id_source_rows'], [525])

    def test_repeated_positions_rejected(self):
        with self.assertRaises(ValueError):
            self.audit([SourceRow({'ID_Registro':'E1'},2), SourceRow({'ID_Registro':'E2'},2)])

    def test_zero_content_is_not_blank(self):
        result = self.audit([{'ID_Registro':'', 'Other':0}])
        self.assertEqual(result['counts']['event_rows_missing_id'], 1)

    def test_swapped_snapshot_headers_are_rejected_even_if_values_equal(self):
        with self.assertRaises(ValueError):
            compare_snapshot('Copropiedades', [['Copropiedad','ID_Copropiedad'],['A','A']],
                             [{'source_row':2,'source_record_id':'A','payload':{'property_name_raw':'A'}}])

    def test_missing_projected_sql_field_is_not_equivalent_to_empty_value(self):
        with self.assertRaises(ValueError):
            compare_snapshot('Copropiedades', [['ID_Copropiedad','Copropiedad'],['A','']],
                             [{'source_row':2,'source_record_id':'A','payload':{}}])

    def test_snapshot_blank_row_does_not_shift_following_row(self):
        result = compare_snapshot('Copropiedades', [['ID_Copropiedad','Copropiedad'],[],['A','A']],
                                  [{'source_row':3,'source_record_id':'A','payload':{'property_name_raw':'A'}}])
        self.assertTrue(result['source_identical_on_selected_fields'])


if __name__ == '__main__': unittest.main()
