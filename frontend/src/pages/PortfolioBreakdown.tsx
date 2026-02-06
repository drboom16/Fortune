import { useState, useEffect } from "react";
import { ArrowLeft, ChevronLeft, X } from "lucide-react";
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
  id: number,
  created_at: string,
  symbol: string,
  company_name: string,
  market_price: number,
  quantity: number,
  price: number,
  unrealized_pnl: number,
  unrealized_pnl_percentage: number,
  net_value: number;
  stop_loss_price?: number;
  take_profit_price?: number;
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
  const [orderOpen, setOrderOpen] = useState(false); // Displays a modal which enables configuring SL and TP
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [stopLossPrice, setStopLossPrice] = useState<string>("");
  const [takeProfitPrice, setTakeProfitPrice] = useState<string>("");

  const handleOrderOpen = (id: number) => {
    setOrderOpen(true);
    setOrder(orderHistory?.find((o: Order) => o.id === id) ?? null);
  }

  const handleUpdateThresholds = async () => {
    const token = getAccessToken();
    if (!token) return;
    if (!order) return;
    const response = await fetch(`${API_BASE_URL}/portfolio/breakdown/thresholds`, {
      method: "POST",
      credentials: 'include',
      headers: { 
        Authorization: `Bearer ${token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        id: order.id,
        stop_loss_price: parseFloat(stopLossPrice), 
        take_profit_price: parseFloat(takeProfitPrice) 
      })
    });
    if (!response.ok) throw new Error("Failed to update thresholds.");
    setOrderOpen(false);
  }

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
      {orderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-background/80"
            onClick={() => setOrderOpen(false)}
          />

          <div className="relative z-10 w-full max-w-md border border-border bg-card rounded-xl p-6">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Buy Position</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  ID#{order?.id.toString()}
                </p>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setOrderOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {(() => {
              if (!order) return null;

              return (
                <>
                  <div className="mb-6 p-4 border border-border rounded-lg bg-muted/40">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="font-semibold text-base">{order.symbol}</div>
                        <div className="text-xs text-muted-foreground">{order.company_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-base">${order.market_price.toFixed(2)}</div>
                        <div className={`text-xs font-medium ${order.unrealized_pnl_percentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {order.unrealized_pnl_percentage >= 0 ? "+" : ""}{order.unrealized_pnl_percentage.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-2">Stop Loss Price (SL)</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={stopLossPrice}
                        onChange={(e) => setStopLossPrice(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-2">Take Profit Price (TP)</label>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={takeProfitPrice}
                        onChange={(e) => setTakeProfitPrice(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mb-6 p-4 border border-border rounded-lg space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shares Owned</span>
                      <span className="font-medium">{order.quantity}</span>
                    </div>
                    <div className="flex justify-between items-start text-sm">
                      <span className="text-muted-foreground">Opening Price</span>
                      
                      {/* Right-aligned container for Price and Date */}
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-foreground">
                          ${order.price.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })} | {new Date(order.created_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Unrealized P/L</span>
                      <span className={`font-medium ${order.unrealized_pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {order.unrealized_pnl >= 0 ? "$" : "-$"}{Math.abs(order.unrealized_pnl).toFixed(2)}
                      </span>
                    </div>
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Net Position Value</span>
                        <span className="font-semibold">${order.net_value.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleUpdateThresholds}>
                      Update Thresholds
                    </Button>
                    <Button 
                      variant="ghost"
                      className="w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                    >
                      Close Trade
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

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
                <TableRow key={order.id} className="cursor-pointer" onClick={() => handleOrderOpen(order.id)}>
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
                    <div className="text-sm font-medium">{order.stop_loss_price ? order.stop_loss_price.toFixed(2) : "---"}</div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">{order.take_profit_price ? order.take_profit_price.toFixed(2) : "---"}</div>
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

