import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('intake', Path(__file__).parents[1] / 'scripts/qa_source_intake.py')
intake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intake)


class SourceIntakeTests(unittest.TestCase):
    def archive(self, directory, extra=None):
        path = Path(directory) / 'source.zip'
        rows = {'pqrs': [{'_source_row': 2, 'ID Caso': 'CASE-1', 'ID_Delegado': 'D1', 'Detalle': "A's note"}],
                'delegates': [{'_source_row': 2, 'ID_Delegado': 'D1'}],
                'projects': [{'_source_row': 2, 'ID_Copropiedad': 'P1', 'Copropiedad': 'One', 'ID_Delegado': 'D1'},
                             {'_source_row': 3, 'ID_Copropiedad': 'P2', 'Copropiedad': 'Two', 'ID_Delegado': 'D1'}]}
        if extra:
            rows['delegates'][0].update(extra)
        with zipfile.ZipFile(path, 'w') as archive:
            for kind, entries in rows.items():
                archive.writestr(intake.FILES[kind][0], '\n'.join(json.dumps(row) for row in entries))
        return path

    def test_replay_and_ambiguous_mapping_remain_private(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.archive(directory)
            first = intake.load_plan(path, intake.QA_REF)
            second = intake.load_plan(path, intake.QA_REF)
            self.assertEqual(intake.render_sql(first), intake.render_sql(second))
            self.assertIn("A''s note", intake.render_sql(first))
            self.assertNotIn('public.pilot_pqrs', intake.render_sql(first))
            self.assertNotIn('pqrs_approved_mappings', intake.render_sql(first))
            review = intake.mapping_candidates(first)[0]
            self.assertEqual(len(review['candidates']), 2)
            self.assertFalse(review['approved'])

    def test_credentials_and_wrong_target_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = self.archive(directory, {'PIN': 'synthetic-secret'})
            with self.assertRaises(ValueError):
                intake.load_plan(path, intake.QA_REF)
            with self.assertRaises(ValueError):
                intake.load_plan(path, 'production')
            path = self.archive(directory, {'Rol': {'password': 'synthetic-secret'}})
            with self.assertRaises(ValueError):
                intake.load_plan(path, intake.QA_REF)

    def test_private_output_cannot_be_written_into_repo_or_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.git').mkdir()
            with self.assertRaises(ValueError):
                intake.write_private(root / 'private.sql', 'private')
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'private.sql'
            intake.write_private(path, 'private')
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                intake.write_private(path, 'overwritten')


if __name__ == '__main__':
    unittest.main()
