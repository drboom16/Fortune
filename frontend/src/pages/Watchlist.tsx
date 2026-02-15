import { useEffect, useMemo, useState } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { TableSkeleton } from "../components/ui/table-skeleton";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";

type AiWatchlistItem = {
  ticker: string;
  company_name: string;
  value: number;
  change_1d: number;
  "52w_range": [number, number];
};

type ChartPoint = { time: number; close: number };

function MiniPriceChart({ data, positive }: { data: ChartPoint[]; positive: boolean }) {
  if (!data.length) {
    return (
      <div className="h-10 w-24 flex items-center justify-center text-[10px] text-muted-foreground">
        —
      </div>
    );
  }
  const closes = data.map((d) => d.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1 || 1)) * 100;
      const y = 100 - ((d.close - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = positive ? "rgb(16 185 129)" : "rgb(244 63 94)";
  return (
    <svg className="h-10 w-24 shrink-0" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} />
    </svg>
  );
}

export default function Watchlist() {
  const [items, setItems] = useState<AiWatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [chartDataByTicker, setChartDataByTicker] = useState<Record<string, ChartPoint[]>>({});
  const navigate = useNavigate();

  const loadWatchlist = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/market/watchlist");
      if (!response.ok) {
        setItems([]);
        setLastUpdated(new Date());
        return;
      }
      const payload = (await response.json()) as { items?: AiWatchlistItem[] };
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      setItems(nextItems);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWatchlist();
  }, []);

  useEffect(() => {
    if (items.length === 0) {
      setChartDataByTicker({});
      return;
    }
    const loadCharts = async () => {
      const results = await Promise.allSettled(
        items.map(async (item) => {
          const res = await apiFetch(`/chart/${item.ticker}?period=1mo&interval=1d`);
          if (!res.ok) return { ticker: item.ticker, data: [] };
          const json = (await res.json()) as { data?: ChartPoint[] };
          return { ticker: item.ticker, data: json.data ?? [] };
        })
      );
      const next: Record<string, ChartPoint[]> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") {
          next[r.value.ticker] = r.value.data;
        }
      });
      setChartDataByTicker(next);
    };
    void loadCharts();
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) => {
      return (
        item.ticker.toUpperCase().includes(normalized) ||
        item.company_name.toUpperCase().includes(normalized)
      );
    });
  }, [items, query]);

  const watchlistItems = useMemo(() => {
    return filteredItems.map((item) => {
      const value = Number(item.value) || 0;
      const change1d = Number(item.change_1d) || 0;
      const rangeLowValue = Number(item["52w_range"]?.[0]);
      const rangeHighValue = Number(item["52w_range"]?.[1]);
      const spread = Math.max(0.05, value * 0.0008);
      const buy = value + spread;
      const short = value - spread;
      const rangeLow = Number.isFinite(rangeLowValue) ? rangeLowValue : Math.max(0.01, value * 0.78);
      const rangeHigh = Number.isFinite(rangeHighValue) ? rangeHighValue : value * 1.22;
      const rangePosition = Math.min(
        100,
        Math.max(0, ((value - rangeLow) / (rangeHigh - rangeLow)) * 100)
      );
      return {
        ...item,
        value,
        change_1d: change1d,
        buy,
        short,
        rangeLow,
        rangeHigh,
        rangePosition
      };
    });
  }, [filteredItems]);

  const handleClick = (ticker: string) => {
    navigate(`/market/${ticker}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">My Watchlist</h1>
            </div>
          </div>
          {!watchlistItems.length && !loading && <div className="h-6 shrink-0" aria-hidden />}

          <section className="py-8 translate-y-[-32px]">
          {loading ? (
            <TableSkeleton
              columns={[
                { header: "Markets", className: "w-[22%]" },
                { header: "Change 1D", className: "text-center w-[12%]" },
                { header: "Chart", className: "text-center w-[120px]" },
                { header: "Short", className: "text-center w-[12%]" },
                { header: "Buy", className: "text-center w-[12%]" },
                { header: "52W Range", className: "text-center w-[22%]" },
              ]}
            />
          ) : watchlistItems.length ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 h-16">
                <TableHead className="w-[22%]">Markets</TableHead>
                <TableHead className="text-center w-[12%]">Change 1D</TableHead>
                <TableHead className="text-center w-[120px]">Chart</TableHead>
                <TableHead className="text-center w-[12%]">Short</TableHead>
                <TableHead className="text-center w-[12%]">Buy</TableHead>
                <TableHead className="text-center w-[22%]">52W Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlistItems.map((quote) => {
                const positive = quote.change_1d >= 0;
                const changePercent = quote.value
                  ? (quote.change_1d / quote.value) * 100
                  : 0;
                return (
                  <TableRow key={quote.ticker} onClick={() => handleClick(quote.ticker)} className="cursor-pointer">
                    <TableCell>
                      <div className="font-semibold">{quote.ticker}</div>
                      <div className="text-xs text-muted-foreground">
                        {quote.company_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div
                        className={`text-sm font-semibold ${
                          positive ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {quote.change_1d.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {positive ? "+" : ""}
                        {changePercent.toFixed(2)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-center flex justify-center">
                      <MiniPriceChart data={chartDataByTicker[quote.ticker] ?? []} positive={positive} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="rounded-full bg-muted px-4 py-2 text-sm font-semibold mx-auto">
                        {quote.short.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="rounded-full bg-muted px-4 py-2 text-sm font-semibold mx-auto">
                        {quote.buy.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-xs text-muted-foreground">
                        {quote.rangeLow.toFixed(2)} - {quote.rangeHigh.toFixed(2)}
                      </div>
                      <div className="mt-2 h-2 w-32 rounded-full bg-muted mx-auto">
                        <div
                          className="h-2 rounded-full bg-foreground"
                          style={{ width: `${quote.rangePosition}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-card text-center h-[calc(100vh-22rem)]">
            <img src="/price-timeseries.svg" alt="Price timeseries" className="h-60 w-60 pb-2" />
            <h2 className="mt-6 text-xl font-semibold">Your watchlist is empty</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Add stocks to your watchlist to see their price timeseries and get alerts when they move.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
