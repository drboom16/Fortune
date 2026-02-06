from decimal import Decimal
import yfinance as yf
from datetime import datetime

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
    fetch_company_name,
    is_market_open,
)
from .models import Account, Order, Position, User, WatchlistItem
from .websocket_manager import ws_manager

api = Blueprint("api", __name__, url_prefix="/api")

blacklisted_tokens = set() # In memory token blacklist

def _normalize_watchlist_symbol(symbol: str) -> str:
    return symbol.strip().upper()


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

def get_current_price(symbol: str) -> float:
    """Get the current price for a symbol from the WebSocket cache or fetch from API"""

    # Try WebSocket cache first
    ws_price = ws_manager.get_price(symbol)

    if ws_price and ws_price > 0:
        last_update = ws_manager.get_last_update(symbol)

        if last_update and (datetime.now() - last_update).total_seconds() < 5:
            return ws_price

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        price = info.get("regularMarketPrice")
        if price and price > 0:
            # Update cache for next time
            ws_manager.price_cache[symbol] = float(price)
            ws_manager.last_update[symbol] = datetime.now()
            return float(price)

    except Exception as e:
        print(f"Error fetching price for {symbol}: {e}")
        return 0.0

    # Simply return the cached price even if stale
    return ws_price if ws_price > 0 else 0.0


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

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
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

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    response = jsonify(
        {
            "access_token": access_token, 
            "refresh_token": refresh_token, 
            "user": user.to_dict()
        }
    )
    
    response.set_cookie(
        'refresh_token',
        refresh_token,
        httponly=True,
        secure=False, # set to True in production with HTTPS
        samesite='Lax',
        max_age=7*24*60*60, # 7 days
        path='/'
    )

    return response, 200


@api.post("/auth/refresh")
@jwt_required(refresh=True)
def refresh():
    user_id = int(get_jwt_identity())
    access_token = create_access_token(identity=str(user_id))
    return jsonify({"access_token": access_token})


@api.post("/auth/logout")
@jwt_required()
def logout():
    access_token = request.headers.get("Authorization")
    refresh_token = request.cookies.get("refresh_token")

    if access_token and access_token.startswith('Bearer '):
        access_token = access_token[7:]
        blacklisted_tokens.add(access_token)

    if refresh_token:
        blacklisted_tokens.add(refresh_token)

    response = jsonify({'message': 'Successfully logged out'})
    response.set_cookie(
        'refresh_token',
        '',
        httponly=True,
        secure=False, # set to True in production with HTTPS
        samesite='Lax',
        expires=0,
        path='/'
    )

    return response, 200


@api.get("/market/watchlist")
@jwt_required()
def market_watchlist():
    try:
        user_id = int(get_jwt_identity())
        symbols = [item.symbol for item in WatchlistItem.query.filter_by(user_id=user_id).all()]
        items = fetch_watchlist(symbols=symbols) if symbols else []
        return jsonify({"items": items})
    except Exception as exc:  # pragma: no cover - surface upstream error
        return jsonify({"error": str(exc)}), 500


@api.post("/market/watchlist")
@jwt_required()
def add_watchlist():
    payload = request.get_json() or {}
    symbol = _normalize_watchlist_symbol(payload.get("symbol", ""))
    if not symbol:
        return jsonify({"error": "Symbol required"}), 400
    user_id = int(get_jwt_identity())
    existing = WatchlistItem.query.filter_by(user_id=user_id, symbol=symbol).first()
    if not existing:
        db.session.add(WatchlistItem(user_id=user_id, symbol=symbol))
        db.session.commit()
    symbols = [item.symbol for item in WatchlistItem.query.filter_by(user_id=user_id).all()]
    items = fetch_watchlist(symbols=symbols) if symbols else []
    return jsonify({"items": items})


@api.delete("/market/watchlist/<symbol>")
@jwt_required()
def remove_watchlist(symbol):
    normalized = _normalize_watchlist_symbol(symbol)
    if not normalized:
        return jsonify({"error": "Symbol required"}), 400
    user_id = int(get_jwt_identity())
    WatchlistItem.query.filter_by(user_id=user_id, symbol=normalized).delete()
    db.session.commit()
    symbols = [item.symbol for item in WatchlistItem.query.filter_by(user_id=user_id).all()]
    items = fetch_watchlist(symbols=symbols) if symbols else []
    return jsonify({"items": items})

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
    user_id = int(get_jwt_identity())
    account = _get_account_for_user(user_id)
    return jsonify({"account": _account_summary(account)})

@api.get("/portfolio")
@jwt_required()
def portfolio():
    user_id = int(get_jwt_identity())
    account = _get_account_for_user(user_id)
    positions = Position.query.filter_by(account_id=account.id).all()
    
    portfolio_payload = {
        "account_cash": float(account.cash_balance),
        "portfolio": []
    }

    for position in positions:
        if position.symbol not in ws_manager.subscribed_symbols:
            ws_manager.subscribe(position.symbol)

        price = get_current_price(position.symbol)
        company_name = fetch_company_name(position.symbol)
        unrealized = (Decimal(str(price)) - Decimal(str(position.avg_price))) * Decimal(str(position.quantity))
        unrealized_percentage = unrealized / (Decimal(str(position.avg_price)) * Decimal(str(position.quantity))) * 100

        portfolio_payload["portfolio"].append(
            {
                "symbol": position.symbol,
                "company_name": company_name,
                "market_price": round(float(price), 2),
                "quantity": int(position.quantity),
                "avg_price": float(position.avg_price),
                "unrealized_pnl": round(float(unrealized), 2),
                "unrealized_pnl_percentage": round(float(unrealized_percentage), 2),
                "net_value": round(float(price * position.quantity), 2),
            }
        )
    return jsonify(portfolio_payload)


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

    user_id = int(get_jwt_identity())
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
        exchange=quote.get("exchange", ""),
        currency=quote.get("currency", ""),
    )
    db.session.add(order)
    db.session.commit()

    return jsonify({"order": order.to_dict(), "account": _account_summary(account)})


@api.get("/orders")
@jwt_required()
def orders():
    user_id = int(get_jwt_identity())
    account = _get_account_for_user(user_id)
    orders_payload = [order.to_dict() for order in account.orders.order_by(Order.id.desc())]
    return jsonify({"orders": orders_payload})

@api.post("/sell")
@jwt_required()
def sell_stock():
    user_id = int(get_jwt_identity())
    data = request.get_json()

    symbol = data.get("symbol", "").upper()
    quantity = data.get("quantity")

    # Get reliable current price for the sale
    current_price = get_current_price(symbol)

    if current_price <= 0:
        return jsonify({"error": "Failed to get current price"}), 400

    sale_value = Decimal(str(current_price)) * Decimal(str(quantity))

    account = _get_account_for_user(user_id)
    position = account.positions.filter_by(symbol=symbol).first()
    if not position or position.quantity < quantity:
        return jsonify({"error": "Insufficient shares"}), 400

    account.cash_balance += sale_value
    position.quantity -= quantity
    if position.quantity == 0:
        db.session.delete(position)

    order = Order(
        account_id=account.id,
        symbol=symbol,
        side="SELL",
        quantity=quantity,
        price=Decimal(str(current_price)),
        status="FILLED",
    )
    db.session.add(order)
    db.session.commit()

    return jsonify({"order": order.to_dict(), "account": _account_summary(account)})


@api.get("/portfolio/breakdown/<symbol>")
@jwt_required()
def portfolio_breakdown(symbol):
    user_id = int(get_jwt_identity())
    account = _get_account_for_user(user_id)
    order_history_with_symbol: list[Order] = Order.query.filter_by(account_id=account.id, symbol=symbol).all()

    order_history_payload = []

    for order in order_history_with_symbol:
        price = get_current_price(order.symbol)
        company_name = fetch_company_name(order.symbol)
        unrealized = (Decimal(str(price)) - Decimal(str(order.price))) * Decimal(str(order.quantity))
        unrealized_percentage = unrealized / (Decimal(str(order.price)) * Decimal(str(order.quantity))) * 100
        net_value = price * order.quantity

        order_history_payload.append({
            "id": order.id,
            "created_at": order.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "symbol": order.symbol,
            "company_name": company_name,
            "market_price": round(float(price), 2),
            "quantity": int(order.quantity),
            "price": float(order.price),
            "unrealized_pnl": round(float(unrealized), 2),
            "unrealized_pnl_percentage": round(float(unrealized_percentage), 2),
            "net_value": round(float(net_value), 2),
            "stop_loss_price": float(order.stop_loss_price) if order.stop_loss_price else None,
            "take_profit_price": float(order.take_profit_price) if order.take_profit_price else None,
            "exchange": order.exchange,
            "currency": order.currency,
        })

    return jsonify({"order_history": order_history_payload})


@api.post("/portfolio/breakdown/thresholds")
@jwt_required()
def set_thresholds():
    payload = request.get_json() or {}
    order_id = int(payload.get("id"))
    order = Order.query.filter_by(id=order_id).first()
    if not order:
        return jsonify({"error": "Order not found"}), 404
    if order.side != "BUY":
        return jsonify({"error": "Order is not a buy order"}), 400
    order.stop_loss_price = Decimal(str(payload.get("stop_loss_price")))
    order.take_profit_price = Decimal(str(payload.get("take_profit_price")))
    db.session.commit()
    return jsonify({"message": "Thresholds set successfully"}), 200

@api.get("/market/status")
def market_status():
    symbol = request.args.get("symbol", "").upper()
    if not symbol:
        return jsonify({"error": "Symbol required"}), 400
    return jsonify({"market_status": is_market_open(symbol)})