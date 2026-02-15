"""Production WebSocket Gateway Interface (WSGI) entry point."""
from app import create_app

app = create_app()
