import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import yfinance as yf

def _mock_price(symbol: str) -> float:
    base = 100 + (sum(ord(char) for char in symbol.upper()) % 500) / 10
    return round(base, 2)


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

def fetch_company_name(symbol: str) -> str:
    normalized_symbol = _normalize_symbol(symbol)
    info = yf.Ticker(normalized_symbol).info or {}
    return info.get("longName") or info.get("shortName") or normalized_symbol

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

    symbol = _normalize_symbol(symbol)
    ticker = yf.Ticker(symbol)
    info = ticker.info or {}
    fast_info = getattr(ticker, "fast_info", {}) or {}
    price_value = info.get("regularMarketPrice") or fast_info.get("last_price")
    previous_close_value = info.get("regularMarketPreviousClose") or fast_info.get(
        "previous_close"
    )
    if price_value is None or previous_close_value is None:
        history = ticker.history(period="5d")
        if history is not None and not history.empty:
            price_value = price_value or float(history["Close"].iloc[-1])
            previous_close_value = previous_close_value or float(history["Close"].iloc[-2])
    change_value = info.get("regularMarketChange")
    if change_value is None and price_value is not None and previous_close_value is not None:
        change_value = float(price_value) - float(previous_close_value)
    change_percent_value = info.get("regularMarketChangePercent")
    if (
        change_percent_value is None
        and change_value is not None
        and previous_close_value
    ):
        change_percent_value = (float(change_value) / float(previous_close_value)) * 100
    return {
        "symbol": symbol,
        "price": float(price_value) if price_value is not None else 0.0,
        "previous_close": float(previous_close_value) if previous_close_value is not None else 0.0,
        "change": float(change_value) if change_value is not None else 0.0,
        "change_percent": float(change_percent_value) if change_percent_value is not None else 0.0,
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

    symbol = _normalize_symbol(symbol)
    range_key = range_value.upper()
    if range_key == "1D":
        period = "1d"
        interval = "5m"
    elif range_key == "1W":
        period = "5d"
        interval = "30m"
    elif range_key == "1M":
        period = "1mo"
        interval = "1d"
    elif range_key == "3M":
        period = "3mo"
        interval = "1d"
    elif range_key == "1Y":
        period = "1y"
        interval = "1wk"
    elif range_key == "5Y":
        period = "5y"
        interval = "1wk"
    else:
        period = "1mo"
        interval = "1d"
    history = yf.Ticker(symbol).history(period=period, interval=interval)
    points = []
    if history is not None and not history.empty:
        for timestamp, row in history.iterrows():
            date_value = timestamp.date().isoformat()
            points.append({"date": date_value, "close": float(row["Close"])})
    return {"symbol": symbol.upper(), "points": points}


def fetch_basic_financials(symbol: str, metric: str) -> dict:
    if os.environ.get("MARKET_DATA_MOCK", "false").lower() == "true":
        return {
            "symbol": symbol.upper(),
            "metricType": metric,
            "metric": {},
            "series": {},
        }

    symbol = _normalize_symbol(symbol)
    info = yf.Ticker(symbol).info or {}
    metric_payload = {
        "10DayAverageTradingVolume": info.get("averageDailyVolume10Day")
        or info.get("averageVolume10days"),
        "52WeekHigh": info.get("fiftyTwoWeekHigh"),
        "52WeekLow": info.get("fiftyTwoWeekLow"),
        "52WeekLowDate": info.get("fiftyTwoWeekLowDate"),
        "52WeekPriceReturnDaily": info.get("52WeekChange"),
        "beta": info.get("beta"),
    }
    return {
        "symbol": symbol,
        "metricType": metric,
        "metric": metric_payload,
        "series": {},
    }

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

    raise ValueError("Forex symbols are not supported without market data providers.")


DEFAULT_WATCHLIST_SYMBOLS = [
    "AAPL",
    "MSFT",
    "NVDA",
    "AMZN",
    "GOOGL",
    "META",
    "BRK-B",
    "LLY",
    "AVGO",
    "JPM",
    "UNH",
    "XOM",
    "V",
    "MA",
    "COST",
    "WMT",
    "PG",
    "JNJ",
    "ORCL",
    "HD",
]


def fetch_watchlist(limit: int = 20, symbols: Optional[list[str]] = None) -> list[dict]:
    if symbols is None:
        symbols = DEFAULT_WATCHLIST_SYMBOLS[:limit]
    else:
        symbols = [_normalize_symbol(symbol) for symbol in symbols if symbol]
    items = []
    for symbol in symbols:
        normalized_symbol = _normalize_symbol(symbol)
        info = yf.Ticker(normalized_symbol).info or {}
        price = info.get("regularMarketPrice") or 0
        change_value = info.get("regularMarketChange") or 0
        range_low = info.get("fiftyTwoWeekLow") or price * 0.8
        range_high = info.get("fiftyTwoWeekHigh") or price * 1.2
        items.append(
            {
                "ticker": normalized_symbol,
                "company_name": info.get("longName") or info.get("shortName") or normalized_symbol,
                "value": float(price),
                "change_1d": float(change_value),
                "52w_range": [float(range_low), float(range_high)],
            }
        )
    return items


def fetch_company_profile(symbol: str) -> dict:
    symbol = _normalize_symbol(symbol)
    info = yf.Ticker(symbol).info or {}
    return {
        "symbol": symbol,
        "name": info.get("longName") or info.get("shortName"),
        "exchange": info.get("exchange") or info.get("fullExchangeName"),
        "industry": info.get("industry"),
        "website": info.get("website"),
    }


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