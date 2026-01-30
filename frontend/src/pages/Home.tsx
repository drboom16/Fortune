import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");

  return (
    <div>
      <header className="flex items-center justify-between gap-6">
        <div className="flex flex-1 items-center justify-center">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="w-full rounded-full border border-border bg-card px-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </header>
      <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
        Select Watchlist to view the market dashboard.
      </div>
    </div>
  );
}
