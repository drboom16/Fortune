import os

from flask import Flask

import asyncio
import threading

from .extensions import bcrypt, cors, db, jwt
from .routes import api
from .models import Position
from .websocket_manager import ws_manager

# NOTE: if you want to utilise an asynchronous background manager within Flask
# you need to wrap the execution in a separate thread

def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///paper_trader.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "change-me")

    db.init_app(app)
    jwt.init_app(app)
    bcrypt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(api)

    with app.app_context():
        db.create_all()

        # Get all unique symbols from the database
        symbols = db.session.query(Position.symbol).distinct().all()
        symbol_list = [symbol[0] for symbol in symbols]
 
        if symbol_list:
            # Start WebSocket streaming for all symbols

            def run_ws_manager():
                asyncio.run(ws_manager.start(symbol_list))

            # Run WebSocket streaming in background thread (daemon threads mean the thread dies when the main app closes)
            thread = threading.Thread(target=run_ws_manager, daemon=True)
            thread.start()

            print(f"Started WebSocket for {len(symbol_list)} symbols: {symbol_list}")

    return app
