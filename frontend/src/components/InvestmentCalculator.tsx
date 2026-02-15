import { useState, useMemo, useRef } from "react";
import type { Chart } from "chart.js";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { apiFetch } from "../lib/api";
import { Button } from "./ui/button";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

type ChartPoint = { time: number; close: number };

function decimate(data: ChartPoint[], maxPoints: number): ChartPoint[] {
  if (data.length <= maxPoints) return data;
  const result: ChartPoint[] = [];
  const step = (data.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = i === maxPoints - 1 ? data.length - 1 : Math.floor(i * step);
    result.push(data[idx]);
  }
  return result;
}

const MONTH_NAMES = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

function parseMonthYear(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const yyyyMm = /^(\d{4})-(\d{1,2})$/;
  const match = s.match(yyyyMm);
  if (match) {
    const m = parseInt(match[2], 10);
    if (m >= 1 && m <= 12) return `${match[1]}-${String(m).padStart(2, "0")}`;
  }
  const parts = s.split(/[\s/,-]+/);
  if (parts.length >= 2) {
    const first = parts[0].toLowerCase();
    const monthIdx = MONTH_NAMES.findIndex((m) => first.startsWith(m));
    const year = parseInt(parts[parts.length - 1], 10);
    if (monthIdx >= 0 && !isNaN(year) && year >= 1900 && year <= 2100) {
      return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
    }
    const m = parseInt(parts[0], 10);
    if (m >= 1 && m <= 12 && !isNaN(year)) {
      return `${year}-${String(m).padStart(2, "0")}`;
    }
  }
  return null;
}

function formatMonthYear(monthYear: string): string {
  const parsed = parseMonthYear(monthYear);
  if (!parsed) return monthYear;
  const [y, m] = parsed.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function formatCurrency(n: number, compact = false): string {
  if (compact && n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (compact && n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InvestmentCalculator() {
  const [amount, setAmount] = useState("100");
  const symbolRef = useRef<HTMLInputElement>(null);
  const [calculatedSymbol, setCalculatedSymbol] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [currentValue, setCurrentValue] = useState<number | null>(null);
  const [effectiveStartDate, setEffectiveStartDate] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart<"line"> | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ value: number; date: string } | null>(null);
  const [boxMargin, setBoxMargin] = useState<{ left: number; right: number }>({ left: 0, right: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const BOX_WIDTH_ESTIMATE = 180;

  const displayData = useMemo(() => decimate(chartData, 100), [chartData]);
  const amt = parseFloat(amount) || 0;
  const firstClose = chartData[0]?.close;
  const investmentValues = useMemo(() => {
    if (!firstClose || firstClose <= 0) return [];
    return displayData.map((d) => (amt / firstClose) * d.close);
  }, [displayData, amt, firstClose]);

  const handleChartMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const crosshair = crosshairRef.current;
    const chart = chartRef.current;
    if (!container || !crosshair || !chart?.chartArea || investmentValues.length === 0 || displayData.length === 0) {
      if (crosshair) crosshair.style.visibility = "hidden";
      setHoveredPoint(null);
      return;
    }
    const canvas = chart.canvas;
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const area = chart.chartArea;
    const leftEdge = canvasRect.left + area.left;
    const rightEdge = canvasRect.left + area.right;
    const clientX = e.clientX;
    if (clientX >= leftEdge && clientX <= rightEdge) {
      const chartX = clientX - canvasRect.left - area.left;
      const chartWidth = area.right - area.left;
      const idx = Math.min(
        Math.floor((chartX / chartWidth) * investmentValues.length),
        investmentValues.length - 1
      );
      const i = Math.max(0, idx);
      const cursorX = clientX - containerRect.left;
      const areaLeftInContainer = (canvasRect.left - containerRect.left) + area.left;
      const areaRightInContainer = (canvasRect.left - containerRect.left) + area.right;
      const boxWidth = boxRef.current?.offsetWidth ?? BOX_WIDTH_ESTIMATE;
      const boxLeftEdge = cursorX - boxWidth / 2;
      const boxRightEdge = cursorX + boxWidth / 2;
      const marginLeft = boxLeftEdge < areaLeftInContainer ? areaLeftInContainer - boxLeftEdge : 0;
      const marginRight = boxRightEdge > areaRightInContainer ? boxRightEdge - areaRightInContainer : 0;
      crosshair.style.left = `${clientX - containerRect.left}px`;
      crosshair.style.visibility = "visible";
      setBoxMargin({ left: marginLeft, right: marginRight });
      const date = new Date(displayData[i].time * 1000);
      const dateStr = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      setHoveredPoint({ value: investmentValues[i], date: dateStr });
    } else {
      crosshair.style.visibility = "hidden";
      setHoveredPoint(null);
    }
  };

  const handleChartMouseLeave = () => {
    const crosshair = crosshairRef.current;
    if (crosshair) crosshair.style.visibility = "hidden";
    setHoveredPoint(null);
  };

  const handleCalculate = async () => {
    const symbol = (symbolRef.current?.value ?? "").trim().toUpperCase();
    const amt = parseFloat(amount);
    if (!symbol || isNaN(amt) || amt <= 0) {
      setError("Please enter amount and symbol.");
      return;
    }

    setError(null);
    setLoading(true);
    setChartData([]);
    setCurrentValue(null);
    setEffectiveStartDate("");
    setCalculatedSymbol("");

    try {
      const parsed = parseMonthYear(startDate);
      let url: string;
      if (parsed) {
        const startDateFull = `${parsed}-01`;
        const start = new Date(startDateFull);
        const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        const interval = years > 2 ? "1wk" : "1d";
        url = `/chart/${encodeURIComponent(symbol)}?start=${startDateFull}&interval=${interval}`;
      } else {
        url = `/chart/${encodeURIComponent(symbol)}?period=max&interval=1wk`;
      }
      const res = await apiFetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Failed to fetch data");
      }
      const payload = (await res.json()) as { data?: { time: number; close: number }[] };
      const data = payload.data ?? [];
      if (data.length === 0) {
        throw new Error("No historical data for this symbol.");
      }

      const firstClose = data[0].close;
      const lastClose = data[data.length - 1].close;
      const shares = amt / firstClose;
      const valueToday = shares * lastClose;

      const firstDate = new Date(data[0].time * 1000);
      const effectiveDateStr = parsed
        ? formatMonthYear(startDate)
        : firstDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

      setCurrentValue(valueToday);
      setEffectiveStartDate(effectiveDateStr);
      setCalculatedSymbol(symbol);
      setChartData(data.map((d) => ({ time: d.time, close: d.close })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const chartJsData = useMemo(
    () => ({
      labels: displayData.map((d) => {
        const date = new Date(d.time * 1000);
        return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      }),
      datasets: [
        {
          label: "Investment value",
          data: investmentValues,
          borderColor: "rgb(16, 185, 129)",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.2,
        },
      ],
    }),
    [displayData, investmentValues]
  );

  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        },
        y: {
          display: true,
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            callback: (v) => (typeof v === "number" ? formatCurrency(v, true) : v),
          },
        },
      },
    }),
    []
  );

  const startDateDisplay = effectiveStartDate || (startDate ? formatMonthYear(startDate) : "");

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground mb-6">
        See what your investment would be worth today if you had bought a stock in a specific month.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Amount ($)
          </label>
          <input
            type="number"
            min="1"
            step="1"
            placeholder="100"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Symbol
          </label>
          <input
            ref={symbolRef}
            type="text"
            placeholder="AAPL, BTC-USD, ETH-USD..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">
            Start month <span className="text-muted-foreground/70">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Jan 2013 or 2013-01"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty for earliest available date.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5 invisible">
            Calculate
          </label>
          <Button
            onClick={handleCalculate}
            disabled={loading}
            className="w-full rounded-lg"
          >
            {loading ? "Calculating..." : "Calculate"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-rose-500 mb-4">{error}</p>
      )}

      {currentValue != null && chartData.length > 0 && (
        <>
          <p className="text-base text-foreground mb-6">
            If you invested{" "}
            <span className="font-semibold">${parseFloat(amount).toLocaleString()}</span> into{" "}
            <span className="font-semibold">{calculatedSymbol}</span> in{" "}
            <span className="font-semibold">{startDateDisplay}</span>, today it would be{" "}
            <span className="font-semibold text-emerald-600">{formatCurrency(currentValue)}</span>.
          </p>
          <div ref={containerRef} className="relative h-80" onMouseMove={handleChartMouseMove} onMouseLeave={handleChartMouseLeave}>
            <Line
              ref={(r) => { chartRef.current = r ?? null; }}
              data={chartJsData}
              options={chartOptions}
            />
            <div
              ref={crosshairRef}
              className="absolute top-0 bottom-0 w-px pointer-events-none transition-[left] duration-100 ease-out"
              style={{ left: 0, visibility: "hidden" }}
            >
              <div className="absolute inset-0 border-l border-dashed border-slate-400/50" />
              {hoveredPoint != null && (
                <div
                  ref={boxRef}
                  className="absolute left-1/2 -top-6 pointer-events-none whitespace-nowrap rounded-md bg-background px-2 py-1 text-xs font-semibold shadow-sm border border-border transition-all duration-100 ease-out"
                  style={{
                    transform: `translateX(calc(-50% + ${boxMargin.left}px - ${boxMargin.right}px))`,
                  }}
                >
                  {formatCurrency(hoveredPoint.value)}  {hoveredPoint.date}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
