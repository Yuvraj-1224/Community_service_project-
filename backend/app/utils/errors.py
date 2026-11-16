"""Consistent error responses: {"success": false, "message": ..., "error": {...}}."""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("agrovision.errors")


class AppError(HTTPException):
    """Domain error with a machine readable code (used by the frontend for i18n)."""

    def __init__(self, status_code: int, message: str, code: str = "error", details: dict | None = None):
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.details = details or {}


def _body(message: str, code: str, status: int, details=None) -> dict:
    return {"success": False, "message": message, "error": {"code": code, "status": status, "details": details or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=_body(str(exc.detail), exc.code, exc.status_code, exc.details))

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException):
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        return JSONResponse(status_code=exc.status_code, content=_body(str(exc.detail), code, exc.status_code),
                            headers=getattr(exc, "headers", None))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            loc = ".".join(str(x) for x in e.get("loc", []) if x not in ("body", "query", "path"))
            msg = str(e.get("msg", "Invalid value")).removeprefix("Value error, ")
            errors.append({"field": loc, "message": msg})
        first = errors[0]["message"] if errors else "Invalid request"
        return JSONResponse(status_code=422, content=_body(first, "validation_error", 422, {"errors": errors}))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        logger.exception("Unhandled error: %s", type(exc).__name__)
        return JSONResponse(status_code=500, content=_body("Internal server error", "internal_error", 500))
