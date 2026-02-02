import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import finnhub
import requests
import yfinance as yf

def _mock_price(symbol: str) -> float:
    base = 100 + (sum(ord(char) for char in symbol.upper()) % 500) / 10
    return round(base, 2)


def _get_market_data_config() -> Tuple[Optional[str], Optional[str], str]:
    base_url = os.environ.get("MARKET_DATA_BASE_URL") or "https://finnhub.io/api/v1"
    api_key = os.environ.get("MARKET_DATA_API_KEY")
    provider = os.environ.get("MARKET_DATA_PROVIDER", "").strip().lower()
    if not provider and base_url and "finnhub.io" in base_url:
        provider = "finnhub"
    return base_url, api_key, provider


def _get_finnhub_client() -> finnhub.Client:
    _, api_key, _ = _get_market_data_config()
    if not api_key:
        raise ValueError("MARKET_DATA_API_KEY is required for Finnhub.")
    return finnhub.Client(api_key=api_key)


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _format_compact_number(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    abs_number = abs(number)
    if abs_number >= 1_000_000_000_000:
        return f"{number / 1_000_000_000_000:.2f}T"
    if abs_number >= 1_000_000_000:
        return f"{number / 1_000_000_000:.2f}B"
    if abs_number >= 1_000_000:
        return f"{number / 1_000_000:.2f}M"
    if abs_number >= 1_000:
        return f"{number / 1_000:.2f}K"
    return f"{number:.2f}"


def _format_percent(value: Optional[float]) -> Optional[str]:
    if value is None:
        return None
    try:
        return f"{float(value):+.2f}%"
    except (TypeError, ValueError):
        return None


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
    if os.environ.get("MARKET_DATA_MOCK", "false").lower() == "true":
        symbol = _normalize_symbol(symbol)
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
    symbol = _normalize_symbol(symbol)
    if provider == "finnhub":
        payload = _get_finnhub_client().quote(symbol)
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
        "symbol": symbol,
        "price": float(payload["price"]),
        "previous_close": float(payload.get("previous_close", payload["price"])),
        "change": float(payload.get("change", 0)),
        "change_percent": float(payload.get("change_percent", 0)),
    }


def fetch_chart(symbol: str, range_value: str) -> dict:
    if os.environ.get("MARKET_DATA_MOCK", "false").lower() == "true":
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
    if os.environ.get("MARKET_DATA_MOCK", "false").lower() == "true":
        return {
            "symbol": symbol.upper(),
            "metricType": metric,
            "metric": {},
            "series": {},
        }

    base_url, api_key, provider = _get_market_data_config()
    if provider == "finnhub":
        symbol = _normalize_symbol(symbol)
        client = _get_finnhub_client()
        return client.company_basic_financials(symbol, metric)

    response = requests.get(
        f"{base_url}/stock/metric",
        params={"symbol": symbol, "metric": metric, "apikey": api_key},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()

def fetch_forex_symbols(exchange: str) -> list:
    if os.environ.get("MARKET_DATA_MOCK", "false").lower() == "true":
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


def fetch_watchlist(limit: int = 20) -> list[dict]:
    base_url, api_key, provider = _get_market_data_config()
    if provider != "finnhub":
        raise ValueError("Watchlist is only supported with the Finnhub provider.")
    if not base_url:
        raise ValueError("MARKET_DATA_BASE_URL is required.")

    finnhub_client = _get_finnhub_client()
    response = requests.get(
        f"{base_url}/index/constituents",
        params={"symbol": "^GSPC", "token": api_key},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    symbols = [symbol for symbol in payload.get("constituents", []) if symbol][:limit]

    items = []
    for symbol in symbols:
        normalized_symbol = _normalize_symbol(symbol)
        quote_payload = finnhub_client.quote(normalized_symbol)
        price_value = quote_payload.get("c") or 0
        change_value = quote_payload.get("d") or 0

        profile_response = requests.get(
            f"{base_url}/stock/profile2",
            params={"symbol": normalized_symbol, "token": api_key},
            timeout=10,
        )
        profile_response.raise_for_status()
        profile = profile_response.json()

        metrics = fetch_basic_financials(normalized_symbol, "all")
        metric = metrics.get("metric", {})
        range_low = metric.get("52WeekLow") or 0
        range_high = metric.get("52WeekHigh") or 0
        price = float(price_value)
        if not range_low:
            range_low = price * 0.8
        if not range_high:
            range_high = price * 1.2

        items.append(
            {
                "ticker": normalized_symbol,
                "company_name": profile.get("name") or normalized_symbol,
                "value": price,
                "change_1d": float(change_value),
                "52w_range": [float(range_low), float(range_high)],
            }
        )
    return items


def fetch_company_profile(symbol: str) -> dict:
    base_url, api_key, provider = _get_market_data_config()
    symbol = _normalize_symbol(symbol)
    if provider == "finnhub":
        return _get_finnhub_client().company_profile2(symbol=symbol)
    response = requests.get(
        f"{base_url}/stock/profile2",
        params={"symbol": symbol, "apikey": api_key},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def fetch_company_snapshot(symbol: str) -> dict:
    normalized = _normalize_symbol(symbol)
    ticker = yf.Ticker(normalized)
    info = ticker.info or {}
    fast_info = getattr(ticker, "fast_info", {}) or {}

    market_state = info.get("marketState") or fast_info.get("market_state")
    market_status = "Market Open" if str(market_state).upper() == "REGULAR" else "Market Closed"

    current_price = info.get("regularMarketPrice") or fast_info.get("last_price")
    change_absolute = info.get("regularMarketChange")
    change_percentage = info.get("regularMarketChangePercent")

    day_low = info.get("regularMarketDayLow")
    day_high = info.get("regularMarketDayHigh")
    week_low = info.get("fiftyTwoWeekLow")
    week_high = info.get("fiftyTwoWeekHigh")

    market_cap = info.get("marketCap")
    volume_avg = info.get("averageVolume")
    pe_ratio = info.get("trailingPE") or info.get("forwardPE")
    revenue_ttm = info.get("totalRevenue")

    history = ticker.history(period="5d")
    past_week_growth = None
    if history is not None and not history.empty:
        first_close = history["Close"].iloc[0]
        last_close = history["Close"].iloc[-1]
        if first_close:
            past_week_growth = _format_percent(((last_close - first_close) / first_close) * 100)

    upcoming_event = {
        "event_type": None,
        "fiscal_period": None,
        "date": None,
        "timing": None,
    }
    calendar = getattr(ticker, "calendar", None)
    if calendar is not None:
        try:
            if hasattr(calendar, "empty") and not calendar.empty:
                earnings = calendar.get("Earnings Date")
                if earnings is not None and len(earnings):
                    upcoming_event["event_type"] = "Earnings Report"
                    upcoming_event["date"] = earnings[0].strftime("%Y-%m-%d")
            elif isinstance(calendar, dict):
                earnings = calendar.get("Earnings Date")
                if earnings:
                    upcoming_event["event_type"] = "Earnings Report"
                    if hasattr(earnings, "strftime"):
                        upcoming_event["date"] = earnings.strftime("%Y-%m-%d")
        except Exception:
            pass

    return {
        "ticker": normalized,
        "company_name": info.get("longName") or info.get("shortName") or normalized,
        "market_status": market_status,
        "quote": {
            "current_price": current_price,
            "currency": info.get("currency") or "USD",
            "change_absolute": change_absolute,
            "change_percentage": change_percentage,
            "trading_mode": str(market_state).title() if market_state else None,
        },
        "performance_metrics": {
            "past_week_growth": past_week_growth,
            "market_cap": _format_compact_number(market_cap),
            "volume_3m_avg": _format_compact_number(volume_avg),
            "pe_ratio": pe_ratio,
            "revenue_ttm": _format_compact_number(revenue_ttm),
            "day_range": {"low": day_low, "high": day_high},
            "52w_range": {"low": week_low, "high": week_high},
        },
        "upcoming_events": upcoming_event,
        "analyst_forecast": {
            "consensus": info.get("recommendationKey"),
            "price_target": info.get("targetMeanPrice"),
            "analyst_count": info.get("numberOfAnalystOpinions"),
        },
        "related_content": {"people_also_bought": []},
        "metadata": {
            "source_screenshot_date": datetime.now(timezone.utc).date().isoformat(),
            "primary_exchange": info.get("exchange") or info.get("fullExchangeName"),
        },
    }
