import { useEffect, useState } from "react";
import { Briefcase, Eye, Home, PanelLeft } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { Button } from "./components/ui/button";

const navBase = "flex items-center rounded-xl py-4 text-left text-base font-medium";
const navPad = (open: boolean) => (open ? "px-5" : "justify-center px-0");

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    setUserEmail(localStorage.getItem("user_email"));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside
          className={`shrink-0 border-r border-border bg-card py-10 transition-all duration-300 ${
            sidebarOpen ? "w-80 px-8" : "w-24 px-5"
          }`}
        >
          <div className="mb-10 flex flex-col gap-4">
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
                onClick={() => setSidebarOpen((open) => !open)}
                aria-label="Toggle sidebar"
              >
                <PanelLeft className="h-7 w-7" />
              </Button>
            </div>
            {sidebarOpen && userEmail ? (
              <p className="text-xs text-muted-foreground">{userEmail}</p>
            ) : null}
          </div>
          <nav className="flex flex-col gap-4">
            <NavLink
              to="/home"
              className={({ isActive }: { isActive: boolean }) =>
                `${navBase} ${navPad(sidebarOpen)} ${
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                }`
              }
            >
              {sidebarOpen ? <span>Home</span> : <Home className="h-7 w-7 shrink-0" />}
            </NavLink>
            <NavLink
              to="/watchlist"
              className={({ isActive }: { isActive: boolean }) =>
                `${navBase} ${navPad(sidebarOpen)} ${
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                }`
              }
            >
              {sidebarOpen ? <span>Watchlist</span> : <Eye className="h-7 w-7 shrink-0" />}
            </NavLink>
            <NavLink
              to="/portfolio"
              className={({ isActive }: { isActive: boolean }) =>
                `${navBase} ${navPad(sidebarOpen)} ${
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                }`
              }
            >
              {sidebarOpen ? <span>Portfolio</span> : <Briefcase className="h-7 w-7 shrink-0" />}
            </NavLink>
          </nav>
        </aside>

        <div className="flex-1 px-8 py-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
