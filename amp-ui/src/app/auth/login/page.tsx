"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@amp.local");
  const [password, setPassword] = useState("demo123");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) throw new Error(await res.text());

      router.push("/results");
    } catch (err: any) {
      setErrorText(err?.message ?? "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid place-items-center min-h-[60vh]">
      <form
        onSubmit={onSubmit}
        className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm grid gap-3 min-w-[320px]"
      >
        <h1 className="text-xl font-semibold">Sign in</h1>
        <div>
          <div className="text-[12px] font-semibold mb-1 opacity-75">Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <div>
          <div className="text-[12px] font-semibold mb-1 opacity-75">
            Password
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        {errorText && (
          <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2">
            {errorText}
          </div>
        )}
        <button
          disabled={isSubmitting}
          className="inline-flex items-center rounded-lg border border-blue-800 bg-blue-700 text-white px-3 py-2 hover:bg-blue-800"
        >
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
        <div className="text-xs opacity-70">Use demo@amp.local / demo123</div>
      </form>
    </div>
  );
}
