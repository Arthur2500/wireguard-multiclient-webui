"""Date/time utilities for the application."""
from datetime import datetime, timezone


def utc_now():
    """Return timezone-aware UTC datetime.
    
    This replaces the deprecated datetime.utcnow() with the
    recommended datetime.now(timezone.utc).
    """
    return datetime.now(timezone.utc)
