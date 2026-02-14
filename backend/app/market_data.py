import math
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import requests
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


def _safe_float(value: Any) -> Optional[float]:
    """Convert to float, return None for NaN/None/invalid. Ensures JSON-safe values."""
    if value is None:
        return None
    try:
        x = float(value)
        return None if (math.isnan(x) or math.isinf(x)) else x
    except (TypeError, ValueError):
        return None


def _get_info_value(info: dict, *keys: str, default: Any = None) -> Any:
    """Get first non-None, non-NaN value from info dict for given keys."""
    for key in keys:
        val = info.get(key)
        if val is None:
            continue
        try:
            f = float(val)
            if math.isnan(f) or math.isinf(f):
                continue
        except (TypeError, ValueError):
            pass
        return val
    return default


def fetch_company_name(symbol: str) -> str:
    normalized_symbol = _normalize_symbol(symbol)
    info = yf.Ticker(normalized_symbol).info or {}
    return info.get("longName") or info.get("shortName") or normalized_symbol


def search_stocks(query: str, max_results: int = 10) -> list[dict]:
    """Search stocks by ticker or company name. Returns list of {symbol, shortName, longName, exchange}."""
    query = (query or "").strip()
    if not query:
        return []
    try:
        if hasattr(yf, "Search"):
            search = yf.Search(query, max_results=max_results, enable_fuzzy_query=True)
            raw_quotes = search.quotes or []
        else:
            resp = requests.get(
                "https://query1.finance.yahoo.com/v1/finance/search",
                params={"q": query, "quotesCount": max_results, "enableFuzzyQuery": True},
                timeout=10,
            )
            data = resp.json() if resp.ok else {}
            raw_quotes = data.get("quotes", [])
        return [
            {
                "symbol": q.get("symbol", ""),
                "shortName": q.get("shortName") or q.get("symbol", ""),
                "longName": q.get("longName") or q.get("shortName") or q.get("symbol", ""),
                "exchange": q.get("exchange", ""),
            }
            for q in raw_quotes
            if q.get("symbol")
        ]
    except Exception:
        return []

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
    change = round(float(change_value), 2) if change_value is not None else 0.0
    change_percent = round(float(change_percent_value), 2) if change_percent_value is not None else 0.0
    return {
        "symbol": symbol,
        "price": float(price_value) if price_value is not None else 0.0,
        "previous_close": float(previous_close_value) if previous_close_value is not None else 0.0,
        "change": change,
        "change_percent": change_percent,
        "exchange": info.get("exchange") or fast_info.get("exchange"),
        "currency": info.get("currency") or fast_info.get("currency"),
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
                "value": round(float(price), 2),
                "change_1d": round(float(change_value), 2),
                "52w_range": [round(float(range_low), 2), round(float(range_high), 2)],
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


def _extract_ceo(info: dict) -> Optional[str]:
    """Extract CEO name from companyOfficers if available."""
    officers = info.get("companyOfficers")
    if not isinstance(officers, list):
        return None
    for officer in officers:
        if not isinstance(officer, dict):
            continue
        title = (officer.get("title") or "").upper()
        if "CEO" in title or "CHIEF EXECUTIVE" in title:
            return officer.get("name")
    return None


def fetch_company_snapshot(symbol: str) -> dict:
    normalized = _normalize_symbol(symbol)
    ticker = yf.Ticker(normalized)
    info = ticker.info or {}
    fast_info = getattr(ticker, "fast_info", None)
    if callable(fast_info):
        fast_info = {}
    elif fast_info is None:
        fast_info = {}

    market_state = info.get("marketState") or (fast_info.get("market_state") if isinstance(fast_info, dict) else None)
    market_status = "Market Open" if str(market_state or "").upper() == "REGULAR" else "Market Closed"

    current_price = _safe_float(_get_info_value(info, "regularMarketPrice", "currentPrice") or (fast_info.get("last_price") if isinstance(fast_info, dict) else None))
    change_absolute_raw = _safe_float(info.get("regularMarketChange"))
    change_percentage_raw = _safe_float(info.get("regularMarketChangePercent"))
    change_absolute = round(change_absolute_raw, 2) if change_absolute_raw is not None else None
    change_percentage = round(change_percentage_raw, 2) if change_percentage_raw is not None else None

    day_low = _safe_float(_get_info_value(info, "regularMarketDayLow", "dayLow"))
    day_high = _safe_float(_get_info_value(info, "regularMarketDayHigh", "dayHigh"))
    week_low = _safe_float(_get_info_value(info, "fiftyTwoWeekLow"))
    week_high = _safe_float(_get_info_value(info, "fiftyTwoWeekHigh"))

    prev_close = _safe_float(_get_info_value(info, "regularMarketPreviousClose", "previousClose"))

    market_cap = _get_info_value(info, "marketCap")
    volume_avg = _get_info_value(info, "averageVolume", "averageDailyVolume10Day")
    pe_ratio = _safe_float(_get_info_value(info, "trailingPE", "forwardPE"))
    revenue_ttm = _get_info_value(info, "totalRevenue")
    eps = _safe_float(_get_info_value(info, "trailingEps", "forwardEps"))
    dividend_yield_raw = _safe_float(_get_info_value(info, "dividendYield", "trailingAnnualDividendYield"))
    dividend_yield_pct = None
    if dividend_yield_raw is not None:
        dividend_yield_pct = dividend_yield_raw * 100 if dividend_yield_raw < 0.1 else dividend_yield_raw
    beta = _safe_float(_get_info_value(info, "beta"))
    fifty_two_week_change = _safe_float(_get_info_value(info, "52WeekChange"))

    history = ticker.history(period="5d")
    past_week_growth = None
    if history is not None and not history.empty:
        first_close = history["Close"].iloc[0]
        last_close = history["Close"].iloc[-1]
        if first_close and not (hasattr(first_close, "__float__") and math.isnan(float(first_close))):
            past_week_growth = _format_percent(((float(last_close) - float(first_close)) / float(first_close)) * 100)

    day_range_str = None
    if day_low is not None and day_high is not None:
        day_range_str = f"{day_low:.2f} - {day_high:.2f}"
    elif day_low is not None:
        day_range_str = f"{day_low:.2f} - —"
    elif day_high is not None:
        day_range_str = f"— - {day_high:.2f}"

    year_range_str = None
    if week_low is not None and week_high is not None:
        year_range_str = f"{week_low:.2f} - {week_high:.2f}"
    elif week_low is not None:
        year_range_str = f"{week_low:.2f} - —"
    elif week_high is not None:
        year_range_str = f"— - {week_high:.2f}"

    one_year_return = _format_percent(fifty_two_week_change * 100) if fifty_two_week_change is not None else None

    sector = info.get("sector") or None
    industry = info.get("industry") or None
    employees = info.get("fullTimeEmployees")
    if employees is not None:
        try:
            employees = int(employees) if not (hasattr(employees, "__float__") and math.isnan(float(employees))) else None
        except (TypeError, ValueError):
            employees = None
    ceo = _extract_ceo(info)

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
        "profile": {
            "sector": sector,
            "industry": industry,
            "ceo": ceo,
            "employees": employees,
        },
        "financials": {
            "prev_close": prev_close,
            "market_cap": _format_compact_number(market_cap),
            "day_range": day_range_str,
            "year_range": year_range_str,
            "volume_3m": _format_compact_number(volume_avg),
            "revenue": _format_compact_number(revenue_ttm),
            "eps": eps,
            "dividend_yield": dividend_yield_pct,
            "beta": beta,
            "one_year_return": one_year_return,
        },
        "upcoming_events": upcoming_event,
        "analyst_forecast": {
            "consensus": info.get("recommendationKey"),
            "price_target": _safe_float(info.get("targetMeanPrice")),
            "analyst_count": info.get("numberOfAnalystOpinions"),
        },
        "metadata": {
            "source_screenshot_date": datetime.now(timezone.utc).date().isoformat(),
            "primary_exchange": info.get("exchange") or info.get("fullExchangeName"),
        },
    }

def is_market_open(symbol: str) -> bool:
    normalized = _normalize_symbol(symbol)
    ticker = yf.Ticker(normalized)
    info = ticker.info or {}
    fast_info = getattr(ticker, "fast_info", {}) or {}
    market_state = info.get("marketState") or fast_info.get("market_state")
    return str(market_state).upper() == "REGULAR" 