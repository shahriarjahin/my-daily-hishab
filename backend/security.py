"""Account security proxy; session tokens remain in encrypted HttpOnly cookies."""
from typing import Literal
from uuid import UUID
from fastapi import APIRouter, Response
from pydantic import Field
from . import cloud
from .api import Input

router=APIRouter(prefix="/api/auth")
class VerifyFactor(Input):
    factor_id: UUID
    code: str = Field(pattern=r"^\d{6}$")
class VerifyPasskey(Input):
    challenge_id: UUID
    credential: dict

@router.get("/security")
def security_status():
    identity=cloud.user()
    profile=cloud.call("GET","/auth/v1/user",identity["access_token"])
    factors=profile.get("factors",[])
    return {"factors":[{k:f.get(k) for k in ("id","factor_type","status","friendly_name")} for f in factors],"aal":identity.get("aal","aal1")}

@router.post("/mfa/enroll")
def enroll():
    identity=cloud.require_assurance()
    return cloud.call("POST","/auth/v1/factors",identity["access_token"],{"factor_type":"totp","friendly_name":"Hishab authenticator","issuer":"Hishab"})

@router.post("/mfa/verify")
def verify(body:VerifyFactor,response:Response):
    identity=cloud.user()
    path="/auth/v1/factors/"+str(body.factor_id)
    challenge=cloud.call("POST",path+"/challenge",identity["access_token"],{})
    tokens=cloud.call("POST",path+"/verify",identity["access_token"],{"challenge_id":challenge["id"],"code":body.code})
    cloud.set_cookie(response,cloud.token_data(tokens))
    return {"verified":True}

@router.delete("/mfa/{factor_id}")
def remove_factor(factor_id:UUID):
    identity=cloud.require_assurance()
    cloud.call("DELETE","/auth/v1/factors/"+str(factor_id),identity["access_token"])
    return {"removed":True}

@router.post("/passkey/{ceremony}/options")
def passkey_options(ceremony:Literal["registration","authentication"]):
    identity=cloud.require_assurance() if ceremony=="registration" else None
    return cloud.call("POST","/auth/v1/passkeys/"+ceremony+"/options",identity["access_token"] if identity else None,{})

@router.post("/passkey/{ceremony}/verify")
def passkey_verify(ceremony:Literal["registration","authentication"],body:VerifyPasskey,response:Response):
    identity=cloud.require_assurance() if ceremony=="registration" else None
    result=cloud.call("POST","/auth/v1/passkeys/"+ceremony+"/verify",identity["access_token"] if identity else None,{"challenge_id":str(body.challenge_id),"credential":body.credential})
    if ceremony=="authentication":
        cloud.set_cookie(response,cloud.token_data(result))
        return {"signed_in":True}
    return {"registered":True}

@router.get("/passkeys")
def passkeys():
    identity=cloud.require_assurance()
    return cloud.call("GET","/auth/v1/passkeys",identity["access_token"])

@router.delete("/passkeys/{passkey_id}")
def remove_passkey(passkey_id:UUID):
    identity=cloud.require_assurance()
    cloud.call("DELETE","/auth/v1/passkeys/"+str(passkey_id),identity["access_token"])
    return {"removed":True}
