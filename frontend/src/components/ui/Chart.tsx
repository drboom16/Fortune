import { useEffect, useRef, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions,
  Plugin,
} from "chart.js";
import { Line } from "react-chartjs-2";
import type { ChartData } from "../../data/Mockdata";
import { ArrowUp, ArrowDown } from "lucide-react";

// Custom plugin for vertical crosshair
const crosshairPlugin: Plugin = {
  id: "crosshair",
  afterDraw: (chart) => {
    if (chart.tooltip?.opacity && chart.tooltip.caretX) {
      const ctx = chart.ctx;
      const x = chart.tooltip.caretX;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.stroke();
      ctx.restore();
    }
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  crosshairPlugin
);

interface StockChartProps {
  data: ChartData[];
  symbol: string;
  onPeriodChange?: (period: string) => void;
}

const TIME_PERIODS = [
  { label: "1D", value: "1d", interval: "5m" },
  { label: "1W", value: "5d", interval: "30m" },
  { label: "1M", value: "1mo", interval: "1d" },
  { label: "3M", value: "3mo", interval: "1d" },
  { label: "1Y", value: "1y", interval: "1d" },
  { label: "5Y", value: "5y", interval: "1wk" },
];

export default function StockChart({ data, symbol, onPeriodChange }: StockChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("1mo");
  const chartRef = useRef<ChartJS<"line">>(null);

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  // Process data for chart
  const chartData = {
    labels: data.map((d) => {
      const date = new Date(d.time * 1000);
      if (selectedPeriod === "1d") {
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
      } else if (selectedPeriod === "5d" || selectedPeriod === "1mo") {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      }
      return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    }),
    datasets: [
      {
        label: symbol,
        data: data.map((d) => d.close),
        borderColor: data.length > 0 && data[data.length - 1].close >= data[0].close
          ? "rgb(16, 185, 129)" // emerald-500
          : "rgb(244, 63, 94)", // rose-500
        backgroundColor: data.length > 0 && data[data.length - 1].close >= data[0].close
          ? "rgba(16, 185, 129, 0.1)"
          : "rgba(244, 63, 94, 0.1)",
        borderWidth: 2,
        fill: 'origin',
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: "rgb(255, 255, 255)",
        spanGaps: false,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        enabled: true,
        mode: "index",
        intersect: false,
        position: "nearest",
        backgroundColor: "rgba(30, 41, 59, 0.95)",
        padding: 16,
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(255, 255, 255, 0.2)",
        borderWidth: 1,
        displayColors: false,
        titleFont: {
          size: 13,
          weight: 600,
        },
        bodyFont: {
          size: 15,
          weight: 700,
        },
        callbacks: {
          title: (tooltipItems) => {
            const dataIndex = tooltipItems[0].dataIndex;
            const timestamp = data[dataIndex].time;
            const date = new Date(timestamp * 1000);
            
            if (selectedPeriod === "1d") {
              return date.toLocaleDateString("en-US", { 
                month: "short", 
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              });
            } else if (selectedPeriod === "5d" || selectedPeriod === "1mo") {
              return date.toLocaleDateString("en-US", { 
                month: "short", 
                day: "numeric",
                year: "numeric"
              });
            }
            return date.toLocaleDateString("en-US", { 
              month: "short", 
              day: "numeric",
              year: "numeric"
            });
          },
          label: (context) => {
            const value = context.parsed.y;
            return `$${value?.toFixed(2)}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: false,
        grid: {
          display: false,
        },
        offset: false,
        ticks: {
          maxRotation: 0,
          autoSkip: true,
        },
      },
      y: {
        display: false,
        grid: {
          display: false,
        },
        beginAtZero: false,
        min: undefined,
        grace: '2%',
      },
    },
    layout: {
      padding: {
        left: 0,
        right: 0,
        top: 10,
        bottom: 0,
      },
    },
  };

  // Calculate price change
  const priceChange = data.length > 0 
    ? ((data[data.length - 1].close - data[0].close) / data[0].close) * 100 
    : 0;
  const isPositive = priceChange >= 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Performance</h2>
          {data.length > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`flex items-center gap-1 text-sm font-semibold ${
                  isPositive ? "text-emerald-500" : "text-rose-500"
                }`}
              >
                {isPositive ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />} {isPositive ? "+" : ""}
                {priceChange?.toFixed(2)}%
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
          {TIME_PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => handlePeriodChange(period.value)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                selectedPeriod === period.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="h-[400px] w-full">
        {data.length > 0 ? (
          <Line ref={chartRef} data={chartData} options={options} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No chart data available
          </div>
        )}
      </div>
    </div>
  );
}