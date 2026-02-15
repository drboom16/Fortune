import { useEffect, useState, useRef } from "react";
import { Briefcase, Calculator, Eye, LogOut, PanelLeft } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "./components/ui/button";
import { ThemeToggle } from "./components/ui/theme-toggle";
import StockSearchBar from "./components/ui/StockSearchBar";
import { apiFetch } from "./lib/api";

const navBase = "flex h-16 w-full min-h-16 items-center text-left text-base font-medium rounded-xl";

const logout = async () => {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch (err) {
    console.error("Logout error:", err);
  }
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const sidebarWidth = sidebarOpen ? "20rem" : "6rem";

  useEffect(() => {
    setShowContent(false);
    setShowLogoutPopup(false);
    const t = setTimeout(() => setShowContent(true), 300);
    return () => clearTimeout(t);
  }, [sidebarOpen]);
  const navigate = useNavigate();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.user?.email && setUserEmail(data.user.email))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowLogoutPopup(false);
      }
    }

    if (showLogoutPopup) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showLogoutPopup]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div
      className="h-screen bg-background overflow-hidden"
      style={{ "--sidebar-width": sidebarWidth } as React.CSSProperties}
    >
      <div className="fixed top-6 right-8 z-50 flex h-12 items-center">
        <ThemeToggle />
      </div>
      <div className="h-full">
        <aside
          className={`fixed inset-y-0 left-0 shrink-0 border-r border-border bg-card transition-all duration-300 flex flex-col ${
            sidebarOpen ? "w-80" : "w-24"
          }`}
        >
          <div className="flex-1 flex flex-col">
            {/* Header section - Fortune title and toggle always visible */}
            <div className={`mb-10 flex flex-col gap-4 pt-5 ${sidebarOpen ? "px-8" : "px-5"}`}>
              <div className="flex items-center justify-between">
                {sidebarOpen ? (
                  <p className="text-lg uppercase tracking-[0.45em] text-muted-foreground">
                    Fortune
                  </p>
                ) : (
                  <span />
                )}
                <Button
                  variant="ghost"
                  className="h-14 w-14 rounded-xl"
                  onClick={() => {
                    setShowContent(false);
                    setSidebarOpen((open) => !open);
                  }}
                  aria-label="Toggle sidebar"
                >
                  <PanelLeft className="h-7 w-7" />
                </Button>
              </div>
            </div>

            {/* Navigation links - only render after sidebar reaches target width */}
            {showContent && (
              <nav className={`mt-3 flex w-full flex-col gap-2 self-stretch animate-sidebar-content-in ${sidebarOpen ? "px-6" : "px-3"}`}>
                <NavLink
                  to="/watchlist"
                  className={({ isActive }: { isActive: boolean }) =>
                    `${navBase} ${!sidebarOpen ? "justify-center" : ""} ${
                      isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                    }`
                  }
                >
                  {sidebarOpen ? (
                    <span className="w-full whitespace-nowrap pl-6 pr-8">Watchlist</span>
                  ) : (
                    <span className="flex w-full justify-center">
                      <Eye className="h-7 w-7 shrink-0" />
                    </span>
                  )}
                </NavLink>
                <NavLink
                  to="/portfolio/overview"
                  className={({ isActive }: { isActive: boolean }) =>
                    `${navBase} ${!sidebarOpen ? "justify-center" : ""} ${
                      isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                    }`
                  }
                >
                  {sidebarOpen ? (
                    <span className="w-full whitespace-nowrap pl-6 pr-8">Portfolio</span>
                  ) : (
                    <span className="flex w-full justify-center">
                      <Briefcase className="h-7 w-7 shrink-0" />
                    </span>
                  )}
                </NavLink>
                <NavLink
                  to="/portfolio/calculator"
                  className={({ isActive }: { isActive: boolean }) =>
                    `${navBase} ${!sidebarOpen ? "justify-center" : ""} ${
                      isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                    }`
                  }
                >
                  {sidebarOpen ? (
                    <span className="w-full whitespace-nowrap pl-6 pr-8">Investment Calculator</span>
                  ) : (
                    <span className="flex w-full justify-center">
                      <Calculator className="h-7 w-7 shrink-0" />
                    </span>
                  )}
                </NavLink>
              </nav>
            )}
          </div>

          {/* Bottom Section - only render after sidebar reaches target width */}
          {showContent && (
          <div 
            className={`mt-auto bg-card animate-sidebar-content-in ${sidebarOpen ? "px-8" : "px-5"} pt-2 pb-3`}
            ref={popupRef}
          >
            {sidebarOpen && userEmail ? (
              <div className="relative">
                <button
                  onClick={() => setShowLogoutPopup(!showLogoutPopup)}
                  className="w-full flex items-center hover:bg-muted transition-colors rounded-lg text-left p-3"
                >
                  <div className="flex items-center gap-3 w-full">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {userEmail.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                        Account
                      </p>
                      <p className="truncate text-sm font-medium text-foreground">
                        {userEmail}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Logout Popup */}
                {showLogoutPopup && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border border-border rounded-lg overflow-hidden z-40">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : null}
            {sidebarOpen && (
              <p className="text-[10px] text-muted-foreground/80 px-1 pt-2 leading-tight">
                All financial data is derived from Yahoo Finance.
              </p>
            )}
          </div>
          )}
        </aside>

        <header className="fixed top-0 z-30 border-b border-border/40 bg-card/90 backdrop-blur left-[var(--sidebar-width)] right-0 transition-[left] duration-300 ease-in-out">
          <div className="flex items-center justify-between gap-6 px-8 py-6">
            <div className="flex flex-1 items-center justify-center">
              <StockSearchBar className="max-w-lg" />
            </div>
          </div>
        </header>
        <div
          className="h-full overflow-y-auto px-8 pt-36 pb-8"
          style={{ marginLeft: sidebarWidth, transition: "margin-left 300ms ease" }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}