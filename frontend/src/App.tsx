import { useEffect, useState, useRef } from "react";
import { Briefcase, Eye, Home, LogOut, PanelLeft } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "./components/ui/button";

const navBase = "flex items-center rounded-xl py-4 text-left text-base font-medium";
const navPad = (open: boolean) => (open ? "px-5" : "justify-center px-0");

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [showLogoutPopup, setShowLogoutPopup] = useState(false);
  const sidebarWidth = sidebarOpen ? "20rem" : "6rem";
  const navigate = useNavigate();
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUserEmail(localStorage.getItem("user_email"));
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

  const handleLogout = () => {
    localStorage.removeItem("user_email");
    navigate("/login");
  };

  return (
    <div
      className="h-screen bg-background overflow-hidden"
      style={{ "--sidebar-width": sidebarWidth } as React.CSSProperties}
    >
      <div className="h-full">
        <aside
          className={`fixed inset-y-0 left-0 shrink-0 border-r border-border bg-card pb-8 pt-0 transition-all duration-300 flex flex-col ${
            sidebarOpen ? "w-80 px-8" : "w-24 px-5"
          }`}
        >
          <div className="mb-10 flex flex-col gap-4 pt-5">
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

          {/* Bottom Section: User Email */}
          <div className="mt-auto pt-4 relative" ref={popupRef}>
            {sidebarOpen && userEmail ? (
              <button
                onClick={() => setShowLogoutPopup(!showLogoutPopup)}
                className="w-full rounded-xl border border-border bg-muted/40 p-4 hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
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
            ) : userEmail ? (
              <button
                onClick={() => setShowLogoutPopup(!showLogoutPopup)}
                className="flex justify-center w-full hover:opacity-80 transition-opacity"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {userEmail.charAt(0).toUpperCase()}
                </div>
              </button>
            ) : null}

            {/* Logout Popup */}
            {showLogoutPopup && (
              <div className={`absolute bottom-full ${sidebarOpen ? 'left-0 right-0' : 'left-1/2 -translate-x-1/2'} bg-card border border-border rounded-xl overflow-hidden z-50`}>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Log out</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        <div
          className="h-full overflow-y-auto px-8 py-8"
          style={{ marginLeft: sidebarWidth, transition: "margin-left 300ms ease" }}
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}