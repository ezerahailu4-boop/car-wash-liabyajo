"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Droplet, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // Supabase exchanges the recovery token in the URL for a session automatically
    // and fires PASSWORD_RECOVERY once ready.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => router.replace("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[var(--accent)] mb-3">
            <Droplet size={22} className="text-white" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--text)]">WashOS</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Set a new password</p>
        </div>

        <div className="rounded-2xl p-6 border border-[var(--line)] bg-[var(--panel)]">
          {done ? (
            <p className="text-sm text-[var(--text)] flex items-center gap-2">
              <CheckCircle2 size={18} className="text-[var(--accent)]" /> Password updated. Redirecting to sign in…
            </p>
          ) : !ready ? (
            <p className="text-sm text-[var(--muted)] flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Verifying reset link…
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">New Password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="min. 8 characters"
                  className="w-full mt-1 rounded-xl px-3 py-2.5 text-sm bg-[var(--panel-2)] border border-[var(--line)] outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text)]"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-[var(--muted)]">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="repeat password"
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
                {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                {loading ? "Saving…" : "Set New Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
