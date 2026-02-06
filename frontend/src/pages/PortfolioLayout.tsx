import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";

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
    <div className="pt-24 pb-24">
      <Outlet context={{ loading, positionsPayload, accountCash, totalInvested, profitLoss, portfolioValue }} />

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
