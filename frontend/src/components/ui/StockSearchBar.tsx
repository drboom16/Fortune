import { useState, FormEvent, useEffect, useRef } from "react";
import { Search, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const SEARCH_CACHE_KEY = "fortune_search_history";
const MAX_CACHED = 3;

interface StockSearchBarProps {
  className?: string,
  placeholder?: string,
  onSearch?: (symbol: string) => void;
}

interface SearchResult {
  symbol: string;
  shortName?: string;
  longName?: string;
  exchange?: string;
}

interface CachedLookup {
  symbol: string;
  name: string;
}

function loadSearchCache(): CachedLookup[] {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedLookup[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CACHED) : [];
  } catch {
    return [];
  }
}

function saveSearchCache(items: CachedLookup[]) {
  try {
    localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(items.slice(0, MAX_CACHED)));
  } catch {
    // ignore
  }
}

function addToCache(symbol: string, name: string) {
  const cache = loadSearchCache();
  const next: CachedLookup = { symbol, name: name || symbol };
  const filtered = cache.filter((x) => x.symbol.toUpperCase() !== symbol.toUpperCase());
  saveSearchCache([next, ...filtered]);
}

export default function StockSearchBar({ 
  className = "", 
  placeholder = "Search", 
  onSearch 
}: StockSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [cacheOpen, setCacheOpen] = useState(false);
  const [cached, setCached] = useState<CachedLookup[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCached(loadSearchCache());
  }, []);

  useEffect(() => {
    return () => {
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setCacheOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchStocks = async (q: string): Promise<SearchResult[]> => {
    const trimmed = q.trim();
    if (!trimmed) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(trimmed)}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { results: SearchResult[] };
      return data.results ?? [];
    } catch {
      return [];
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;

    setCacheOpen(false);
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setQuery("");

    if (onSearch) {
      const results = await searchStocks(q);
      const symbol = results.length > 0 ? results[0].symbol : q.toUpperCase();
      if (symbol) onSearch(symbol);
      return;
    }

    setResolving(true);
    const results = await searchStocks(q);
    setResolving(false);
    if (results.length > 0) {
      const { symbol, shortName, longName } = results[0];
      const name = longName || shortName || symbol;
      addToCache(symbol, name);
      setCached(loadSearchCache());
      navigate(`/market/${symbol.toLowerCase()}`);
    } else {
      navigate(`/search/no-results?q=${encodeURIComponent(q)}`);
    }
  };

  const handleCacheItemSelect = (item: CachedLookup) => {
    setCacheOpen(false);
    inputRef.current?.blur();
    if (onSearch) {
      onSearch(item.symbol);
    } else {
      navigate(`/market/${item.symbol.toLowerCase()}`);
    }
  };

  const handleFocus = () => {
    setCached(loadSearchCache());
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    dropdownTimeoutRef.current = setTimeout(() => {
      dropdownTimeoutRef.current = null;
      setCacheOpen(true);
    }, 300);
  };

  const handleBlur = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setCacheOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-72 transition-all duration-300 focus-within:w-96 ${className}`}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
      <form onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className="h-12 w-full rounded-full border border-border bg-card px-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-300 disabled:opacity-70"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={resolving}
        />
      </form>
      {cacheOpen && cached.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
          <div className="py-1">
            {cached.map((item) => (
              <button
                key={item.symbol}
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors text-sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleCacheItemSelect(item);
                }}
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-semibold text-foreground">{item.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate w-full">{item.name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}