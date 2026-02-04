import { useState, FormEvent } from "react";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface StockSearchBarProps {
  className?: string,
  placeholder?: string,
  onSearch?: (symbol: string) => void;
}

export default function StockSearchBar({ 
  className = "", 
  placeholder = "Search", 
  onSearch 
}: StockSearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextSymbol = query.trim();

    if (nextSymbol) {
      if (onSearch) {
        onSearch(nextSymbol);
      } else {
        navigate(`/market/${nextSymbol.toLowerCase()}`);
      }
    }
  };

  return (
    <div className={`relative w-72 transition-all duration-300 focus-within:w-96 ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <form onSubmit={handleSubmit}>
        <input
          className="h-12 w-full rounded-full border border-border bg-card px-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all duration-300"
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
    </div>
  );
}