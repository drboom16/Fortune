import { useState, useEffect } from "react";
import { ArrowLeft, ChevronLeft, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { Skeleton } from "../components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import StockSearchBar from "../components/ui/StockSearchBar";
import { Button } from "../components/ui/button";

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
  exchange?: string;
  currency?: string;
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
  const [marketStatus, setMarketStatus] = useState<boolean>(false);
  const [marketPrice, setMarketPrice] = useState<number>(0);
  const [marketPriceChange, setMarketPriceChange] = useState<number>(0);
  const [marketPriceChangePercentage, setMarketPriceChangePercentage] = useState<number>(0);
  const [closeTradeModalActive, setCloseTradeModalActive] = useState<boolean>(false);
  const [closeAllTradesModalActive, setCloseAllTradesModalActive] = useState<boolean>(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  
  const handleOrderOpen = (id: number) => {
    const selectedOrder = orderHistory?.find((o: Order) => o.id === id) ?? null;
    setOrder(selectedOrder);
    
    // Pre-populate the input fields with existing values
    if (selectedOrder) {
      setStopLossPrice(selectedOrder.stop_loss_price?.toString() ?? "");
      setTakeProfitPrice(selectedOrder.take_profit_price?.toString() ?? "");
    } else {
      setStopLossPrice("");
      setTakeProfitPrice("");
    }
    
    setOrderOpen(true);
  }
  
  // Also clear when closing
  const handleCloseModal = () => {
    setOrderOpen(false);
    setStopLossPrice("");
    setTakeProfitPrice("");
    setOrder(null);
  }

  const handleSellStock = async (id: number, symbol: string, quantity: number) => {
    setLoading(true);
    const token = getAccessToken();
    if (!token) return;
    if (!symbol || !quantity) return;
    try {
      const response = await fetch(`${API_BASE_URL}/sell`, {
        method: "POST",
        credentials: 'include',
        headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
          id: id,
          symbol: symbol, 
          quantity: quantity, 
        })
      });
      if (!response.ok) throw new Error("Failed to sell stock.");
      setCloseTradeModalActive(false);
      setTradeError(null);
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Unable to sell stock.");
    } finally {
      setLoading(false);
    }
  };

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
    handleCloseModal();
  }

  const handleCloseAllTrades = async () => {
    const token = getAccessToken();
    if (!token) return;
    const response = await fetch(`${API_BASE_URL}/portfolio/breakdown/close-all`, {
      method: "POST",
      credentials: 'include',
      headers: { 
        Authorization: `Bearer ${token}`, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        symbol: symbol
      })
    });
    if (!response.ok) throw new Error("Failed to close all trades.");
    setCloseAllTradesModalActive(false);
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
        setMarketPrice(orderHistory[0].market_price);
        setMarketPriceChange(orderHistory[0].unrealized_pnl);
        setMarketPriceChangePercentage(orderHistory[0].unrealized_pnl_percentage);
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

  useEffect(() => {
    const loadMarketStatus = async () => {
      const response = await fetch(`${API_BASE_URL}/market/status?symbol=${symbol}`);
      if (!response.ok) throw new Error("Failed to load market status.");
      const payload = (await response.json()) as { market_status: boolean };
      setMarketStatus(payload.market_status);
    }
    loadMarketStatus();
  }, [orderOpen]);

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
            onClick={() => handleCloseModal()}
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
                onClick={() => handleCloseModal()}
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
                        <div className="mt-1 text-[8px] text-muted-foreground">{marketStatus ? "Market open" : "Market closed"} • Prices by {order.exchange}, in {order.currency}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-base">${marketPrice.toFixed(2)}</div>
                        <div className={`text-xs font-medium ${marketPriceChangePercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {marketPriceChangePercentage >= 0 ? "+" : ""}{marketPriceChangePercentage.toFixed(2)}%
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
                      <span className={`font-medium ${marketPriceChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {marketPriceChange >= 0 ? "$" : "-$"}{Math.abs(marketPriceChange).toFixed(2)}
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
                      onClick={(e) => {
                        e.stopPropagation();
                        setOrder(order);
                        setCloseTradeModalActive(true);
                      }}
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
              <TableRow className="bg-muted/40 h-16">
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-center">SL</TableHead>
                <TableHead className="text-center">TP</TableHead>
                <TableHead className="text-right">Avg. Open</TableHead>
                <TableHead className="text-right">P/L</TableHead>
                <TableHead className="text-right">P/L(%)</TableHead>
                <TableHead className="text-right">Net Value</TableHead>
                <TableHead className="text-center">
                  <Button className="w-30 h-8 text-black border border-black rounded-full bg-transparent transition-colors duration-300 ease-in-out hover:bg-black hover:text-white hover:border-black" onClick={(e) => {
                    e.stopPropagation();
                    setCloseAllTradesModalActive(true);
                  }}>Close All</Button>
                </TableHead>
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
                  <TableCell className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-8 border border-border rounded-md text-sm font-medium">
                      {order.stop_loss_price ? order.stop_loss_price.toFixed(2) : "---"}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-8 border border-border rounded-md text-sm font-medium">
                      {order.take_profit_price ? order.take_profit_price.toFixed(2) : "---"}
                    </div>
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
                    <Button 
                      className="w-20 h-8 border border-red-500 rounded-full bg-transparent text-red-500 transition-colors duration-300 ease-in-out hover:bg-red-500 hover:text-white hover:border-red-500" 
                      onClick={(e) => { 
                        e.stopPropagation();
                        const selectedOrder = orderHistory?.find((o: Order) => o.id === order.id) ?? null;
                        setOrder(selectedOrder);
                        setCloseTradeModalActive(true); 
                      }}
                    >
                      Close
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div />
        )}
      </div>

      {closeTradeModalActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-background/80"
            onClick={() => setCloseTradeModalActive(false)}
          />

          <div className="relative z-10 w-full max-w-md border border-border bg-card rounded-xl p-6">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Close Trade</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  ID#{order?.id.toString()}
                </p>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setCloseTradeModalActive(false)}
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
                        <div className="mt-1 text-[8px] text-muted-foreground">{marketStatus ? "Market open" : "Market closed"} • Prices by {order.exchange}, in {order.currency}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-base">${order.market_price.toFixed(2)}</div>
                        <div className={`text-xs font-medium ${marketPriceChangePercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {marketPriceChangePercentage >= 0 ? "+" : ""}{marketPriceChangePercentage.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-6 p-4 border border-border rounded-lg space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Current value</span>
                      <span className="font-medium">${order.net_value.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-start text-sm">
                      <span className="text-muted-foreground">Quantity</span>
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
                      <span className="text-muted-foreground">Total Return</span>
                      <span className={`font-medium ${marketPriceChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {marketPriceChange >= 0 ? "$" : "-$"}{Math.abs(marketPriceChange).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-center text-muted-foreground">Note: Your close order will be executed once the market is open.</div>
                  <div className="mt-6 flex flex-col gap-3">
                    <Button 
                      variant="ghost"
                      className="w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSellStock(order.id, order.symbol, order.quantity);
                      }}
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

      {closeAllTradesModalActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-background/80"
            onClick={() => setCloseAllTradesModalActive(false)}
          />

          <div className="relative z-10 w-full max-w-md border border-border bg-card rounded-xl p-6">
            
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold">Close All Trades</h2>
              </div>
              <Button
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => setCloseAllTradesModalActive(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mb-6 p-4 border border-border rounded-lg bg-muted/40">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="font-semibold text-base">{symbol}</div>
                  <div className="text-xs text-muted-foreground">{orderHistory?.[0]?.company_name}</div>
                  <div className="mt-1 text-[8px] text-muted-foreground">{marketStatus ? "Market open" : "Market closed"} • Prices by {orderHistory?.[0]?.exchange}, in {orderHistory?.[0]?.currency}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-base">${marketPrice.toFixed(2)}</div>
                  <div className={`text-xs font-medium ${marketPriceChangePercentage >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {marketPriceChangePercentage >= 0 ? "+" : ""}{marketPriceChangePercentage.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 border border-border rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg. Open</span>
                <div className="flex flex-col items-end">
                  <span className="font-semibold text-foreground">
                    ${(orderHistory?.reduce((acc, order) => acc + order.price * order.quantity, 0) ?? 0) / (orderHistory?.reduce((acc, order) => acc + order.quantity, 0) ?? 1)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {orderHistory?.reduce((acc, order) => acc + order.quantity, 0) ?? 0} Shares
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-start text-sm">
                <span className="text-muted-foreground">Total P/L</span>
                <div className="flex flex-col items-end">
                  {(() => {
                    const totalPnl = orderHistory?.reduce((acc, order) => acc + order.unrealized_pnl, 0) ?? 0;
                    return (
                      <>
                        <span className="font-semibold text-foreground">
                          {totalPnl >= 0 ? "$" : "-$"}{Math.abs(totalPnl).toFixed(2)}
                        </span>
                        <span className={`text-[10px] ${totalPnl >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {totalPnl >= 0 ? "+" : "-"} {Math.abs(totalPnl).toFixed(2)}%
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Value</span>
                <span className="font-medium">${(orderHistory?.reduce((acc, order) => acc + order.market_price * order.quantity, 0) ?? 0).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="text-[10px] text-center text-muted-foreground">Note: Your close order will be executed once the market is open.</div>
            
            <div className="mt-6 flex flex-col gap-3">
              <Button 
                variant="ghost"
                className="w-full border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseAllTrades();
                }}
              >
                Close All
              </Button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

