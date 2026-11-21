"""AAL check ONLY after Supabase /auth/v1/user validated the exact bearer token.

This is not a JWT verifier and must never replace server-side token validation.
"""
import base64
import json
from fastapi import HTTPException


def require_enrolled_mfa(validated_user: dict, validated_token: str) -> None:
    factors = validated_user.get('factors', [])
    if not any(f.get('status') == 'verified' for f in factors):
        return
    try:
        parts = validated_token.split('.')
        if len(parts) != 3:
            raise ValueError('format')
        payload = json.loads(base64.urlsafe_b64decode(parts[1] + '=' * (-len(parts[1]) % 4)))
        allowed = payload.get('sub') == validated_user['id'] and payload.get('aal') == 'aal2'
    except (ValueError, TypeError, KeyError, UnicodeDecodeError):
        allowed = False
    if not allowed:
        raise HTTPException(403, 'Completa la verificación adicional de tu cuenta.')
