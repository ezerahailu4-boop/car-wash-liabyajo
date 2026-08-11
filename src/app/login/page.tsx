"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Droplet, LogIn, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ROLE_HOME: Record<string, string> = {
  administrator: "/",
  manager: "/",
  store_keeper: "/store",
  washer: "/portal",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setError(
        signInError?.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : signInError?.message ?? "Sign in failed."
      );
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const home = ROLE_HOME[profile?.role ?? "washer"] ?? "/portal";
    router.replace(home);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--accent)] mb-3">
            <Droplet size={22} className="text-white" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--text)]">WashOS</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl p-6 border border-[var(--line)] bg-[var(--panel)] space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-[var(--panel-2)] border border-[var(--line)] outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text)]"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-[var(--panel-2)] border border-[var(--line)] outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text)]"
            />
          </div>

          {error && (
            <p className="text-xs rounded-xl px-3 py-2 bg-[var(--panel-2)] text-[var(--red)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-[var(--accent)] text-[#06201D] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-[var(--muted)] mt-5">
          Forgot your password? Contact an administrator.
        </p>
      </div>
    </div>
  );
}
