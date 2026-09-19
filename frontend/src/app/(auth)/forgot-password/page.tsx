"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/kit";
import { authService, apiError } from "@/services/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try { setError(""); setMessage(""); await authService.forgotPassword(email); setMessage("If an account exists for that email, a reset link has been sent."); } catch (e) { setError(apiError(e)); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-sand p-6"><div className="w-full max-w-sm"><h1 className="text-2xl font-bold text-charcoal">Reset password</h1><p className="mt-1 text-sm text-sage">Enter your email to receive a reset link.</p>{message && <p className="mt-5 rounded-lg bg-pine/10 p-3 text-sm text-pine">{message}</p>}{error && <p className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><Field label="Email"><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Button type="submit" className="w-full">Send reset link</Button></form><Link href="/login" className="mt-5 block text-center text-sm text-pine hover:underline">Back to sign in</Link></div></main>;
}