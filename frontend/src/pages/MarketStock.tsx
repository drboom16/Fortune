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
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const metricLabels: Array<{ key: keyof NonNullable<AiCompanyPayload["performance_metrics"]>; label: string }> = [
  { key: "past_week_growth", label: "Past Week Growth" },
  { key: "market_cap", label: "Market Cap" },
  { key: "volume_3m_avg", label: "Avg Volume (3M)" },
  { key: "pe_ratio", label: "P/E Ratio" },
  { key: "revenue_ttm", label: "Revenue (TTM)" }
];

export default function MarketStock() {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<AiCompanyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const normalizedSymbol = (symbol ?? "").trim().toUpperCase();

  useEffect(() => {
    if (!normalizedSymbol) {
      setError("No symbol provided.");
      return;
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

  const metrics = useMemo(() => {
    const performance = data?.performance_metrics ?? {};
    return metricLabels
      .map((item) => ({ label: item.label, value: performance[item.key] }))
      .filter((item) => item.value !== undefined && item.value !== null);
  }, [data]);

  return (
    <div className="flex flex-col gap-6 pt-24">
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
            const performance = data.performance_metrics ?? {};
            const upcoming = data.upcoming_events ?? {};
            const analyst = data.analyst_forecast ?? {};
            const related = data.related_content ?? {};
            const metadata = data.metadata ?? {};

            return (
              <>
                <header className="flex flex-wrap items-center gap-6">
                  <div>
                    <h1 className="text-2xl font-semibold">{data.company_name ?? normalizedSymbol}</h1>
                    <p className="text-sm text-muted-foreground">
                      {data.ticker ?? normalizedSymbol}
                      {metadata.primary_exchange ? ` · ${metadata.primary_exchange}` : ""}
                      {data.market_status ? ` · ${data.market_status}` : ""}
                    </p>
                  </div>
                </header>

                <section className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-xs uppercase text-muted-foreground">Current Price</p>
                    <p className="text-lg font-semibold">{quote.current_price ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{quote.currency ?? "USD"}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-xs uppercase text-muted-foreground">Daily Change</p>
                    <p className="text-lg font-semibold">
                      {quote.change_absolute ?? "—"}
                      {quote.change_percentage !== undefined ? ` (${quote.change_percentage}%)` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{quote.trading_mode ?? "—"}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-xs uppercase text-muted-foreground">Day Range</p>
                    <p className="text-lg font-semibold">
                      {performance.day_range?.low ?? "—"} - {performance.day_range?.high ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      52W: {performance["52w_range"]?.low ?? "—"} - {performance["52w_range"]?.high ?? "—"}
                    </p>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-lg font-semibold">Performance Metrics</h2>
                    <div className="mt-4 grid gap-4">
                      {metrics.length ? (
                        metrics.map((item) => (
                          <div key={item.label} className="flex items-center justify-between border-b border-border pb-2">
                            <span className="text-sm text-muted-foreground">{item.label}</span>
                            <span className="text-sm font-semibold">{String(item.value)}</span>
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
                        <span className="font-semibold">{analyst.consensus ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Price Target</span>
                        <span className="font-semibold">{analyst.price_target ?? "—"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Analyst Count</span>
                        <span className="font-semibold">{analyst.analyst_count ?? "—"}</span>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
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
                    <h2 className="text-lg font-semibold">Related Content</h2>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {related.people_also_bought?.length ? (
                        related.people_also_bought.map((name) => (
                          <span key={name} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No related data.</span>
                      )}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-6 text-xs text-muted-foreground">
                  Source date: {metadata.source_screenshot_date ?? "—"}
                </section>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
