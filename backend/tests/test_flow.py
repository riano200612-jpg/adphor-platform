"""All model doubles below are test fixtures, NOT deployed AI models."""
from dataclasses import replace, FrozenInstanceError
from datetime import date, datetime, timezone, timedelta
import unittest
from adphor_ai import (
    Caso, Entrada, Hallazgo, Borrador, EstadoCaso, EstadoFlujo,
    AgenteOperaciones, AgenteAnalisis, AgenteInformes, OrquestadorFlujo,
    EjecucionFallida, AprobacionAdministrador, IdentidadVerificada,
)

NOW = datetime(2026, 10, 21, 12, tzinfo=timezone.utc)


class MLPrueba:
    nombre, version = "ML_EXCLUSIVO_TEST", "1"
    def __init__(self, calls): self.calls = calls
    def estimar_riesgo(self, caso, fecha_corte):
        self.calls.append("ml")
        return 0.8


class DLPrueba:
    nombre, version = "DL_EXCLUSIVO_TEST", "1"
    def __init__(self, calls): self.calls = calls
    def detectar_anomalias(self, entrada):
        self.calls.append("dl")
        return (Hallazgo("variacion", "modelo", "Variación que requiere revisión",
                         indicadores=("pendientes",)),)


class PLNPrueba:
    nombre, version = "PLN_EXCLUSIVO_TEST", "1"
    def __init__(self, calls): self.calls = calls
    def redactar(self, entrada, hallazgos):
        self.calls.append("pln")
        return Borrador("Resumen de prueba; verificar los hallazgos.",
                        tuple(h.id for h in hallazgos))


class FlujoTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.ml = MLPrueba(self.calls)
        self.dl = DLPrueba(self.calls)
        self.pln = PLNPrueba(self.calls)
        self.entrada = Entrada("p1", date(2026, 10, 21), NOW,
            (Caso("c1", "p1", EstadoCaso.POR_VERIFICAR, None, date(2026, 10, 20)),),
            (("pendientes", 1),))
        self.admin = IdentidadVerificada("administrador", frozenset({"p1"}))
        self.aprobacion = AprobacionAdministrador()

    def run_flow(self, entrada=None):
        return OrquestadorFlujo(AgenteOperaciones(self.ml), AgenteAnalisis(self.dl),
                               AgenteInformes(self.pln)).ejecutar(entrada or self.entrada)

    def test_sequence_pending_and_immutable(self):
        r = self.run_flow()
        self.assertEqual(self.calls, ["ml", "dl", "pln"])
        self.assertEqual(r.estado, EstadoFlujo.PENDIENTE)
        self.assertIsNone(r.aprobado_por)
        self.assertEqual(len(r.pasos), 3)
        self.assertIn("vencido, sin asignar, pendiente de verificación", r.hallazgos[0].descripcion)
        self.assertEqual(self.entrada.casos[0].estado, EstadoCaso.POR_VERIFICAR)
        with self.assertRaises(FrozenInstanceError): r.revision = 2

    def test_closed_and_due_today_do_not_trigger_ml(self):
        entrada = replace(self.entrada, casos=(
            Caso("c1", "p1", EstadoCaso.CERRADA, None, date(2020, 1, 1)),
            Caso("c2", "p1", EstadoCaso.EN_PROCESO, "u1", self.entrada.fecha_corte),))
        self.run_flow(entrada)
        self.assertEqual(self.calls, ["dl", "pln"])

    def test_missing_deadline_is_not_invented(self):
        r = self.run_flow(replace(self.entrada, casos=(
            Caso("c1", "p1", EstadoCaso.PENDIENTE, None, None),)))
        self.assertEqual(r.hallazgos[0].descripcion, "sin asignar")

    def test_duplicate_or_foreign_cases_rejected(self):
        with self.assertRaises(ValueError):
            replace(self.entrada, casos=self.entrada.casos * 2)
        with self.assertRaises(ValueError):
            replace(self.entrada, casos=(replace(self.entrada.casos[0], propiedad_id="p2"),))

    def test_invalid_ml_risk_stops_subsequent_stages(self):
        for risk in [float("nan"), float("inf"), -0.1, 1.1]:
            self.calls.clear()
            self.ml.estimar_riesgo = lambda *args: risk
            with self.assertRaises(EjecucionFallida) as caught:
                self.run_flow()
            self.assertEqual(self.calls, [])
            self.assertEqual(caught.exception.pasos[-1].estado, "Fallido")

    def test_foreign_or_unsourced_dl_output_stops_pln(self):
        for finding in [Hallazgo("x", "dl", "Anomalía", ("foreign",)),
                        Hallazgo("x", "dl", "Anomalía")]:
            self.calls.clear()
            self.dl.detectar_anomalias = lambda *args: (finding,)
            with self.assertRaises(EjecucionFallida): self.run_flow()
            self.assertNotIn("pln", self.calls)

    def test_dl_cannot_mark_hypothesis_as_validated(self):
        self.dl.detectar_anomalias = lambda *args: (
            Hallazgo("x", "inventado", "Hipótesis", ("c1",), requiere_validacion=False),)
        r = self.run_flow()
        self.assertTrue(r.hallazgos[-1].requiere_validacion)
        self.assertEqual(r.hallazgos[-1].origen, "Análisis · DL")

    def test_empty_or_hallucinated_pln_output_rejected(self):
        for draft in [Borrador("", ()), Borrador("Texto", ("inventado",))]:
            self.pln.redactar = lambda *args: draft
            with self.assertRaises(EjecucionFallida): self.run_flow()

    def test_only_property_admin_approves_exact_revision(self):
        r = self.run_flow()
        for actor in [IdentidadVerificada("lector", frozenset()),
                      IdentidadVerificada("admin_otro", frozenset({"p2"}))]:
            with self.assertRaises(PermissionError):
                self.aprobacion.aprobar(r, actor, r.huella, NOW)
        with self.assertRaises(ValueError):
            self.aprobacion.aprobar(r, self.admin, "huella_anterior", NOW)
        aprobado = self.aprobacion.aprobar(r, self.admin, r.huella, NOW)
        self.assertEqual(aprobado.estado, EstadoFlujo.APROBADO)
        self.assertEqual(r.estado, EstadoFlujo.PENDIENTE)
        self.assertEqual(aprobado.entrada.casos[0].estado, EstadoCaso.POR_VERIFICAR)

    def test_edit_invalidates_approval_and_old_fingerprint(self):
        r = self.run_flow()
        aprobado = self.aprobacion.aprobar(r, self.admin, r.huella, NOW)
        editado = self.aprobacion.editar_borrador(aprobado, "Texto corregido", self.admin)
        self.assertEqual(editado.estado, EstadoFlujo.PENDIENTE)
        self.assertIsNone(editado.aprobado_por)
        self.assertEqual(editado.revision, 2)
        self.assertNotEqual(editado.huella, aprobado.huella)
        with self.assertRaises(ValueError):
            self.aprobacion.aprobar(editado, self.admin, aprobado.huella, NOW)

    def test_timestamp_and_input_quality(self):
        with self.assertRaises(ValueError): replace(self.entrada, leido_en=NOW.replace(tzinfo=None))
        with self.assertRaises(ValueError): replace(self.entrada, indicadores=(("x", float("nan")),))
        r = self.run_flow()
        with self.assertRaises(ValueError):
            self.aprobacion.aprobar(r, self.admin, r.huella, NOW - timedelta(seconds=1))

    def test_no_network_or_mutation_capabilities_in_orchestrator(self):
        flow = OrquestadorFlujo(AgenteOperaciones(self.ml), AgenteAnalisis(self.dl), AgenteInformes(self.pln))
        for obj in (flow, *flow.agentes):
            for name in ("cerrar_caso", "enviar_reporte", "aprobar", "save", "send"):
                self.assertFalse(hasattr(obj, name))


if __name__ == "__main__": unittest.main()
