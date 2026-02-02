import { useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Portfolio() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalised = query.trim();
    if (!normalised) {
      return;
    }
    navigate(`/market/${normalised.toLowerCase()}`);
  }

  return (
    <div className="pt-24 pb-24">
      <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex h-24 items-center justify-between gap-6 px-8">
          <div className="flex flex-1 items-center justify-center py-1">
            <div className="relative w-full max-w-lg">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <form onSubmit={handleSubmit}>
                <input
                  className="h-12 w-full rounded-full border border-border bg-card px-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </form>
            </div>
          </div>
        </div>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">My Portfolio</h1>
        </div>
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        {["Orders", "Manual Trades", "Market Open"].map((label) => (
          <span
            key={label}
            className="rounded-full border border-border bg-card px-4 py-1 text-xs text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center">
        <img src="/pi-chart.png" alt="Portfolio chart" className="h-64 w-64" />
        <h2 className="mt-6 text-xl font-semibold">Your portfolio is empty</h2>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          Start exploring investment opportunities by copying people and investing in markets or
          SmartPortfolios.
        </p>
      </div>

      <div className="fixed bottom-0 z-30 left-[var(--sidebar-width)] right-0 border-t border-border/40 bg-card/95 backdrop-blur transition-[left] duration-300 ease-in-out">
        <div className="grid grid-cols-7 items-center gap-2 px-8 py-4 text-center">
          <div>
            <div className="text-lg font-semibold">$0.00</div>
            <div className="text-xs text-muted-foreground">Cash Available</div>
          </div>
          <div className="text-2xl text-muted-foreground">+</div>
          <div>
            <div className="text-lg font-semibold">$0.00</div>
            <div className="text-xs text-muted-foreground">Total Invested</div>
          </div>
          <div className="text-2xl text-muted-foreground">+</div>
          <div>
            <div className="text-lg font-semibold">$0.00</div>
            <div className="text-xs text-muted-foreground">Profit/Loss</div>
          </div>
          <div className="text-2xl text-muted-foreground">=</div>
          <div>
            <div className="text-lg font-semibold">$0.00</div>
            <div className="text-xs text-muted-foreground">Portfolio Value</div>
          </div>
        </div>
      </div>
    </div>
  );
}
