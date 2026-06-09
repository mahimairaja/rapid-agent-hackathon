from src.models.base import TimestampedDocument
from src.models.user import User

# Registered with Beanie at startup (src/db/mongo.py). Extend as M0 adds models.
DOCUMENT_MODELS = [User]

__all__ = [
    "DOCUMENT_MODELS",
    "TimestampedDocument",
    "User",
]
