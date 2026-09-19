"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/kit";
import { authService, apiError } from "@/services/api";

function ResetPasswordForm() {
  const params = useSearchParams(); const router = useRouter();
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (password !== confirm) return setError("Passwords do not match."); try { await authService.resetPassword(params.get("token") || "", password); router.replace("/login"); } catch (e) { setError(apiError(e)); } };
  return <main className="flex min-h-screen items-center justify-center bg-sand p-6"><div className="w-full max-w-sm"><h1 className="text-2xl font-bold text-charcoal">Choose a new password</h1>{error && <p className="mt-5 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<form onSubmit={submit} className="mt-6 space-y-4"><Field label="New password"><Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></Field><Field label="Confirm password"><Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field><Button type="submit" className="w-full">Set new password</Button></form></div></main>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-sand p-6" />}><ResetPasswordForm /></Suspense>;
}