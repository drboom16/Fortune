import os
from datetime import datetime, timedelta

import requests


def _mock_price(symbol: str) -> float:
    base = 100 + (sum(ord(char) for char in symbol.upper()) % 500) / 10
    return round(base, 2)


def fetch_quote(symbol: str) -> dict:
    if os.environ.get("MARKET_DATA_MOCK", "true").lower() == "true":
        price = _mock_price(symbol)
        previous_close = round(price - 1.25, 2)
        change = round(price - previous_close, 2)
        change_percent = round(change / previous_close * 100, 2)
        return {
            "symbol": symbol.upper(),
            "price": price,
            "previous_close": previous_close,
            "change": change,
            "change_percent": change_percent,
        }

    base_url = os.environ.get("MARKET_DATA_BASE_URL")
    api_key = os.environ.get("MARKET_DATA_API_KEY")
    response = requests.get(
        f"{base_url}/quote",
        params={"symbol": symbol, "apikey": api_key},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    return {
        "symbol": symbol.upper(),
        "price": float(payload["price"]),
        "previous_close": float(payload.get("previous_close", payload["price"])),
        "change": float(payload.get("change", 0)),
        "change_percent": float(payload.get("change_percent", 0)),
    }


def fetch_chart(symbol: str, range_value: str) -> dict:
    if os.environ.get("MARKET_DATA_MOCK", "true").lower() == "true":
        points = []
        today = datetime.utcnow().date()
        days = 22 if range_value.upper() == "1M" else 5
        for index in range(days):
            date_value = today - timedelta(days=days - index)
            points.append(
                {"date": date_value.isoformat(), "close": _mock_price(symbol) + index * 0.2}
            )
        return {"symbol": symbol.upper(), "points": points}

    base_url = os.environ.get("MARKET_DATA_BASE_URL")
    api_key = os.environ.get("MARKET_DATA_API_KEY")
    response = requests.get(
        f"{base_url}/chart",
        params={"symbol": symbol, "range": range_value, "apikey": api_key},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    return {"symbol": symbol.upper(), "points": payload.get("points", [])}
