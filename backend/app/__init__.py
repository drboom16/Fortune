import os

from flask import Flask, jsonify

import asyncio
import threading

from .extensions import bcrypt, cors, db, jwt
from .routes import api
from .models import Position, RevokedToken
from .websocket_manager import ws_manager
from .scheduler import init_scheduler

# NOTE: if you want to utilise an asynchronous background manager within Flask
# you need to wrap the execution in a separate thread

def create_app(config=None):  
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///paper_trader.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    # Fail fast on DB connect (avoid hanging worker startup on Render)
    db_url = app.config["SQLALCHEMY_DATABASE_URI"]
    if db_url.startswith("postgresql"):
        app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
            "connect_args": {"connect_timeout": 10},
        }
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "change-me")

    # JWT HTTPOnly cookie configuration (XSS-resistant, tokens never exposed to JS)
    app.config["JWT_TOKEN_LOCATION"] = ["cookies"]
    app.config["JWT_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"
    app.config["JWT_COOKIE_HTTPONLY"] = True
    app.config["JWT_COOKIE_SAMESITE"] = "Lax"
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 15 * 60  # 15 minutes
    app.config["JWT_REFRESH_TOKEN_EXPIRES"] = 30 * 24 * 60 * 60  # 30 days
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False  # SameSite=Lax mitigates most CSRF
    app.config["JWT_ACCESS_COOKIE_NAME"] = "access_token"
    app.config["JWT_REFRESH_COOKIE_NAME"] = "refresh_token"
    app.config["JWT_ACCESS_COOKIE_PATH"] = "/"
    app.config["JWT_REFRESH_COOKIE_PATH"] = "/"
    # Don't set cookie domain so browser uses request host (works with proxy)
    app.config["JWT_COOKIE_DOMAIN"] = None

    # CORS: must specify origins (not *) when using credentials
    cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173").split(",")
    app.config["CORS_SUPPORTS_CREDENTIALS"] = True

    # Apply config overrides BEFORE initializing extensions
    if config:
        app.config.update(config)

    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get("jti")
        if not jti:
            return False
        return RevokedToken.query.filter_by(jti=jti).first() is not None

    @jwt.unauthorized_loader
    def unauthorized_callback(_reason):
        return jsonify({"error": "Unauthorized"}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(_reason):
        return jsonify({"error": "Unauthorized"}), 401

    @jwt.expired_token_loader
    def expired_token_callback(_header, _payload):
        return jsonify({"error": "Unauthorized"}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(_header, _payload):
        return jsonify({"error": "Unauthorized"}), 401

    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": cors_origins,
                "supports_credentials": True,
            }
        },
    )

    app.register_blueprint(api)

    @app.route("/")
    def root():
        return jsonify({"status": "ok", "service": "fortune-api"}), 200

    def _init_background():
        """Defer heavy init so worker can accept connections quickly (avoids Render port scan timeout)."""
        with app.app_context():
            db.create_all()
            symbols = db.session.query(Position.symbol).distinct().all()
            symbol_list = [symbol[0] for symbol in symbols]
            if symbol_list:
                def run_ws_manager():
                    asyncio.run(ws_manager.start(symbol_list))
                t = threading.Thread(target=run_ws_manager, daemon=True)
                t.start()
                print(f"Started WebSocket for {len(symbol_list)} symbols: {symbol_list}")
            if not app.config.get("TESTING", False):
                init_scheduler(app)

    t = threading.Thread(target=_init_background, daemon=True)
    t.start()

    return app