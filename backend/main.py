"""Cloud finance tracker with account sync and automatic AI provider failover."""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from .auth import router as auth_router
from .security import router as security_router
from .api import router
from .integrations import router as integration_router
from .finance import router as finance_router
from .statements import router as statement_router
from . import cloud

_HERE = Path(__file__).parent


@asynccontextmanager
async def lifespan(app):
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(router)
app.include_router(auth_router)
app.include_router(security_router)
app.include_router(integration_router)
app.include_router(finance_router)
app.include_router(statement_router)
app.mount("/static", StaticFiles(directory=str(_HERE / "static")), name="static")
react_directory = _HERE / "static" / "react"
# The committed production bundle keeps Vercel's Python build independent of Node.
app.mount("/assets", StaticFiles(directory=str(react_directory / "assets"), check_dir=False), name="react-assets")


@app.middleware("http")
async def account_context(request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)
    from starlette.concurrency import run_in_threadpool
    origin = request.headers.get("origin")
    if request.method not in ("GET", "HEAD", "OPTIONS") and origin and origin.rstrip("/") != str(request.base_url).rstrip("/"):
        return JSONResponse({"detail": "Use this app's own page to submit requests."}, status_code=403)
    try:
        identity, refreshed = await run_in_threadpool(cloud.read_session, request)
    except HTTPException as error:
        return JSONResponse({"detail": error.detail}, status_code=error.status_code)
    token = cloud.CURRENT_USER.set(identity)
    try:
        public = request.url.path.startswith("/api/auth/") or request.url.path in ("/api/cloud/status", "/api/cloud/setup.sql", "/api/health")
        if cloud.cloud_mode() and not identity and not public:
            return JSONResponse({"detail": "Sign in to access your cloud workspace."}, status_code=401)
        if identity and identity.get("mfa_required") and not public:
            return JSONResponse({"detail":"Complete two-step verification first."},status_code=403)
        response = await call_next(request)
        if identity and identity.get("workspace_revision") is not None:
            response.headers["X-Workspace-Revision"] = str(identity["workspace_revision"])
        if refreshed and not request.url.path.startswith("/api/auth/"):
            cloud.set_cookie(response, refreshed)
        response.headers["Cache-Control"] = "no-store"
        return response
    finally:
        cloud.CURRENT_USER.reset(token)


@app.get("/manifest.webmanifest")
def manifest():
    return FileResponse(_HERE / "static" / "manifest.webmanifest", media_type="application/manifest+json")


@app.get("/sw.js")
def service_worker():
    return FileResponse(_HERE / "static" / "sw.js", media_type="application/javascript", headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"})
@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    if (react_directory / "index.html").is_file():
        return FileResponse(react_directory / "index.html", media_type="text/html", headers={"Cache-Control": "no-cache"})
    return HTMLResponse("Build the React interface with: python scripts/build_frontend.py", status_code=503)


@app.get("/analyze", response_class=HTMLResponse)
def analyze_page(request: Request):
    return dashboard(request)


@app.get("/.well-known/assetlinks.json")
def android_association():
    return FileResponse(_HERE / "static" / "assetlinks.json",media_type="application/json")
