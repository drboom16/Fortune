from datetime import datetime

from .extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    account = db.relationship("Account", back_populates="user", uselist=False)
    watchlist_items = db.relationship(
        "WatchlistItem", back_populates="user", lazy="dynamic", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {"id": self.id, "email": self.email}


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    starting_balance = db.Column(db.Numeric(14, 2), nullable=False)
    cash_balance = db.Column(db.Numeric(14, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", back_populates="account")
    positions = db.relationship("Position", back_populates="account", lazy="dynamic")
    orders = db.relationship("Order", back_populates="account", lazy="dynamic")


class Position(db.Model):
    __tablename__ = "positions"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    symbol = db.Column(db.String(16), nullable=False)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    avg_price = db.Column(db.Numeric(14, 4), nullable=False, default=0)

    account = db.relationship("Account", back_populates="positions")

    def to_dict(self):
        return {
            "symbol": self.symbol,
            "quantity": int(self.quantity),
            "avg_price": float(self.avg_price),
        }


class Order(db.Model):
    __tablename__ = "orders"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    symbol = db.Column(db.String(16), nullable=False)
    side = db.Column(db.String(4), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(14, 4), nullable=False)
    status = db.Column(db.String(16), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    stop_loss_price = db.Column(db.Numeric(10, 4), nullable=True) # Optional
    take_profit_price = db.Column(db.Numeric(10, 4), nullable=True) # Optional
    exchange = db.Column(db.String(16), nullable=True) # Optional
    currency = db.Column(db.String(16), nullable=True) # Optional
    status_text = db.Column(db.String(16), nullable=True, default="OPEN")

    account = db.relationship("Account", back_populates="orders")

    def to_dict(self):
        return {
            "id": self.id,
            "symbol": self.symbol,
            "side": self.side,
            "quantity": int(self.quantity),
            "price": float(self.price),
            "status": self.status,
            "created_at": self.created_at.isoformat() + "Z",
            "stop_loss_price": float(self.stop_loss_price) if self.stop_loss_price else None,
            "take_profit_price": float(self.take_profit_price) if self.take_profit_price else None,
            "exchange": self.exchange,
            "currency": self.currency,
            "status_text": self.status_text,
        }


class WatchlistItem(db.Model):
    __tablename__ = "watchlist_items"
    __table_args__ = (db.UniqueConstraint("user_id", "symbol", name="uq_watchlist_user_symbol"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    symbol = db.Column(db.String(16), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", back_populates="watchlist_items")


class PriceAlert(db.Model):
    __tablename__ = "price_alerts"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    symbol = db.Column(db.String(16), nullable=False)
    base_price = db.Column(db.Numeric(14, 4), nullable=False)
    threshold_percent = db.Column(db.Numeric(8, 4), nullable=False)  # e.g. -10, +5
    triggered = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    user = db.relationship("User", backref=db.backref("price_alerts", lazy="dynamic"))
