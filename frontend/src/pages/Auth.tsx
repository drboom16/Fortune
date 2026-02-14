import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { apiFetch } from "../lib/api";

type AuthResponse = {
  user: { id: number; email: string };
};

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch(`/auth/${mode}`, {
        method: "POST",
        body: { email, password },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Authentication failed");
      }
      const payload = (await response.json()) as AuthResponse;
      setMessage(`Signed in as ${payload.user.email}`);
      navigate("/home");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to authenticate.");
    } finally {
      setLoading(false);
    }
  };

  const refreshSession = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch("/auth/refresh", { method: "POST" });
      if (!response.ok) {
        throw new Error("Refresh failed.");
      }
      setMessage("Session refreshed.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to refresh session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cover bg-center px-6 py-10"
      style={{ backgroundImage: "url(/login-background.jpg)" }}
    >
      <Card className="w-full max-w-md">
        <CardHeader className="relative">
          <span className="mt-2 absolute right-6 top-6 text-sm uppercase tracking-[0.35em] text-muted-foreground">
            Fortune
          </span>
          <CardTitle className="text-2xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </CardTitle>
          <CardDescription className="mt-4 leading-relaxed">
            Sign in to your dashboard or create an account to start tracking your watchlist.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-7 px-8 pb-8">
          <div className="flex gap-2">
            <Button
              variant={mode === "login" ? "default" : "secondary"}
              className="flex-1"
              onClick={() => setMode("login")}
            >
              Login
            </Button>
            <Button
              variant={mode === "register" ? "default" : "secondary"}
              className="flex-1"
              onClick={() => setMode("register")}
            >
              Register
            </Button>
          </div>

          <form className="grid gap-4" onSubmit={submit}>
            <label className="grid gap-2 text-sm">
              Email
              <input
                className="rounded-lg border border-border bg-background px-3 py-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="grid gap-2 text-sm">
              Password
              <input
                className="rounded-lg border border-border bg-background px-3 py-2"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? "Working..." : mode === "login" ? "Login" : "Register"}
            </Button>
          </form>

          <div className="grid gap-2">
            <Button variant="secondary" onClick={refreshSession} disabled={loading}>
              Refresh Session
            </Button>
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
