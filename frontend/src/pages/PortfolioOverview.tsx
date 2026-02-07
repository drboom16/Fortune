import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";

import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import StockSearchBar from "../components/ui/StockSearchBar";

interface Position {
  symbol: string,
  company_name: string,
  market_price: number,
  quantity: number,
  avg_price: number,
  unrealized_pnl: number,
  unrealized_pnl_percentage: number,
  net_value: number;
}

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
    credentials: 'include',
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
}

export default function PortfolioOverview() {
  const [loading, setLoading] = useState(false);
  const [positionsPayload, setPositionsPayload] = useState<Position[] | null>(null);
  const [accountCash, setAccountCash] = useState<number | null>(null);
  const [totalInvested, setTotalInvested] = useState<number | null>(null);
  const [profitLoss, setProfitLoss] = useState<number | null>(null);
  const [portfolioValue, setPortfolioValue] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    const loadStatus = async (showLoading: boolean) => {
      if (showLoading) setLoading(true);

      try {
        const token = getAccessToken();
        if (!token) {
          return;
        }
  
        let response = await fetch(`${API_BASE_URL}/portfolio`, {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` }
        });
  
        if (response.status === 401 || response.status === 422) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            return;
          }
  
          response = await fetch(`${API_BASE_URL}/portfolio`, {
            credentials: 'include',
            headers: { Authorization: `Bearer ${refreshed}`}
          });
        }
  
        if (!response.ok) {
          throw new Error("Failed to load portfolio.");
        }
  
        const payload = (await response.json()) as { account_cash: number, portfolio: Position[] };
        const positions = Array.isArray(payload.portfolio) ? payload.portfolio : [];
        setPositionsPayload(positions);
        setAccountCash(payload.account_cash);
        setTotalInvested(positions.reduce((acc, position) => acc + position.avg_price * position.quantity, 0));
        setProfitLoss(positions.reduce((acc, position) => acc + position.unrealized_pnl, 0));
        setPortfolioValue(payload.account_cash + (positions.reduce((acc, position) => acc + position.avg_price * position.quantity, 0) ?? 0) + (positions.reduce((acc, position) => acc + position.unrealized_pnl, 0) ?? 0));
      } catch (error) {
        console.error(error);
      } finally {
        if (showLoading) setLoading(false);
      }
    }

    loadStatus(true);

    const interval = setInterval(() => {
      loadStatus(false);
    }, 2000); // Refresh every 2 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex h-24 items-center justify-between gap-6 px-8">
          <div className="flex flex-1 items-center justify-center py-1">
            <StockSearchBar className="max-w-lg"/>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">My Portfolio</h1>
        </div>
      </section>

      <div className="py-8">
        {loading ? (
          <div className="grid gap-3 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : positionsPayload && positionsPayload.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 h-16">
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Avg. Open</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead className="text-right">P/L(%)</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positionsPayload.map((position) => {
                const handleClick = () => {
                  navigate(`/portfolio/breakdown/${position.symbol}`);
                };
                return (
                  <TableRow key={position.symbol} onClick={handleClick} className="cursor-pointer">
                    <TableCell>
                      <div className="font-semibold">{position.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {position.company_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-medium">{position.market_price.toFixed(2)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-medium">{position.quantity}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-medium">{position.avg_price.toFixed(2)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`text-sm font-medium ${position.unrealized_pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{position.unrealized_pnl >= 0 ? "$" : "-$"}{Math.abs(position.unrealized_pnl).toFixed(2)}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className={`text-sm font-medium ${position.unrealized_pnl_percentage >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{position.unrealized_pnl_percentage.toFixed(2)}%</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm font-medium">${position.net_value.toFixed(2)}</div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card text-center h-[calc(100vh-22rem)]">
            <img src="/pi-chart.png" alt="Portfolio chart" className="h-64 w-64" />
            <h2 className="mt-6 text-xl font-semibold">Your portfolio is empty</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              Start exploring investment opportunities by copying people and investing in markets or
              SmartPortfolios.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Section: Portfolio Value */}
      <div className="fixed bottom-0 z-30 left-[var(--sidebar-width)] right-0 border-t border-border/40 bg-card/95 backdrop-blur transition-[left] duration-300 ease-in-out">
        <div className="grid grid-cols-7 items-center gap-2 px-8 py-4 text-center">
          <div>
            <div className="text-lg font-semibold">${(accountCash ?? 0).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Cash Available</div>
          </div>
          <div className="text-2xl text-muted-foreground">+</div>
          <div>
            <div className="text-lg font-semibold">${(totalInvested ?? 0).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Total Invested</div>
          </div>
          <div className="text-2xl text-muted-foreground">+</div>
          <div>
            <div className={`text-lg font-semibold ${(profitLoss ?? 0) >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{(profitLoss ?? 0) >= 0 ? "$" : "-$"}{Math.abs(profitLoss ?? 0).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Profit/Loss</div>
          </div>
          <div className="text-2xl text-muted-foreground">=</div>
          <div>
            <div className="text-lg font-semibold">${(portfolioValue ?? 0).toFixed(2)}</div>
            <div className="text-xs text-muted-foreground">Portfolio Value</div>
          </div>
        </div>
      </div>
    </div>
  );
}
