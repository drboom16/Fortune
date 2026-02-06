import { useState, useEffect } from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import StockSearchBar from "../components/ui/StockSearchBar";
import { Button } from "../components/ui/button";

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

interface Order {
  symbol: string,
  company_name: string,
  market_price: number,
  quantity: number,
  price: number,
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

export default function PortfolioBreakdown() {
  const [loading, setLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState<Order[] | null>(null);
  const { symbol } = useParams<{ symbol: string }>();
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
  
        let response = await fetch(`${API_BASE_URL}/portfolio/breakdown/${symbol}`, {
          method: "GET",
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}` }
        });
  
        if (response.status === 401 || response.status === 422) {
          const refreshed = await refreshAccessToken();
          if (!refreshed) {
            return;
          }
  
          response = await fetch(`${API_BASE_URL}/portfolio/breakdown/${symbol}`, {
            method: "GET",
            credentials: 'include',
            headers: { Authorization: `Bearer ${refreshed}`}
          });
        }
  
        if (!response.ok) {
          throw new Error("Failed to load position breakdown.");
        }
  
        const payload = (await response.json()) as { order_history: Order[] };
        const orderHistory = Array.isArray(payload.order_history) ? payload.order_history : [];
        setOrderHistory(orderHistory);
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

      <section className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <Button className="text-2xl font-semibold bg-white text-black hover:bg-white/80" onClick={() => navigate("/portfolio/overview")}>
            <ChevronLeft className="h-6 w-6 translate-x-[-18px] translate-y-[-4px]" />
            <span className="translate-x-[-24px] translate-y-[-4px]">Back</span>
          </Button>
        </div>
      </section>

      <div className="py-8 translate-y-[-7px]">
        {loading ? (
          <div className="grid gap-3 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : orderHistory && orderHistory.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">SL</TableHead>
                <TableHead className="text-right">TP</TableHead>
                <TableHead className="text-right">Avg. Open</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead className="text-right">P/L(%)</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
                <TableHead className="text-center">Close Positions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderHistory.map((order: Order) => (
                <TableRow key={order.symbol}>
                  <TableCell>
                    <div className="font-semibold">{order.symbol}</div>
                    <div className="text-xs text-muted-foreground">
                      {order.company_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">{order.quantity}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">{order.market_price.toFixed(2)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">{}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">{}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium ">${order.price.toFixed(2)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`text-sm font-medium ${order.unrealized_pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{order.unrealized_pnl >= 0 ? "$" : "-$"}{Math.abs(order.unrealized_pnl).toFixed(2)}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={`text-sm font-medium ${order.unrealized_pnl_percentage >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{order.unrealized_pnl_percentage >= 0 ? "+" : "-"}{Math.abs(order.unrealized_pnl_percentage).toFixed(2)}%</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">${order.net_value.toFixed(2)}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button className="w-24 border border-red-500 rounded-full bg-transparent text-red-500 transition-colors duration-300 ease-in-out hover:bg-red-500 hover:text-white hover:border-red-500">Close</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div />
        )}
      </div>

    </div>
  );
}

