"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/kit";

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-charcoal">Password Reset Unavailable</h1>
        <p className="mt-1 text-sm text-sage">Email notifications are not configured. Please contact your administrator to reset your password.</p>
        <Link href="/login" className="mt-5 block text-center text-sm text-pine hover:underline">Back to sign in</Link>
      </div>
    </main>
  );
}