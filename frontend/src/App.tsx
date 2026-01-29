import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Eye,
  Home,
  PanelLeft,
  RefreshCw,
  TrendingDown,
  TrendingUp
} from "lucide-react";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Skeleton } from "./components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./components/ui/table";

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
  { symbol: "XOM", name: "Exxon Mobil", sector: "Energy" },
  { symbol: "COST", name: "Costco", sector: "Consumer Staples" },
  { symbol: "TSLA", name: "Tesla", sector: "Consumer Discretionary" }
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const summary = useMemo(() => {
    if (!quotes.length) {
      return { gainers: 0, losers: 0, avgChange: 0 };
    }
    const gainers = quotes.filter((quote) => quote.change > 0).length;
    const losers = quotes.filter((quote) => quote.change < 0).length;
    const avgChange =
      quotes.reduce((total, quote) => total + quote.change_percent, 0) / quotes.length;
    return { gainers, losers, avgChange };
  }, [quotes]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside
          className={`shrink-0 border-r border-border bg-card py-10 transition-all duration-300 ${
            sidebarOpen ? "w-80 px-8" : "w-24 px-5"
          }`}
        >
          <div className="mb-10 flex items-center justify-between">
            {sidebarOpen ? (
              <p className="text-lg uppercase tracking-[0.45em] text-muted-foreground">Fortune</p>
            ) : (
              <span />
            )}
            <Button
              variant="ghost"
              className="h-14 w-14 rounded-xl"
              onClick={() => setSidebarOpen((open) => !open)}
              aria-label="Toggle sidebar"
            >
              <PanelLeft className="h-7 w-7" />
            </Button>
          </div>
          <nav className="flex flex-col gap-3 text-base font-medium">
            <button
              className={`flex items-center rounded-xl py-4 text-left ${
                sidebarOpen ? "bg-muted px-5" : "justify-center px-0"
              }`}
            >
              {sidebarOpen ? <span>Home</span> : <Home className="h-7 w-7 shrink-0" />}
            </button>
            <button
              className={`flex items-center rounded-xl py-4 text-left text-muted-foreground hover:bg-muted ${
                sidebarOpen ? "px-5" : "justify-center px-0"
              }`}
            >
              {sidebarOpen ? <span>Watchlist</span> : <Eye className="h-7 w-7 shrink-0" />}
            </button>
            <button
              className={`flex items-center rounded-xl py-4 text-left text-muted-foreground hover:bg-muted ${
                sidebarOpen ? "px-5" : "justify-center px-0"
              }`}
            >
              {sidebarOpen ? <span>Portfolio</span> : <Briefcase className="h-7 w-7 shrink-0" />}
            </button>
          </nav>
        </aside>

        <div className="flex-1 px-6 py-8">
          <div className="flex flex-col gap-10">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold">S&amp;P 500 Quote Board</h1>
                <p className="text-sm text-muted-foreground">
                  Real-time snapshots of the market.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground">
                  {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Updating..."}
                </div>
                <Button onClick={loadQuotes} disabled={loading}>
                  <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  Refresh
                </Button>
              </div>
            </header>

            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardDescription>Market breadth</CardDescription>
                  <CardTitle>Gainers vs Losers</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span>{summary.gainers} gaining</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-rose-600" />
                    <span>{summary.losers} declining</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Average move</CardDescription>
                  <CardTitle>{summary.avgChange.toFixed(2)}%</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Calculated from the companies displayed below.
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>Filter by symbol, name, or sector</CardDescription>
                  <CardTitle>Search the board</CardTitle>
                </CardHeader>
                <CardContent>
                  <input
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="e.g. Technology, AAPL, Apple"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </CardContent>
              </Card>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Quote grid</h2>
                  <p className="text-sm text-muted-foreground">
                    Live prices for a curated set of S&amp;P 500 companies.
                  </p>
                </div>
                {error ? <Badge variant="negative">{error}</Badge> : null}
              </div>

              {loading ? (
                <div className="grid gap-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Last price</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Change %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredQuotes.map((quote) => {
                      const company = companyMap.get(quote.symbol);
                      const positive = quote.change >= 0;
                      return (
                        <TableRow key={quote.symbol}>
                          <TableCell>
                            <div className="font-medium">{company?.name ?? quote.symbol}</div>
                            <div className="text-xs text-muted-foreground">{quote.symbol}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {company?.sector ?? "—"}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {quote.price.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={positive ? "positive" : "negative"}>
                              {positive ? "+" : ""}
                              {quote.change.toFixed(2)}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={positive ? "text-emerald-600" : "text-rose-600"}
                          >
                            {positive ? "+" : ""}
                            {quote.change_percent.toFixed(2)}%
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
