from decimal import Decimal

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)

from .extensions import bcrypt, db
from .market_data import (
    fetch_basic_financials,
    fetch_chart,
    fetch_company_snapshot,
    fetch_forex_symbols,
    fetch_quote,
    fetch_watchlist,
)
from .models import Account, Order, Position, User

api = Blueprint("api", __name__, url_prefix="/api")


def _get_account_for_user(user_id: int) -> Account:
    account = Account.query.filter_by(user_id=user_id).first()
    if not account:
        account = Account(
            user_id=user_id, starting_balance=Decimal("100000"), cash_balance=Decimal("100000")
        )
        db.session.add(account)
        db.session.commit()
    return account


def _account_summary(account: Account) -> dict:
    equity_value = Decimal("0")
    for position in account.positions.all():
        quote = fetch_quote(position.symbol)
        equity_value += Decimal(str(quote["price"])) * Decimal(position.quantity)
    total_value = equity_value + account.cash_balance
    return {
        "id": account.id,
        "starting_balance": float(account.starting_balance),
        "cash_balance": float(account.cash_balance),
        "equity_value": float(equity_value),
        "total_value": float(total_value),
    }


@api.post("/auth/register")
def register():
    payload = request.get_json() or {}
    email = payload.get("email", "").lower().strip()
    password = payload.get("password", "")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    password_hash = bcrypt.generate_password_hash(password).decode("utf-8")
    user = User(email=email, password_hash=password_hash)
    db.session.add(user)
    db.session.flush()

    account = Account(
        user_id=user.id, starting_balance=Decimal("100000"), cash_balance=Decimal("100000")
    )
    db.session.add(account)
    db.session.commit()

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    return (
        jsonify(
            {
                "access_token": access_token,
                "refresh_token": refresh_token,
                "user": user.to_dict(),
            }
        ),
        201,
    )


@api.post("/auth/login")
def login():
    payload = request.get_json() or {}
    email = payload.get("email", "").lower().strip()
    password = payload.get("password", "")
    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401

    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    return jsonify(
        {"access_token": access_token, "refresh_token": refresh_token, "user": user.to_dict()}
    )


@api.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    return jsonify({"access_token": access_token})


@api.get("/market/watchlist")
def market_watchlist():
    try:
        items = fetch_watchlist(limit=20)
        return jsonify({"items": items})
    except Exception as exc:  # pragma: no cover - surface upstream error
        return jsonify({"error": str(exc)}), 500

@api.get("/market/<symbol>")
def market_symbol(symbol):
    try:
        snapshot = fetch_company_snapshot(symbol)
        return jsonify({"data": snapshot})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500

@api.get("/account")
@jwt_required()
def account():
    user_id = get_jwt_identity()
    account = _get_account_for_user(user_id)
    return jsonify({"account": _account_summary(account)})


@api.get("/portfolio")
@jwt_required()
def portfolio():
    user_id = get_jwt_identity()
    account = _get_account_for_user(user_id)
    positions_payload = []
    for position in account.positions.all():
        quote = fetch_quote(position.symbol)
        last_price = Decimal(str(quote["price"]))
        unrealized = (last_price - Decimal(position.avg_price)) * Decimal(position.quantity)
        positions_payload.append(
            {
                "symbol": position.symbol,
                "quantity": int(position.quantity),
                "avg_price": float(position.avg_price),
                "last_price": float(last_price),
                "unrealized_pnl": float(unrealized),
            }
        )
    return jsonify({"positions": positions_payload})


@api.get("/quote")
def quote():
    symbol = request.args.get("symbol", "").upper()
    if not symbol:
        return jsonify({"error": "Symbol required"}), 400
    return jsonify(fetch_quote(symbol))


@api.get("/chart")
def chart():
    symbol = request.args.get("symbol", "").upper()
    range_value = request.args.get("range", "1M").upper()
    if not symbol:
        return jsonify({"error": "Symbol required"}), 400
    return jsonify(fetch_chart(symbol, range_value))


@api.get("/stock/metric")
def stock_metric():
    symbol = request.args.get("symbol", "").upper()
    metric = request.args.get("metric", "all")
    if not symbol:
        return jsonify({"error": "Symbol required"}), 400
    return jsonify(fetch_basic_financials(symbol, metric))

@api.get("/forex/symbol")
def forex_symbol():
    exchange = request.args.get("exchange", "").lower()
    if not exchange:
        return jsonify({"error": "Exchange required"}), 400
    return jsonify(fetch_forex_symbols(exchange))


@api.post("/orders")
@jwt_required()
def create_order():
    payload = request.get_json() or {}
    symbol = payload.get("symbol", "").upper()
    side = payload.get("side", "").upper()
    quantity = int(payload.get("quantity", 0))

    if not symbol or side not in {"BUY", "SELL"} or quantity <= 0:
        return jsonify({"error": "Invalid order payload"}), 400

    user_id = get_jwt_identity()
    account = _get_account_for_user(user_id)
    quote = fetch_quote(symbol)
    price = Decimal(str(quote["price"]))
    order_cost = price * Decimal(quantity)

    position = account.positions.filter_by(symbol=symbol).first()
    if side == "BUY":
        if account.cash_balance < order_cost:
            return jsonify({"error": "Insufficient cash"}), 400
        account.cash_balance -= order_cost
        if position:
            total_shares = position.quantity + quantity
            total_cost = (Decimal(position.avg_price) * Decimal(position.quantity)) + order_cost
            position.avg_price = total_cost / Decimal(total_shares)
            position.quantity = total_shares
        else:
            position = Position(
                account_id=account.id,
                symbol=symbol,
                quantity=quantity,
                avg_price=price,
            )
            db.session.add(position)
    else:
        if not position or position.quantity < quantity:
            return jsonify({"error": "Insufficient shares"}), 400
        account.cash_balance += order_cost
        position.quantity -= quantity
        if position.quantity == 0:
            db.session.delete(position)

    order = Order(
        account_id=account.id,
        symbol=symbol,
        side=side,
        quantity=quantity,
        price=price,
        status="FILLED",
    )
    db.session.add(order)
    db.session.commit()

    return jsonify({"order": order.to_dict(), "account": _account_summary(account)})


@api.get("/orders")
@jwt_required()
def orders():
    user_id = get_jwt_identity()
    account = _get_account_for_user(user_id)
    orders_payload = [order.to_dict() for order in account.orders.order_by(Order.id.desc())]
    return jsonify({"orders": orders_payload})
