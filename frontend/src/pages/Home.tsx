import StockSearchBar from "../components/ui/StockSearchBar";

export default function Home() {

  return (
    <div className="pt-24">
      <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
        <div className="flex h-24 items-center justify-between px-8">
          <div className="flex flex-1 items-center justify-center">
            <StockSearchBar className="max-w-lg"/>
          </div>
        </div>
      </header>
      <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">
        Select Watchlist to view the market dashboard.
      </div>
    </div>
  );
}
