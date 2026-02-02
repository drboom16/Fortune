from decimal import Decimal

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)

from .ai import extract_json, query_gemini, query_openrouter_json
from .extensions import bcrypt, db
from .market_data import (
    fetch_basic_financials,
    fetch_chart,
    fetch_company_snapshot,
    fetch_company_profile,
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


@api.post("/ai/query")
def ai_query():
    payload = request.get_json() or {}
    prompt = payload.get("prompt", "").strip()
    model = payload.get("model")
    grounding = bool(payload.get("grounding", False))
    if not prompt:
        return jsonify({"error": "Prompt required"}), 400
    try:
        result = query_gemini(prompt, model=model, grounding=grounding)
        return jsonify({"response": result["text"]})
    except Exception as exc:  # pragma: no cover - surface upstream error
        return jsonify({"error": str(exc)}), 500


@api.get("/ai/company")
def ai_company():
    symbol = request.args.get("symbol", "").strip().upper()
    if not symbol:
        return jsonify({"error": "Symbol required"}), 400
    schema_example = (
        "{\n"
        '  "ticker": "NVDA",\n'
        '  "company_name": "NVIDIA Corporation",\n'
        '  "market_status": "Market Closed",\n'
        '  "quote": {\n'
        '    "current_price": 191.13,\n'
        '    "currency": "USD",\n'
        '    "change_absolute": -1.38,\n'
        '    "change_percentage": -0.72,\n'
        '    "trading_mode": "24/5 Trading"\n'
        "  },\n"
        '  "performance_metrics": {\n'
        '    "past_week_growth": "+3.88%",\n'
        '    "market_cap": "4.64T",\n'
        '    "volume_3m_avg": "181.64M",\n'
        '    "pe_ratio": 47.34,\n'
        '    "revenue_ttm": "187.14B",\n'
        '    "day_range": {\n'
        '      "low": 188.02,\n'
        '      "high": 194.17\n'
        "    },\n"
        '    "52w_range": {\n'
        '      "low": 86.50,\n'
        '      "high": 211.80\n'
        "    }\n"
        "  },\n"
        '  "upcoming_events": {\n'
        '    "event_type": "Earnings Report",\n'
        '    "fiscal_period": "Q4 2025",\n'
        '    "date": "2026-02-25",\n'
        '    "timing": "After Market Close"\n'
        "  },\n"
        '  "analyst_forecast": {\n'
        '    "consensus": "Strong Buy",\n'
        '    "price_target": 260.55,\n'
        '    "analyst_count": 37\n'
        "  },\n"
        '  "related_content": {\n'
        '    "people_also_bought": [\n'
        '      "Microsoft",\n'
        '      "Apple",\n'
        '      "Alphabet Class A",\n'
        '      "AMD",\n'
        '      "Broadcom"\n'
        "    ]\n"
        "  },\n"
        '  "metadata": {\n'
        '    "source_screenshot_date": "2026-02-02",\n'
        '    "primary_exchange": "NASDAQ"\n'
        "  }\n"
        "}\n"
    )
    system_prompt = (
        "You are a financial data assistant. Respond ONLY with valid JSON. "
        "Use the exact schema and key names below. If a value is unknown, use null. "
        "Include the word json in the output format guidance.\n\n"
        "EXAMPLE JSON OUTPUT:\n"
        f"{schema_example}"
    )
    prompt = (
        "Provide the json output for the following ticker symbol. "
        f"Ticker symbol: {symbol}"
    )
    try:
        result = query_openrouter_json(prompt=prompt, system_prompt=system_prompt)
        text = result.get("text", "")
        if not text.strip():
            return jsonify({"error": "OpenRouter returned empty content."}), 502
        data = extract_json(text)
        return jsonify({"data": data})
    except Exception as exc:  # pragma: no cover - surface upstream error
        current_app.logger.exception(
            "OpenRouter company lookup failed", extra={"symbol": symbol}
        )
        error_message = str(exc)
        if "OpenRouter error 402" in error_message:
            return jsonify({"error": "OpenRouter API balance is insufficient."}), 402
        if "OpenRouter error 429" in error_message:
            return jsonify({"error": "OpenRouter is rate-limited. Retry shortly."}), 429
        if "OpenRouter returned empty content" in error_message:
            return jsonify({"error": "OpenRouter returned empty content."}), 502
        return jsonify({"error": error_message}), 500

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
