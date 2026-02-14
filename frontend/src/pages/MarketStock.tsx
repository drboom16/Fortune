import { useEffect, useMemo, useState } from "react";
import { Info, Minus, Plus, Search, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import StockSearchBar from "../components/ui/StockSearchBar";
import StockChart from "../components/ui/Chart";
import { LoadingSpinner } from "../components/ui/loading-spinner";
import { apiFetch } from "../lib/api";
import {
  MOCK_AAPL_DATA,
  MOCK_AAPL_CHART_DATA,
  MOCK_AAPL_CHART_DATA_BY_PERIOD,
  type AiCompanyPayload,
  type ChartData,
} from "../data/Mockdata";

const formatNum = (v: unknown): string => {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isNaN(n) ? "—" : n.toFixed(2);
};

const formatPrice = (v: unknown): string => {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isNaN(n) ? "—" : n.toFixed(2);
};

const metricLabels: Array<{ key: keyof NonNullable<AiCompanyPayload["performance_metrics"]>; label: string }> = [
  { key: "past_week_growth", label: "Past Week Growth" },
  { key: "market_cap", label: "Market Cap" },
  { key: "volume_3m_avg", label: "Avg Volume (3M)" },
  { key: "pe_ratio", label: "P/E Ratio" },
  { key: "revenue_ttm", label: "Revenue (TTM)" }
];

type WatchlistItem = {
  ticker?: string;
};

export default function MarketStock() {
  const { symbol } = useParams<{ symbol: string }>();
  const [data, setData] = useState<AiCompanyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [chartPeriod, setChartPeriod] = useState("1mo");
  const [priceAlertModalOpen, setPriceAlertModalOpen] = useState(false);
  const [customAlertPercent, setCustomAlertPercent] = useState(3.5);

  const normalizedSymbol = (symbol ?? "").trim().toUpperCase();

  const sanitizeDecimalInput = (value: string, maxDecimals: number) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    const [intPart, decPart] = sanitized.split(".");
    if (decPart === undefined) {
      return intPart;
    }
    return `${intPart}.${decPart.slice(0, maxDecimals)}`;
  };

  const loadChartData = async (period: string) => {
    if (!normalizedSymbol) return;
    
    if (normalizedSymbol === "AAPL") {
      // Use period-specific mock data
      const mockData = MOCK_AAPL_CHART_DATA_BY_PERIOD[period as keyof typeof MOCK_AAPL_CHART_DATA_BY_PERIOD];
      setChartData(mockData || MOCK_AAPL_CHART_DATA);
      return;
    }

    try {
      const periodMap: Record<string, { period: string; interval: string }> = {
        "1d": { period: "1d", interval: "5m" },
        "5d": { period: "5d", interval: "30m" },
        "1mo": { period: "1mo", interval: "1d" },
        "3mo": { period: "3mo", interval: "1d" },
        "1y": { period: "1y", interval: "1d" },
        "5y": { period: "5y", interval: "1wk" },
      };

      const { period: apiPeriod, interval } = periodMap[period] || periodMap["1mo"];
      const chartResponse = await apiFetch(
        `/chart/${normalizedSymbol}?period=${apiPeriod}&interval=${interval}`
      );
      
      if (chartResponse.ok) {
        const chartPayload = (await chartResponse.json()) as { data?: ChartData[] };
        setChartData(chartPayload.data ?? []);
      }
    } catch (err) {
      console.error("Failed to load chart data:", err);
    }
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
        setData(MOCK_AAPL_DATA);
        setChartData(MOCK_AAPL_CHART_DATA);
        setLoading(false);
      }, 500);
      return () => clearTimeout(timeout);
    }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load company data
        const response = await apiFetch(`/market/${normalizedSymbol}`);
        if (!response.ok) {
          throw new Error("Failed to load company data.");
        }

        const payload = (await response.json()) as { data?: AiCompanyPayload };
        setData(payload.data ?? null);

        // Load chart data
        await loadChartData(chartPeriod);

      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load company data or chart data.");
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
        const response = await apiFetch("/market/watchlist");
        if (!response.ok) {
          setIsInWatchlist(false);
          return;
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

  const handleChartPeriodChange = (period: string) => {
    setChartPeriod(period);
    void loadChartData(period);
  };

  const loadAccount = async () => {
    setAccountLoading(true);
    setTradeError(null);
    try {
      const response = await apiFetch("/account");
      if (!response.ok) {
        setAccountCash(null);
        setTradeError("Please log in to place orders.");
        return;
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
    setWatchlistBusy(true);
    try {
      const response = await apiFetch(
        `/market/watchlist${isInWatchlist ? `/${normalizedSymbol}` : ""}`,
        {
          method: isInWatchlist ? "DELETE" : "POST",
          body: isInWatchlist ? null : { symbol: normalizedSymbol },
        }
      );
      if (!response.ok) {
        setError("Please log in to manage your watchlist.");
        return;
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
  const changeAbsolute = quote.change_absolute != null ? Number(quote.change_absolute).toFixed(2) : undefined;
  const changePercent = quote.change_percentage != null ? Number(quote.change_percentage).toFixed(2) : undefined;
  const isPositive = (quote.change_absolute ?? 0) >= 0;
  const performance = data?.performance_metrics ?? {};
  const financials = data?.financials ?? {};
  const profile = data?.profile ?? {};
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
    setOrderBusy(true);
    try {
      const response = await apiFetch("/orders", {
        method: "POST",
        body: { symbol: normalizedSymbol, side: "BUY", quantity: shares },
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

  const handlePriceAlertClick = async (thresholdPercent: number) => {
    if (!normalizedSymbol) return;
    try {
      const res = await apiFetch("/price-alerts", {
        method: "POST",
        body: { symbol: normalizedSymbol, threshold_percent: thresholdPercent },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.alert) {
          console.log("[Price Alert] Email will be sent when threshold is reached:", data.alert);
        }
      }
    } catch (err) {
      console.error("Failed to create price alert:", err);
    }
  };

  const openPriceAlertModal = () => setPriceAlertModalOpen(true);
  const closePriceAlertModal = () => setPriceAlertModalOpen(false);

  const handleSetCustomAlert = async () => {
    await handlePriceAlertClick(customAlertPercent);
    closePriceAlertModal();
  };

  const targetPrice = priceValue ? priceValue * (1 + customAlertPercent / 100) : 0;

  return (
    <div className={`flex flex-col gap-6 ${loading || !data ? "pt-24" : "pt-48"}`}>
      <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex h-24 items-center justify-between gap-6 px-8">
          <div className="flex flex-1 items-center justify-center py-1">
            <StockSearchBar className="max-w-lg"/>
          </div>
        </div>
      </header>
      {!loading && data && (
      <section className="fixed top-24 z-20 border-b border-border/40 bg-card/95 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex items-center justify-between gap-6 px-8 py-4">
          <div className="flex items-center gap-4">
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
      )}

      {tradeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
            onClick={closeTradeModal}
            role="presentation"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-modal-content">
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

      {priceAlertModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-modal-backdrop"
            onClick={closePriceAlertModal}
            role="presentation"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl animate-modal-content">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Set Price Alert</h2>
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Info"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>
              <button
                className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={closePriceAlertModal}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-6 text-center text-base font-semibold">
              Notify me when {normalizedSymbol} moves
            </p>
            <div className="mt-6 flex w-full items-center justify-between">
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 hover:bg-muted"
                onClick={() => setCustomAlertPercent((p) => Math.max(-50, p - 0.5))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <div className="flex flex-1 items-center justify-center">
                <span className="text-2xl font-semibold tabular-nums">
                  {customAlertPercent >= 0 ? "+" : ""}{customAlertPercent}%
                </span>
              </div>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-muted/40 hover:bg-muted"
                onClick={() => setCustomAlertPercent((p) => Math.min(50, p + 0.5))}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Price: ${targetPrice.toFixed(4)}
            </p>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Current price – ${priceValue ? priceValue.toFixed(2) : "—"}
            </p>
            <button
              className="mt-6 w-full rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              onClick={handleSetCustomAlert}
            >
              Set Alert
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[calc(100vh-12rem)] w-full flex-col items-center justify-center">
          <LoadingSpinner label={normalizedSymbol} sublabel="Loading…" />
        </div>
      ) : error ? (
        <div className="flex h-[calc(100vh-12rem)] w-full flex-col items-center justify-center gap-2">
          <p className="text-sm font-medium text-rose-500">{error}</p>
        </div>
      ) : !data ? (
        <div className="flex h-[calc(100vh-12rem)] w-full flex-col items-center justify-center gap-2">
          <p className="text-sm text-muted-foreground">No company data found.</p>
        </div>
      ) : (
        <>
          {/* Chart Section - Placed prominently at the top */}
          <section className="flex flex-col gap-4">
            <StockChart 
              data={chartData} 
              symbol={normalizedSymbol}
              onPeriodChange={handleChartPeriodChange}
            />
          </section>

          {(() => {
            const quote = data.quote ?? {};
            const analyst = data.analyst_forecast ?? {};
            const metadata = data.metadata ?? {};

            return (
              <>
                <section className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between">
                    </div>
                    <div className="mt-6 grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2">
                      {metrics.length ? (
                        metrics.map((item) => (
                          <div key={item.label} className="flex items-center justify-between border-b border-border/60 pb-2">
                            <span className="text-muted-foreground">{item.label}</span>
                            <span className="font-semibold">
                              {typeof item.value === "number" ? formatNum(item.value) : String(item.value)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-muted-foreground">No metrics available.</div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Analyst Forecast</h2>
                    <div className="mt-4 grid gap-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Consensus</span>
                        <span className="font-semibold">
                          {analyst.consensus
                            ? analyst.consensus
                                .split("_")
                                .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                                .join(" ")
                            : "—"}
                        </span>
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
                      {[
                        { label: "-10%", value: -10 },
                        { label: "-5%", value: -5 },
                        { label: "+5%", value: 5 },
                        { label: "+10%", value: 10 },
                      ].map(({ label, value }) => (
                        <button
                          key={label}
                          className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                          onClick={() => handlePriceAlertClick(value)}
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                        onClick={openPriceAlertModal}
                      >
                        Custom
                      </button>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-4">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Financials</h2>
                    <div className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Prev Close</span>
                        <span className="font-semibold">{formatPrice(financials.prev_close)}</span>
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
                        <span className="font-semibold">{formatNum(performance.pe_ratio)}</span>
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
                        <span className="font-semibold">{formatNum(financials.eps)}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Dividend (Yield)</span>
                        <span className="font-semibold">{formatNum(financials.dividend_yield) !== "—" ? `${formatNum(financials.dividend_yield)}%` : "—"}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-muted-foreground">Beta</span>
                        <span className="font-semibold">{formatNum(financials.beta)}</span>
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
                </section>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}