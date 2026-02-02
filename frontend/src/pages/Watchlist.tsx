import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useNavigate } from "react-router-dom";

type AiWatchlistItem = {
  ticker: string;
  company_name: string;
  value: number;
  change_1d: number;
  "52w_range": [number, number];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export default function Watchlist() {
  const [items, setItems] = useState<AiWatchlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalised = query.trim();
    if (!normalised) {
      return;
    }  
    navigate(`/market/${normalised.toLowerCase()}`);
  }

  const loadWatchlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/market/watchlist`);
      if (!response.ok) {
        throw new Error("Failed to fetch watchlist.");
      }
      const payload = (await response.json()) as { items?: AiWatchlistItem[] };
      const nextItems = Array.isArray(payload.items) ? payload.items : [];
      if (!nextItems.length) {
        throw new Error("No watchlist items returned.");
      }
      setItems(nextItems);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load watchlist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadWatchlist();
  }, []);

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

  const renderSparkline = (symbol: string, positive: boolean) => {
    const points = Array.from({ length: 14 }).map((_, index) => {
      const seed = symbol
        .split("")
        .reduce((total, char) => total + char.charCodeAt(0), 0);
      const value = Math.sin(index + seed) * 10 + (positive ? 40 : 30);
      return value;
    });
    const max = Math.max(...points);
    const min = Math.min(...points);
    const normalized = points
      .map((value, index) => {
        const x = (index / (points.length - 1)) * 100;
        const y = 100 - ((value - min) / (max - min || 1)) * 100;
        return `${x},${y}`;
      })
      .join(" ");
    return (
      <svg className="h-10 w-24" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke={positive ? "rgb(34 197 94)" : "rgb(239 68 68)"}
          strokeWidth="4"
          points={normalized}
        />
      </svg>
    );
  };

  return (
    <div className="flex flex-col gap-8 pt-24">
      <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex h-24 items-center justify-between gap-6 px-8">
          <div className="flex flex-1 items-center justify-center py-1">
            <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <form onSubmit={handleSubmit}>
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">My Watchlist</h1>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Updating..."}
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card px-6 py-2 shadow-sm">
        {loading ? (
          <div className="grid gap-3 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Markets</TableHead>
                <TableHead>Change 1D</TableHead>
                <TableHead />
                <TableHead>Short</TableHead>
                <TableHead>Buy</TableHead>
                <TableHead>52W Range</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlistItems.map((quote) => {
                const positive = quote.change_1d >= 0;
                const changePercent = quote.value
                  ? (quote.change_1d / quote.value) * 100
                  : 0;
                return (
                  <TableRow key={quote.ticker}>
                    <TableCell>
                      <div className="font-semibold">{quote.ticker}</div>
                      <div className="text-xs text-muted-foreground">
                        {quote.company_name}
                      </div>
                    </TableCell>
                    <TableCell>
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
                    <TableCell>{renderSparkline(quote.ticker, positive)}</TableCell>
                    <TableCell>
                      <div className="rounded-full bg-muted px-4 py-2 text-sm font-semibold">
                        {quote.short.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="rounded-full bg-muted px-4 py-2 text-sm font-semibold">
                        {quote.buy.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {quote.rangeLow.toFixed(2)} - {quote.rangeHigh.toFixed(2)}
                      </div>
                      <div className="mt-2 h-2 w-32 rounded-full bg-muted">
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
        )}
        {error ? <div className="px-2 py-4 text-sm text-rose-500">Unable to load watchlist.</div> : null}
      </section>
    </div>
  );
}
