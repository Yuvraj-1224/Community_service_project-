"""Logging setup with a filter that redacts secrets (passwords, tokens)."""
import logging
import re

_REDACT = re.compile(r"(password|token|authorization|secret)([\"']?\s*[:=]\s*[\"']?)([^\s\"',}]+)", re.IGNORECASE)
_BEARER = re.compile(r"Bearer\s+[A-Za-z0-9\-_\.]+")


class RedactSecretsFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        msg = _BEARER.sub("Bearer [REDACTED]", msg)
        msg = _REDACT.sub(lambda m: f"{m.group(1)}{m.group(2)}[REDACTED]", msg)
        record.msg, record.args = msg, ()
        return True


def setup_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"))
    handler.addFilter(RedactSecretsFilter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)


logger = logging.getLogger("agrovision")
