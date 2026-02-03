import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

type AiCompanyPayload = {
  ticker?: string;
  company_name?: string;
  market_status?: string;
  quote?: {
    current_price?: number;
    currency?: string;
    change_absolute?: number;
    change_percentage?: number;
    trading_mode?: string;
  };
  performance_metrics?: {
    past_week_growth?: string;
    market_cap?: string;
    volume_3m_avg?: string;
    pe_ratio?: number;
    revenue_ttm?: string;
    day_range?: {
      low?: number;
      high?: number;
    };
    "52w_range"?: {
      low?: number;
      high?: number;
    };
  };
  upcoming_events?: {
    event_type?: string;
    fiscal_period?: string;
    date?: string;
    timing?: string;
  };
  analyst_forecast?: {
    consensus?: string;
    price_target?: number;
    analyst_count?: number;
  };
  related_content?: {
    people_also_bought?: string[];
  };
  metadata?: {
    source_screenshot_date?: string;
    primary_exchange?: string;
  };
  profile?: {
    sector?: string;
    industry?: string;
    ceo?: string;
    employees?: number;
  };
  financials?: {
    prev_close?: number;
    eps?: number;
    one_year_return?: string;
    dividend_yield?: string;
    beta?: number;
    market_cap?: string;
    day_range?: string;
    year_range?: string;
    volume_3m?: string;
    revenue?: string;
  };
  latest_news?: Array<{ title: string; source: string; time: string }>;
  related_companies?: Array<{ ticker: string; name: string; change: string }>;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const getAccessToken = () => {
  const token = localStorage.getItem("access_token");
  if (!token || token === "null" || token === "undefined") {
    return null;
  }
  return token;
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken || refreshToken === "null" || refreshToken === "undefined") {
    return null;
  }
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${refreshToken}` }
  });
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { access_token?: string };
  if (payload.access_token) {
    localStorage.setItem("access_token", payload.access_token);
    return payload.access_token;
  }
  return null;
};

const metricLabels: Array<{ key: keyof NonNullable<AiCompanyPayload["performance_metrics"]>; label: string }> = [
  { key: "past_week_growth", label: "Past Week Growth" },
  { key: "market_cap", label: "Market Cap" },
  { key: "volume_3m_avg", label: "Avg Volume (3M)" },
  { key: "pe_ratio", label: "P/E Ratio" },
  { key: "revenue_ttm", label: "Revenue (TTM)" }
];

const MOCK_AAPL: AiCompanyPayload = {
  ticker: "AAPL",
  company_name: "Apple Inc.",
  market_status: "Market Open",
  quote: {
    current_price: 191.24,
    currency: "USD",
    change_absolute: 1.18,
    change_percentage: 0.62,
    trading_mode: "24/5 Trading"
  },
  performance_metrics: {
    past_week_growth: "+2.14%",
    market_cap: "2.98T",
    volume_3m_avg: "58.21M",
    pe_ratio: 28.41,
    revenue_ttm: "382.49B",
    day_range: { low: 188.72, high: 192.84 },
    "52w_range": { low: 164.08, high: 199.62 }
  },
  upcoming_events: {
    event_type: "Earnings Report",
    fiscal_period: "Q1 2026",
    date: "2026-02-28",
    timing: "After Market Close"
  },
  analyst_forecast: {
    consensus: "Moderate Buy",
    price_target: 214.35,
    analyst_count: 41
  },
  related_content: {
    people_also_bought: ["Microsoft", "Alphabet Class A", "NVIDIA", "Amazon", "Meta"]
  },
  metadata: {
    source_screenshot_date: "2026-02-02",
    primary_exchange: "NASDAQ"
  },
  profile: {
    sector: "Technology",
    industry: "Consumer Electronics",
    ceo: "Tim Cook",
    employees: 161000
  },
  financials: {
    prev_close: 190.06,
    eps: 6.42,
    one_year_return: "+18.6%",
    dividend_yield: "0.52% (0.96)",
    beta: 1.25,
    market_cap: "2.98T",
    day_range: "188.72 - 192.84",
    year_range: "164.08 - 199.62",
    volume_3m: "58.21M",
    revenue: "382.49B"
  },
  latest_news: [
    { title: "Apple unveils new AI tools for creators", source: "Reuters", time: "2h ago" },
    { title: "iPhone demand stays resilient in Q1", source: "Bloomberg", time: "6h ago" },
    { title: "Apple services revenue hits record", source: "WSJ", time: "1d ago" }
  ],
  related_companies: [
    { ticker: "GOOG", name: "Alphabet", change: "-2.36%" },
    { ticker: "MSFT", name: "Microsoft", change: "-1.78%" },
    { ticker: "AMZN", name: "Amazon", change: "-1.80%" },
    { ticker: "NKE", name: "Nike", change: "-1.44%" },
    { ticker: "TSLA", name: "Tesla", change: "-2.70%" }
  ]
};

type WatchlistItem = {
  ticker?: string;
};

export default function MarketStock() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AiCompanyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [watchlistBusy, setWatchlistBusy] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [amountMode, setAmountMode] = useState<"amount" | "shares">("amount");
  const [amountInput, setAmountInput] = useState("0.00");
  const [sharesInput, setSharesInput] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [accountCash, setAccountCash] = useState<number | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [orderBusy, setOrderBusy] = useState(false);

  const normalizedSymbol = (symbol ?? "").trim().toUpperCase();

  const sanitizeDecimalInput = (value: string, maxDecimals: number) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    const [intPart, decPart] = sanitized.split(".");
    if (decPart === undefined) {
      return intPart;
    }
    return `${intPart}.${decPart.slice(0, maxDecimals)}`;
  };

  useEffect(() => {
    if (!normalizedSymbol) {
      setError("No symbol provided.");
      return;
    }
    if (normalizedSymbol === "AAPL") {
      setLoading(true);
      setError(null);
      const timeout = setTimeout(() => {
        setData(MOCK_AAPL);
        setLoading(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/market/${normalizedSymbol}`);
        if (!response.ok) {
          throw new Error("Failed to load company data.");
        }
        const payload = (await response.json()) as { data?: AiCompanyPayload };
        setData(payload.data ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load company data.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [normalizedSymbol]);

  useEffect(() => {
    if (!normalizedSymbol) {
      setIsInWatchlist(false);
      return;
    }
    const loadStatus = async () => {
      try {
        const token = getAccessToken();
        if (!token) {
          setIsInWatchlist(false);
          return;
        }
        let response = await fetch(`${API_BASE_URL}/market/watchlist`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.status === 401 || response.status === 422) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            setIsInWatchlist(false);
            return;
          }
          response = await fetch(`${API_BASE_URL}/market/watchlist`, {
            headers: { Authorization: `Bearer ${refreshed}` }
          });
        }
        if (!response.ok) {
          throw new Error("Failed to load watchlist.");
        }
        const payload = (await response.json()) as { items?: WatchlistItem[] };
        const items = Array.isArray(payload.items) ? payload.items : [];
        const inWatchlist = items.some(
          (item) => (item.ticker ?? "").toUpperCase() === normalizedSymbol
        );
        setIsInWatchlist(inWatchlist);
      } catch {
        setIsInWatchlist(false);
      }
    };
    void loadStatus();
  }, [normalizedSymbol]);

  const ensureAccessToken = async () => {
    const token = getAccessToken();
    if (token) {
      return token;
    }
    return await refreshAccessToken();
  };

  const loadAccount = async () => {
    setAccountLoading(true);
    setTradeError(null);
    try {
      const token = await ensureAccessToken();
      if (!token) {
        setAccountCash(null);
        setTradeError("Please log in to place orders.");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/account`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error("Unable to load account balance.");
      }
      const payload = (await response.json()) as { account?: { cash_balance?: number } };
      setAccountCash(payload.account?.cash_balance ?? 0);
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Unable to load account balance.");
    } finally {
      setAccountLoading(false);
    }
  };

  const handleWatchlistToggle = async () => {
    if (!normalizedSymbol || watchlistBusy) {
      return;
    }
    let token = getAccessToken();
    if (!token) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        setError("Please log in to manage your watchlist.");
        return;
      }
      token = refreshed;
    }
    setWatchlistBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/market/watchlist${isInWatchlist ? `/${normalizedSymbol}` : ""}`,
        {
          method: isInWatchlist ? "DELETE" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(isInWatchlist ? {} : { "Content-Type": "application/json" })
          },
          body: isInWatchlist ? undefined : JSON.stringify({ symbol: normalizedSymbol })
        }
      );
      if (response.status === 401 || response.status === 422) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
          setError("Please log in to manage your watchlist.");
          return;
        }
        const retryResponse = await fetch(
          `${API_BASE_URL}/market/watchlist${isInWatchlist ? `/${normalizedSymbol}` : ""}`,
          {
            method: isInWatchlist ? "DELETE" : "POST",
            headers: {
              Authorization: `Bearer ${refreshed}`,
              ...(isInWatchlist ? {} : { "Content-Type": "application/json" })
            },
            body: isInWatchlist ? undefined : JSON.stringify({ symbol: normalizedSymbol })
          }
        );
        if (!retryResponse.ok) {
          throw new Error("Failed to update watchlist.");
        }
        const retryPayload = (await retryResponse.json()) as { items?: WatchlistItem[] };
        const retryItems = Array.isArray(retryPayload.items) ? retryPayload.items : [];
        setIsInWatchlist(
          retryItems.some((item) => (item.ticker ?? "").toUpperCase() === normalizedSymbol)
        );
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to update watchlist.");
      }
      const payload = (await response.json()) as { items?: WatchlistItem[] };
      const items = Array.isArray(payload.items) ? payload.items : [];
      setIsInWatchlist(
        items.some((item) => (item.ticker ?? "").toUpperCase() === normalizedSymbol)
      );
    } finally {
      setWatchlistBusy(false);
    }
  };

  const metrics = useMemo(() => {
    const performance = data?.performance_metrics ?? {};
    return metricLabels
      .map((item) => ({ label: item.label, value: performance[item.key] }))
      .filter((item) => item.value !== undefined && item.value !== null);
  }, [data]);

  const quote = data?.quote ?? {};
  const changeAbsolute = quote.change_absolute;
  const changePercent = quote.change_percentage?.toFixed(2);
  const isPositive = (changeAbsolute ?? 0) >= 0;
  const performance = data?.performance_metrics ?? {};
  const financials = data?.financials ?? {};
  const profile = data?.profile ?? {};
  const latestNews = data?.latest_news ?? [];
  const relatedCompanies = data?.related_companies ?? [];
  const priceValue = Number(quote.current_price) || 0;

  const handleAmountChange = (value: string) => {
    const nextValue = sanitizeDecimalInput(value, 2);
    setAmountInput(nextValue);
    if (!priceValue) {
      setSharesInput("");
      return;
    }
    const numeric = Number(nextValue || 0);
    setSharesInput((numeric / priceValue).toFixed(2));
  };

  const handleSharesChange = (value: string) => {
    const nextValue = sanitizeDecimalInput(value, 2);
    setSharesInput(nextValue);
    if (!priceValue) {
      setAmountInput("0.00");
      return;
    }
    const numeric = Number(nextValue || 0);
    setAmountInput((numeric * priceValue).toFixed(2));
  };

  const openTradeModal = () => {
    setTradeError(null);
    setTradeOpen(true);
    if (amountMode === "amount") {
      handleAmountChange(amountInput || "0");
    } else {
      handleSharesChange(sharesInput || "0");
    }
    void loadAccount();
  };

  const closeTradeModal = () => {
    setTradeOpen(false);
    setOrderBusy(false);
    setTradeError(null);
  };

  const handlePlaceOrder = async () => {
    setTradeError(null);
    if (!normalizedSymbol) {
      setTradeError("No symbol selected.");
      return;
    }
    if (!priceValue) {
      setTradeError("Market price unavailable.");
      return;
    }
    if (orderType === "limit") {
      setTradeError("Limit orders are not supported yet.");
      return;
    }
    const shares = Number(sharesInput || 0);
    if (!shares || shares <= 0) {
      setTradeError("Enter a valid amount.");
      return;
    }
    if (!Number.isInteger(shares)) {
      setTradeError("Fractional shares are not supported yet.");
      return;
    }
    const token = await ensureAccessToken();
    if (!token) {
      setTradeError("Please log in to place orders.");
      return;
    }
    setOrderBusy(true);
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          symbol: normalizedSymbol,
          side: "BUY",
          quantity: shares
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Order failed.");
      }
      closeTradeModal();
      void loadAccount();
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Unable to place order.");
    } finally {
      setOrderBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pt-48">
      <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex h-24 items-center justify-between gap-6 px-8">
          <div className="flex flex-1 items-center justify-center py-1">
            <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const nextSymbol = query.trim();
                  if (nextSymbol) {
                    navigate(`/market/${nextSymbol.toLowerCase()}`);
                  }
                }}
              >
                <input
                  className="h-12 w-full rounded-full border border-border bg-card px-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </form>
            </div>
          </div>
        </div>
      </header>
      <section className="fixed top-24 z-20 border-b border-border/40 bg-card/95 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex items-center justify-between gap-6 px-8 py-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-muted" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{data?.ticker ?? normalizedSymbol}</span>
              <span className="text-xs text-muted-foreground">
                {data?.company_name ?? "Company name"}
              </span>
              <span className="text-xs text-muted-foreground">
                {data?.market_status ?? "Market status"}
              </span>
            </div>
            <div className="ml-6 flex flex-col">
              <span className="text-lg font-semibold">
                {quote.current_price ?? "—"}
              </span>
              <span
                className={`text-xs font-semibold ${
                  isPositive ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {changeAbsolute !== undefined ? `${isPositive ? "+" : ""}${changeAbsolute}` : "—"}{" "}
                {changePercent !== undefined ? `(${isPositive ? "+" : ""}${changePercent}%)` : ""}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
              disabled={watchlistBusy || !normalizedSymbol}
              onClick={handleWatchlistToggle}
            >
              {isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
            </button>
            <button
              className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background"
              onClick={openTradeModal}
            >
              Trade
            </button>
          </div>
        </div>
      </section>

      {tradeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeTradeModal}
            role="presentation"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  className={`rounded-full px-4 py-1 text-sm font-semibold transition-all duration-300 ${
                    amountMode === "amount"
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground"
                  }`}
                  onClick={() => {
                    setAmountMode("amount");
                    handleAmountChange(amountInput || "0");
                  }}
                >
                  Amount
                </button>
                <button
                  className={`rounded-full px-4 py-1 text-sm font-semibold transition-all duration-300 ${
                    amountMode === "shares"
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground"
                  }`}
                  onClick={() => {
                    setAmountMode("shares");
                    handleSharesChange(sharesInput || "0");
                  }}
                >
                  Shares
                </button>
              </div>
              <button
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={closeTradeModal}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col w-full">
              {/* The Visual Container */}
              <div className="mt-6 rounded-xl border border-border bg-muted/40 px-4 py-3 flex items-center w-full focus-within:ring-1 focus-within:ring-primary transition-all">
                
                <span className="text-xs uppercase tracking-wide text-muted-foreground select-none whitespace-nowrap mr-4">
                  {amountMode === "amount" ? "AMOUNT($)" : "SHARES"}
                </span>

                <div className="flex items-center flex-1 justify-end">
                  <input
                    className="bg-transparent text-sm font-semibold outline-none text-right w-full h-full cursor-text"
                    value={amountMode === "amount" ? amountInput : sharesInput}
                    onChange={(event) => {
                      amountMode === "amount" 
                        ? handleAmountChange(event.target.value) 
                        : handleSharesChange(event.target.value);
                    }}
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Stock</div>
                  <div className="font-semibold">{normalizedSymbol || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Market Price</div>
                  <div className="font-semibold">
                    {priceValue ? `$${priceValue.toFixed(2)}` : "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 ease-in-out duration-300">
                <button
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${
                    orderType === "market"
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground"
                  }`}
                  onClick={() => setOrderType("market")}
                >
                  Market
                </button>
                <button
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold ${
                    orderType === "limit"
                      ? "bg-foreground text-background"
                      : "border border-border text-muted-foreground"
                  }`}
                  onClick={() => setOrderType("limit")}
                >
                  Limit
                </button>
              </div>
              {orderType === "limit" ? (
                <div className="rounded-xl border border-border px-4 py-3 text-sm">
                  <div className="text-xs text-muted-foreground">Limit Price</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <input
                      className="w-full bg-transparent text-sm font-semibold outline-none"
                      value={limitPrice}
                      onChange={(event) => setLimitPrice(sanitizeDecimalInput(event.target.value, 2))}
                      inputMode="decimal"
                    />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>Available USD</span>
              <span>
                {accountLoading ? "Loading..." : `$${(accountCash ?? 0).toFixed(2)}`}
              </span>
            </div>
            {tradeError ? <div className="mt-3 text-sm text-rose-500">{tradeError}</div> : null}

            <button
              className="mt-6 w-full rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background disabled:opacity-60"
              disabled={orderBusy || accountLoading}
              onClick={handlePlaceOrder}
            >
              {orderBusy ? "Placing Order..." : "Buy"}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading company data…</div>
      ) : error ? (
        <div className="text-sm text-rose-500">{error}</div>
      ) : !data ? (
        <div className="text-sm text-muted-foreground">No company data found.</div>
      ) : (
        <>
          {(() => {
            const quote = data.quote ?? {};
            const upcoming = data.upcoming_events ?? {};
            const analyst = data.analyst_forecast ?? {};
            const metadata = data.metadata ?? {};

            return (
              <>
                <section className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold">Price Performance</h2>
                      <button className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        Full Trading View
                      </button>
                    </div>
                    <div className="mt-4 h-56 rounded-xl bg-muted/60" />
                    <div className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                      {metrics.length ? (
                        metrics.map((item) => (
                          <div key={item.label} className="flex items-center justify-between border-b border-border/60 pb-2">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-semibold">{String(item.value)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No metrics available.</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Upcoming Events</h2>
                    <div className="mt-4 grid gap-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Event</span>
                        <span className="font-semibold">{upcoming.event_type ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Fiscal Period</span>
                        <span className="font-semibold">{upcoming.fiscal_period ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-semibold">{upcoming.date ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Timing</span>
                        <span className="font-semibold">{upcoming.timing ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Analyst Forecast</h2>
                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Consensus</span>
                        <span className="font-semibold">{analyst.consensus ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Price Target</span>
                        <span className="font-semibold">{analyst.price_target?.toFixed(2) ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Analyst Count</span>
                        <span className="font-semibold">{analyst.analyst_count ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Price Alert</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Price alerts notify you when the asset hits a target you set.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {["-10%", "-5%", "+5%", "+10%", "Custom"].map((label) => (
                        <button
                          key={label}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">People Also Bought</h2>
                    <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      {relatedCompanies.length ? (
                        relatedCompanies.map((item) => (
                          <div key={item.ticker} className="flex items-center justify-between text-sm">
                            <div>
                              <div className="font-semibold">{item.ticker}</div>
                              <div className="text-xs text-muted-foreground">{item.name}</div>
                            </div>
                            <div className="text-xs text-rose-500">{item.change}</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No related data.</div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Financials</h2>
                    <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Prev Close</span>
                        <span className="font-semibold">{financials.prev_close ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Market Cap</span>
                        <span className="font-semibold">{financials.market_cap ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Day's Range</span>
                        <span className="font-semibold">{financials.day_range ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">P/E Ratio</span>
                        <span className="font-semibold">{Number(performance.pe_ratio)?.toFixed(2) ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">52W Range</span>
                        <span className="font-semibold">{financials.year_range ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Revenue</span>
                        <span className="font-semibold">{financials.revenue ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Volume (3M)</span>
                        <span className="font-semibold">{financials.volume_3m ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">EPS</span>
                        <span className="font-semibold">{Number(financials.eps)?.toFixed(2) ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Dividend (Yield)</span>
                        <span className="font-semibold">{Number(financials.dividend_yield)?.toFixed(2) ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Beta</span>
                        <span className="font-semibold">{Number(financials.beta)?.toFixed(2) ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">1 Year Return</span>
                        <span className="font-semibold">{financials.one_year_return ?? "—"}</span>
                      </div>
                    </div>
                    <div className="mt-8 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Sector</span>
                        <span className="font-semibold">{profile.sector ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Industry</span>
                        <span className="font-semibold">{profile.industry ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">CEO</span>
                        <span className="font-semibold">{profile.ceo ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Employees</span>
                        <span className="font-semibold">{profile.employees ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Latest News</h2>
                    <div className="mt-4 grid gap-3">
                      {latestNews.length ? (
                        latestNews.map((item) => (
                          <div key={item.title} className="border-b border-border/60 pb-3 text-sm">
                            <div className="font-semibold">{item.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.source} · {item.time}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No news available.</div>
                      )}
                    </div>
                  </div>
                </section>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
