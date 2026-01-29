import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import requests


def _mock_price(symbol: str) -> float:
    base = 100 + (sum(ord(char) for char in symbol.upper()) % 500) / 10
    return round(base, 2)


def _get_market_data_config() -> Tuple[Optional[str], Optional[str], str]:
    base_url = os.environ.get("MARKET_DATA_BASE_URL")
    api_key = os.environ.get("MARKET_DATA_API_KEY")
    provider = os.environ.get("MARKET_DATA_PROVIDER", "").strip().lower()
    if not provider and base_url and "finnhub.io" in base_url:
        provider = "finnhub"
    return base_url, api_key, provider


def _finnhub_chart_window(range_value: str) -> tuple[str, int, int]:
    now = datetime.now(timezone.utc)
    range_key = range_value.upper()
    if range_key == "1D":
        resolution = "5"
        start = now - timedelta(days=1)
    elif range_key == "1W":
        resolution = "30"
        start = now - timedelta(days=7)
    elif range_key == "1M":
        resolution = "D"
        start = now - timedelta(days=30)
    elif range_key == "3M":
        resolution = "D"
        start = now - timedelta(days=90)
    elif range_key == "1Y":
        resolution = "W"
        start = now - timedelta(days=365)
    elif range_key == "5Y":
        resolution = "W"
        start = now - timedelta(days=365 * 5)
    else:
        resolution = "D"
        start = now - timedelta(days=30)
    return resolution, int(start.timestamp()), int(now.timestamp())


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

    base_url, api_key, provider = _get_market_data_config()
    if provider == "finnhub":
        response = requests.get(
            f"{base_url}/quote",
            params={"symbol": symbol, "token": api_key},
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        price_value = payload.get("c") or 0
        previous_close_value = payload.get("pc") or price_value
        change_value = payload.get("d") or 0
        change_percent_value = payload.get("dp") or 0
        return {
            "symbol": symbol.upper(),
            "price": float(price_value),
            "previous_close": float(previous_close_value),
            "change": float(change_value),
            "change_percent": float(change_percent_value),
        }

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

    base_url, api_key, provider = _get_market_data_config()
    if provider == "finnhub":
        resolution, start_ts, end_ts = _finnhub_chart_window(range_value)
        response = requests.get(
            f"{base_url}/stock/candle",
            params={
                "symbol": symbol,
                "resolution": resolution,
                "from": start_ts,
                "to": end_ts,
                "token": api_key,
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        points = []
        if payload.get("s") == "ok":
            for timestamp, close in zip(payload.get("t", []), payload.get("c", [])):
                date_value = datetime.fromtimestamp(timestamp, tz=timezone.utc).date()
                points.append({"date": date_value.isoformat(), "close": float(close)})
        return {"symbol": symbol.upper(), "points": points}

    response = requests.get(
        f"{base_url}/chart",
        params={"symbol": symbol, "range": range_value, "apikey": api_key},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    return {"symbol": symbol.upper(), "points": payload.get("points", [])}


def fetch_basic_financials(symbol: str, metric: str) -> dict:
    if os.environ.get("MARKET_DATA_MOCK", "true").lower() == "true":
        return {
            "symbol": symbol.upper(),
            "metricType": metric,
            "metric": {},
            "series": {},
        }

    base_url, api_key, provider = _get_market_data_config()
    if provider == "finnhub":
        response = requests.get(
            f"{base_url}/stock/metric",
            params={"symbol": symbol, "metric": metric, "token": api_key},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    response = requests.get(
        f"{base_url}/stock/metric",
        params={"symbol": symbol, "metric": metric, "apikey": api_key},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()

def fetch_forex_symbols(exchange: str) -> list:
    if os.environ.get("MARKET_DATA_MOCK", "true").lower() == "true":
        return [
            {
                "description": "IC MARKETS Euro vs US Dollar EURUSD",
                "displaySymbol": "EUR/USD",
                "symbol": "IC MARKETS:1"
            },
            {
                "description": "IC MARKETS Australian vs US Dollar AUDUSD",
                "displaySymbol": "AUD/USD",
                "symbol": "IC MARKETS:5"
            },
            {
                "description": "IC MARKETS British Pound vs US Dollar GBPUSD",
                "displaySymbol": "GBP/USD",
                "symbol": "IC MARKETS:2"
            }]

    base_url, api_key, provider = _get_market_data_config();
    if provider == "finnhub":
        response = requests.get(
            f"{base_url}/forex/symbol",
            params={"exchange": exchange, "token": api_key},
            timeout=10
        )
        response.raise_for_status()
        return response.json()

    response = requests.get(
        f"{base_url}/forex/symbol",
        params={"exchange": exchange, "api_key": api_key},
        timeout=10
    )
    response.raise_for_status()
    return response.json()
