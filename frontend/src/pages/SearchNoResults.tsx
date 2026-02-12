import { useSearchParams } from "react-router-dom";
import StockSearchBar from "../components/ui/StockSearchBar";

export default function SearchNoResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";

  return (
    <div>
      <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex h-24 items-center justify-between gap-6 px-8">
          <div className="flex flex-1 items-center justify-center py-1">
            <StockSearchBar className="max-w-lg" />
          </div>
        </div>
      </header>

      <div className="fixed inset-0 flex flex-col items-center justify-center pt-24 left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex flex-col items-center justify-center text-center px-8 max-w-xl">
          <img
            src="/stock-not-found.png"
            alt=""
            className="h-56 w-56 object-contain opacity-90"
            aria-hidden
          />
          <h2 className="mt-8 text-2xl font-semibold text-foreground tracking-tight">
            {query ? (
              <>
                No results for{" "}
                <span className="text-muted-foreground font-medium">&quot;{query}&quot;</span>
              </>
            ) : (
              "No results found"
            )}
          </h2>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-md">
            We couldn&apos;t find any stocks matching your search. Try a ticker symbol
            (e.g. <span className="font-medium text-foreground/80">AAPL</span>) or a company
            name (e.g. <span className="font-medium text-foreground/80">Apple</span>).
          </p>
        </div>
      </div>
    </div>
  );
}
