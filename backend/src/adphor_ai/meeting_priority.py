"""Rules recovered from PR12; not trained ML or agenda authorization."""
LEVELS = ("bajo", "medio", "alto")

KEYWORDS_HIGH = ("emergencia", "riesgo estructural", "seguridad", "incendio", "inundación", "junta extraordinaria")

KEYWORDS_MEDIUM = ("pqrs", "mantenimiento", "queja", "reclamo", "informe diario")

def classify_priority(text: str, pqrs_type: str = "", impact: str = "") -> dict:
    """Clasificación explicable provisional; cualquier IA posterior solo propone."""
    corpus = " ".join((text or "", pqrs_type or "", impact or "")).casefold()
    if any(word in corpus for word in KEYWORDS_HIGH):
        return {"priority_level": "alto", "requires_management": True, "reason": "Regla de criticidad alta"}
    if any(word in corpus for word in KEYWORDS_MEDIUM):
        return {"priority_level": "medio", "requires_management": False, "reason": "Seguimiento administrativo"}
    return {"priority_level": "bajo", "requires_management": False, "reason": "Gestión ordinaria"}
