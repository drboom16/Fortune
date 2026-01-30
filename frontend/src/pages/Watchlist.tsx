import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";

type Quote = {
  symbol: string;
  price: number;
  previous_close: number;
  change: number;
  change_percent: number;
};

type Company = {
  symbol: string;
  name: string;
  sector: string;
};

const companies: Company[] = [
  { symbol: "AAPL", name: "Apple", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft", sector: "Technology" },
  { symbol: "AMZN", name: "Amazon", sector: "Consumer Discretionary" },
  { symbol: "NVDA", name: "NVIDIA", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet", sector: "Communication Services" },
  { symbol: "META", name: "Meta Platforms", sector: "Communication Services" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "Financials" },
  { symbol: "V", name: "Visa", sector: "Financials" },
  { symbol: "UNH", name: "UnitedHealth", sector: "Health Care" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy" }
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export default function Watchlist() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const companyMap = useMemo(() => {
    return new Map(companies.map((company) => [company.symbol, company]));
  }, []);

  const loadQuotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled(
        companies.map(async (company) => {
          const response = await fetch(`${API_BASE_URL}/quote?symbol=${company.symbol}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${company.symbol}`);
          }
          return (await response.json()) as Quote;
        })
      );

      const nextQuotes = results
        .filter((result): result is PromiseFulfilledResult<Quote> => result.status === "fulfilled")
        .map((result) => result.value);

      if (!nextQuotes.length) {
        throw new Error("No quotes returned from API.");
      }
      setQuotes(nextQuotes);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load market data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQuotes();
  }, []);

  const filteredQuotes = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) {
      return quotes;
    }
    return quotes.filter((quote) => {
      const company = companyMap.get(quote.symbol);
      return (
        quote.symbol.includes(normalized) ||
        company?.name.toUpperCase().includes(normalized) ||
        company?.sector.toUpperCase().includes(normalized)
      );
    });
  }, [quotes, query, companyMap]);

  const watchlistItems = useMemo(() => {
    return filteredQuotes.map((quote) => {
      const company = companyMap.get(quote.symbol);
      const spread = Math.max(0.05, quote.price * 0.0008);
      const buy = quote.price + spread;
      const short = quote.price - spread;
      const rangeLow = Math.max(0.01, quote.price * 0.78);
      const rangeHigh = quote.price * 1.22;
      const rangePosition = Math.min(
        100,
        Math.max(0, ((quote.price - rangeLow) / (rangeHigh - rangeLow)) * 100)
      );
      return {
        ...quote,
        company,
        buy,
        short,
        rangeLow,
        rangeHigh,
        rangePosition
      };
    });
  }, [filteredQuotes, companyMap]);

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
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-6">
        <div className="flex flex-1 items-center justify-center">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-full border border-border bg-card px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
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
                const positive = quote.change >= 0;
                return (
                  <TableRow key={quote.symbol}>
                    <TableCell>
                      <div className="font-semibold">{quote.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {quote.company?.name ?? quote.symbol}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div
                        className={`text-sm font-semibold ${
                          positive ? "text-emerald-500" : "text-rose-500"
                        }`}
                      >
                        {positive ? "+" : ""}
                        {quote.change.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {positive ? "+" : ""}
                        {quote.change_percent.toFixed(2)}%
                      </div>
                    </TableCell>
                    <TableCell>{renderSparkline(quote.symbol, positive)}</TableCell>
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
