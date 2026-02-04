import { useEffect, useState, useRef } from "react";
import { Briefcase, Eye, Home, LogOut, PanelLeft } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "./components/ui/button";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

const navBase = "flex items-center rounded-xl py-4 text-left text-base font-medium";
const navPad = (open: boolean) => (open ? "px-5" : "justify-center px-0");

const logout = async () => {
  const accessToken = localStorage.getItem("access_token");
  const refreshToken = localStorage.getItem("refresh_token");

  if (!accessToken || !refreshToken) return;

  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      credentials: 'include',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
    });
  } catch (err) {
    console.error('Logout error: ', err);
  } finally {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_email");
  }
}

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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div
      className="h-screen bg-background overflow-hidden"
      style={{ "--sidebar-width": sidebarWidth } as React.CSSProperties}
    >
      <div className="h-full">
        <aside
          className={`fixed inset-y-0 left-0 shrink-0 border-r border-border bg-card transition-all duration-300 flex flex-col ${
            sidebarOpen ? "w-80" : "w-24"
          }`}
        >
          <div className="flex-1 flex flex-col">
            {/* Header section */}
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
                  onClick={() => setSidebarOpen((open) => !open)}
                  aria-label="Toggle sidebar"
                >
                  <PanelLeft className="h-7 w-7" />
                </Button>
              </div>
            </div>

            {/* Navigation links */}
            <nav className={`flex flex-col gap-4 ${sidebarOpen ? "px-8" : "px-5"}`}>
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
          </div>

          {/* Bottom Section: User Email or Logout Icon */}
          <div 
            className={`mt-auto bg-card ${sidebarOpen ? "px-8" : "px-5"} pt-2 pb-3`}
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