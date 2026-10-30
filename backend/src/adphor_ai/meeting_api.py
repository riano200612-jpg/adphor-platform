"""Authenticated QA-only assessment. Never books, approves or dispatches."""
from dataclasses import asdict
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, ConfigDict, Field
from .meeting_triage import assess_meeting

class Assessment(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    project_id: str = Field(min_length=1,max_length=100,pattern=r'^[a-z0-9][a-z0-9-]*$')
    subject: str = Field(min_length=3,max_length=200)
    notes: str = Field(default='',max_length=5000)
    management_requested: bool = False


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
