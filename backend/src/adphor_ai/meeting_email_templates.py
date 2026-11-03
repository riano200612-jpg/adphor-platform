"""Safe HTML previews adapted from the original ADPHOR Reuniones Correo.gs.

No delivery, Gmail API, external requests, or access to credentials.
"""
from html import escape
from urllib.parse import urlparse

EVENTS = {
 "crear": ("Nueva Reunión Agendada", "Se ha programado una nueva reunión.", "#264B6B"),
 "editar": ("Actualización de Reunión", "Los detalles de la reunión han sido modificados.", "#264B6B"),
 "confirmar": ("Reunión Confirmada", "La reunión ha sido confirmada.", "#28734D"),
 "eliminar": ("Reunión Cancelada", "La reunión ha sido cancelada.", "#9B4133"),
 "recordatorio": ("Recordatorio de Reunión", "Recuerda tu próxima reunión.", "#264B6B"),
}
FIELDS = (("id", "ID Reunión"), ("copropiedad", "Copropiedad"),
 ("tipoReunion", "Tipo"), ("especificacion", "Especificación"),
 ("duracionTexto", "Duración"), ("modalidad", "Modalidad"),
 ("fecha", "Fecha"), ("hora", "Hora"), ("estado", "Estado"), ("notas", "Notas"))

def _meet_link(link: str) -> str:
 if not link:
  return ""
 parsed = urlparse(link)
 if parsed.scheme != "https" or parsed.hostname != "meet.google.com" or parsed.username or parsed.password:
  raise ValueError("Enlace Meet no autorizado")
 return link

def preview_meeting_email(data: dict, event: str, meet_link: str = "") -> dict:
 """Generate content for administrator review, not for transport."""
 if event not in EVENTS:
  raise ValueError("Tipo de comunicación inválido")
 title, message, color = EVENTS[event]
 safe_link = _meet_link(meet_link)
 rows = "".join("<p><strong>"+label+":</strong> "+escape(str(data.get(field) or "—"))+"</p>" for field,label in FIELDS)
 meet = ('<p><a href="'+escape(safe_link, quote=True)+'">Unirse con Google Meet</a></p>') if safe_link else ""
 body = ('<section style="max-width:600px;font-family:Arial,sans-serif">'
  '<h2 style="background:'+color+';color:white;padding:18px">'+escape(title)+'</h2>'
  '<p>Hola '+escape(str(data.get("delegado") or "participante"))+',</p>'
  '<p>'+escape(message)+'</p>'+rows+meet+
  '<p style="color:#667;font-size:12px">Plataforma de Reuniones ADPHOR. Mensaje pendiente de autorización.</p></section>')
 return {"subject":title,"html":body,"status":"preview_only","sent":False}
