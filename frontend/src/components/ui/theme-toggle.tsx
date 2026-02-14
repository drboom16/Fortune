import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./button";
import { cn } from "../../lib/utils";

type Theme = "light" | "dark";

const THEME_KEY = "fortune-theme";

function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  localStorage.setItem(THEME_KEY, theme);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(getTheme());
    setTheme(getTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setThemeState(next);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn("relative h-12 w-12 p-0 shrink-0", className)}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <Sun className="h-5 w-5 scale-0 transition-all dark:scale-100 dark:rotate-0" />
      <Moon className="absolute h-5 w-5 scale-100 transition-all dark:scale-0 dark:-rotate-90" />
    </Button>
  );
}
