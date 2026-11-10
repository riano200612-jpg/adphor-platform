"""Authenticated QA-only assessment. Never books, approves or dispatches."""
from dataclasses import asdict
from datetime import timedelta
import os
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field
from .mfa_guard import require_enrolled_mfa
from .meeting_triage import assess_meeting

class Assessment(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    project_id: str = Field(min_length=1,max_length=100,pattern=r'^[a-z0-9][a-z0-9-]*$')
    subject: str = Field(min_length=3,max_length=200)
    notes: str = Field(default='',max_length=5000)
    management_requested: bool = False


class Availability(BaseModel):
    model_config = ConfigDict(extra='forbid')
    project_id: str = Field(min_length=1, max_length=100, pattern=r'^[a-z0-9][a-z0-9-]*(*, identity_dependency, membership_checker, settings):
    router=APIRouter(prefix='/meetings',tags=['meetings-qa'])
    @router.post('/assess')
    async def assess(body: Assessment, request: Request, actor=Depends(identity_dependency)):
        settings.assert_sandbox()
        await membership_checker(request,actor,body.project_id,('admin','coordinator'))
        decision=assess_meeting(body.subject,body.notes,management_requested=body.management_requested)
        return {'project_id':body.project_id,'engine_kind':'rules',
                'status':'pending_administrator_review','persisted':False,
                'booking_authorized':False,'notifications_sent':False,**asdict(decision)}
    @router.post('/availability')
    async def availability(body: Availability, request: Request, actor=Depends(identity_dependency)):
        settings.assert_sandbox()
        require_enrolled_mfa(actor, actor['token'], mandatory=True)
        await membership_checker(request, actor, body.project_id, ('admin', 'coordinator'))
        if not timedelta(0) < body.end - body.start <= timedelta(days=7):
            raise HTTPException(422, 'La consulta debe abarcar hasta siete días.')
        token = os.getenv('ADPHOR_QA_CALENDAR_ACCESS_TOKEN')
        calendar = os.getenv('ADPHOR_QA_CALENDAR_ID')
        if not token or not calendar:
            raise HTTPException(503, 'La disponibilidad corporativa no está configurada en QA.')
        try:
            async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
                response = await client.post('https://www.googleapis.com/calendar/v3/freeBusy',
                    headers={'Authorization': f'Bearer {token}'}, json={
                        'timeMin': body.start.isoformat(), 'timeMax': body.end.isoformat(),
                        'timeZone': 'America/Bogota', 'items': [{'id': calendar}],
                    })
                response.raise_for_status()
                data = response.json()['calendars'][calendar]
                if data.get('errors') or not isinstance(data['busy'], list):
                    raise ValueError('Invalid calendar response')
                busy = [{'start': item['start'], 'end': item['end']} for item in data['busy']]
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise HTTPException(502, 'No se pudo verificar la disponibilidad corporativa.') from None
        return {'project_id': body.project_id, 'busy': busy, 'timezone': 'America/Bogota'}

    return router
)
    start: AwareDatetime
    end: AwareDatetime


def build_meeting_router(*, identity_dependency, membership_checker, settings):
    router=APIRouter(prefix='/meetings',tags=['meetings-qa'])
    @router.post('/assess')
    async def assess(body: Assessment, request: Request, actor=Depends(identity_dependency)):
        settings.assert_sandbox()
        await membership_checker(request,actor,body.project_id,('admin','coordinator'))
        decision=assess_meeting(body.subject,body.notes,management_requested=body.management_requested)
        return {'project_id':body.project_id,'engine_kind':'rules',
                'status':'pending_administrator_review','persisted':False,
                'booking_authorized':False,'notifications_sent':False,**asdict(decision)}
    return router
