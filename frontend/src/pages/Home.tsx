import { useState } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = query.trim();
    if (!normalized) {
      return;
    }
    navigate(`/market/${normalized.toLowerCase()}`);
  };

  return (
    <div>
      <header className="flex items-center justify-between gap-6">
        <div className="flex flex-1 items-center justify-center">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <form onSubmit={handleSubmit}>
              <input
                className="w-full rounded-full border border-border bg-card px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
          </div>
        </div>
      </header>
      <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
        Select Watchlist to view the market dashboard.
      </div>
    </div>
  );
}
