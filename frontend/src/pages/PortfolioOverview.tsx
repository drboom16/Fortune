import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { TableSkeleton } from "../components/ui/table-skeleton";
import { Button } from "../components/ui/button";
import { apiFetch } from "../lib/api";

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

interface PendingOrder {
  id: number;
  symbol: string;
  company_name?: string;
  side: string;
  quantity: number;
  price: number;
  status: string;
  status_text: string | null;
  created_at: string;
}

type ViewMode = "positions" | "pending";

export default function PortfolioOverview() {
  const [loading, setLoading] = useState(false);
  const [positionsPayload, setPositionsPayload] = useState<Position[] | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[] | null>(null);
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("positions");
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
        const response = await apiFetch("/portfolio");
        if (!response.ok) {
          return;
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

  useEffect(() => {
    if (viewMode !== "pending") return;

    const loadPendingOrders = async () => {
      setPendingOrdersLoading(true);
      try {
        const response = await apiFetch("/orders/pending");
        if (!response.ok) {
          setPendingOrders([]);
          return;
        }
        const payload = (await response.json()) as { orders: PendingOrder[] };
        setPendingOrders(Array.isArray(payload.orders) ? payload.orders : []);
      } catch (error) {
        console.error(error);
        setPendingOrders([]);
      } finally {
        setPendingOrdersLoading(false);
      }
    };

    loadPendingOrders();
  }, [viewMode]);

  return (
    <div>
      <section className="flex flex-col gap-4">
            <h1 className="text-2xl font-semibold">My Portfolio</h1>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "positions" ? "default" : "secondary"}
                size="sm"
                onClick={() => setViewMode("positions")}
                className={viewMode === "positions" ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90" : ""}
              >
                All positions
              </Button>
              <Button
                variant={viewMode === "pending" ? "default" : "secondary"}
                size="sm"
                onClick={() => setViewMode("pending")}
                className={viewMode === "pending" ? "bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90" : ""}
              >
                Pending orders
              </Button>
            </div>
          </section>

          <div className="py-8">
            {viewMode === "positions" ? (
              <>
                {loading ? (
                  <TableSkeleton
                    columns={[
                      { header: "Asset", className: "w-[180px]" },
                      { header: "Price", className: "w-[100px] text-center" },
                      { header: "Units", className: "w-[80px] text-center" },
                      { header: "Avg. Open", className: "w-[100px] text-center" },
                      { header: "P/L", className: "w-[100px] text-center" },
                      { header: "P/L(%)", className: "w-[90px] text-center" },
                      { header: "Net Value", className: "w-[110px] text-right" },
                    ]}
                  />
                ) : positionsPayload && positionsPayload.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 h-16">
                    <TableHead className="w-[180px]">Asset</TableHead>
                    <TableHead className="w-[100px] text-center">Price</TableHead>
                    <TableHead className="w-[80px] text-center">Units</TableHead>
                    <TableHead className="w-[100px] text-center">Avg. Open</TableHead>
                    <TableHead className="w-[100px] text-center">P/L</TableHead>
                    <TableHead className="w-[90px] text-center">P/L(%)</TableHead>
                    <TableHead className="w-[110px] text-right">Net Value</TableHead>
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
                        <TableCell className="text-center">
                          <div className="text-sm font-medium">{position.market_price.toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-sm font-medium">{position.quantity}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-sm font-medium">{position.avg_price.toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className={`text-sm font-medium ${position.unrealized_pnl >= 0 ? "text-emerald-500" : "text-rose-500"}`}>{position.unrealized_pnl >= 0 ? "$" : "-$"}{Math.abs(position.unrealized_pnl).toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="text-center">
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
              <div className="flex flex-col items-center justify-center rounded-2xl bg-card text-center h-[calc(100vh-22rem)]">
                <img src="/pi-chart.png" alt="Portfolio chart" className="h-64 w-64" />
                <h2 className="mt-6 text-xl font-semibold">Your portfolio is empty</h2>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  Start exploring investment opportunities by copying people and investing in markets or
                  SmartPortfolios.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {pendingOrdersLoading ? (
              <TableSkeleton
                columns={[
                  { header: "Asset", className: "w-[180px]" },
                  { header: "Side", className: "w-[90px] text-center" },
                  { header: "Quantity", className: "w-[90px] text-center" },
                  { header: "Price", className: "w-[90px] text-center" },
                  { header: "Status", className: "w-[100px] text-center" },
                  { header: "Order Entry Time", className: "w-[160px] text-right" },
                ]}
              />
            ) : pendingOrders && pendingOrders.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 h-16">
                    <TableHead className="w-[180px]">Asset</TableHead>
                    <TableHead className="w-[90px] text-center">Side</TableHead>
                    <TableHead className="w-[90px] text-center">Quantity</TableHead>
                    <TableHead className="w-[90px] text-center">Price</TableHead>
                    <TableHead className="w-[100px] text-center">Status</TableHead>
                    <TableHead className="w-[160px] text-right">Order Entry Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <div className="font-semibold">{order.symbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.company_name ?? order.symbol}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className={`text-sm font-medium ${order.side === "BUY" ? "text-emerald-500" : "text-rose-500"}`}>
                          {order.side}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm font-medium">{order.quantity}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm font-medium">${order.price.toFixed(2)}</div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm font-medium">{order.status}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm font-medium text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-card text-center h-[calc(100vh-22rem)]">
                <img src="/pi-chart.png" alt="Portfolio chart" className="h-64 w-64" />
                <h2 className="mt-6 text-xl font-semibold">No pending orders</h2>
                <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                  Orders placed when the market is closed will appear here until they are executed.
                </p>
              </div>
            )}
          </>
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
