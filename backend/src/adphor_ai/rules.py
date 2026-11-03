"""Deterministic pilot: no ML/DL/NLP model is represented by these rules."""
from dataclasses import dataclass, replace, asdict
from datetime import date, datetime
from zoneinfo import ZoneInfo
from hashlib import sha256
import json
from uuid import UUID

PENDING = "Pendiente de aprobación del administrador"
STATES = {"Pendiente", "En proceso", "Por verificar", "Cerrada"}


@dataclass(frozen=True)
class Finding:
    code: str
    label: str
    ticket_ids: tuple[str, ...]
    action: str


@dataclass(frozen=True)
class RuleContext:
    tickets: tuple
    operators: frozenset
    cutoff: date
    findings: tuple[Finding, ...] = ()
    draft: str = ""


class OperationsRules:
    name = "Operaciones · reglas"

    def run(self, ctx):
        active = [t for t in ctx.tickets if t[2] != "Cerrada"]
        groups = (
            ("overdue", "Casos vencidos", [t[0] for t in active if t[4] and date.fromisoformat(t[4]) < ctx.cutoff], "Revisar el plazo y acordar la atención con el responsable."),
            ("unassigned", "Casos sin asignar", [t[0] for t in active if not t[3]], "Asignar un responsable operativo."),
            ("verification", "Pendientes de verificación", [t[0] for t in active if t[2] == "Por verificar"], "Revisar las evidencias antes de decidir el cierre."),
        )
        return replace(ctx, findings=tuple(Finding(a,b,tuple(c),d) for a,b,c,d in groups if c))


class DataQualityRules:
    name = "Calidad de datos · reglas"

    def run(self, ctx):
        active = [t for t in ctx.tickets if t[2] != "Cerrada"]
        groups = (
            ("missing_deadline", "Casos sin plazo", [t[0] for t in active if not t[4]], "Completar el plazo para poder evaluar vencimientos."),
            ("invalid_assignee", "Responsable sin pertenencia operativa vigente", [t[0] for t in active if t[3] and t[3] not in ctx.operators], "Verificar la asignación y los permisos del responsable."),
        )
        extra = tuple(Finding(a,b,tuple(c),d) for a,b,c,d in groups if c)
        return replace(ctx, findings=ctx.findings + extra)


class ExecutiveDraftRules:
    name = "Borrador ejecutivo · plantilla"

    def run(self, ctx):
        active = sum(t[2] != "Cerrada" for t in ctx.tickets)
        impacted = len({i for f in ctx.findings for i in f.ticket_ids})
        lines = ["ADPHOR · BORRADOR POR REGLAS", PENDING,
                 f"Fecha de corte: {ctx.cutoff.isoformat()} · Colombia",
                 f"Registros examinados: {len(ctx.tickets)}. Casos abiertos: {active}.",
                 f"Casos únicos con hallazgos: {impacted}.", "", "HALLAZGOS Y ACCIONES SUGERIDAS"]
        for f in ctx.findings:
            lines.append(f"• {f.label}: {len(f.ticket_ids)}. {f.action}")
        if not ctx.findings:
            lines.append("No se identificaron hallazgos con las reglas evaluadas.")
        lines.extend(["", "Los grupos pueden compartir casos; no sumar sus cantidades.",
                      "Describe la instantánea consultada, no un cierre mensual ni una predicción.",
                      "No se evaluaron fotografías, costos ni anomalías mediante modelos de IA.",
                      "El Administrador debe revisar el borrador. No se cerraron casos ni se enviaron informes."])
        return replace(ctx, draft="\n".join(lines))


def run_rules(project_id, tickets, members, read_at, run_id, requested_by):
    UUID(run_id)
    UUID(requested_by)
    if read_at.tzinfo is None:
        raise ValueError("La lectura necesita zona horaria.")
    seen = set()
    frozen = []
    for t in tickets:
        UUID(t["id"])
        if t["project_id"] != project_id or t["id"] in seen or t["status"] not in STATES:
            raise ValueError("Datos de casos inconsistentes.")
        if type(t["version"]) is not int or t["version"] < 1:
            raise ValueError("Versión de caso inválida.")
        if t["due_date"] is not None:
            date.fromisoformat(t["due_date"])
        seen.add(t["id"])
        frozen.append((t["id"], t["version"], t["status"], t["assignee"], t["due_date"]))
    if any(m["project_id"] != project_id for m in members):
        raise ValueError("Equipo de otra copropiedad.")
    operators = frozenset(m["user_id"] for m in members if m["role"] in ("admin", "coordinator", "technician"))
    ctx = RuleContext(tuple(sorted(frozen)), operators, read_at.astimezone(ZoneInfo("America/Bogota")).date())
    steps = []
    for agent in (OperationsRules(), DataQualityRules(), ExecutiveDraftRules()):
        ctx = agent.run(ctx)
        steps.append({"agent": agent.name, "method": "rules", "version": "1.0", "status": "completed"})
    source = {"requested_by": requested_by, "cutoff": ctx.cutoff.isoformat(),
              "tickets": sorted(tickets, key=lambda t: t["id"]),
              "members": sorted(members, key=lambda m: m["user_id"])}
    payload = {"id": run_id, "project_id": project_id, "source_read_at": read_at.isoformat(),
               "engine_kind": "rules", "source_snapshot": source,
               "findings": [asdict(f) for f in ctx.findings], "steps": steps, "draft": ctx.draft}
    payload["result_hash"] = sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return payload
