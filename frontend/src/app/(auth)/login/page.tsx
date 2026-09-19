"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/kit";
import { authService } from "@/services/api";
import { useAuthStore } from "@/store/auth";

const formSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setError("");
      const res = await authService.login(values);
      setAuth(res.user, res.access_token, res.refresh_token);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "Incorrect password or username");
    }
  };

  return (
    <div className="flex min-h-screen overflow-y-auto bg-sand">
      <div className="hidden w-1/2 flex-col justify-between bg-pine p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brass text-lg font-bold text-pine-darker">FF</div>
          <span className="text-xl font-bold text-ivory">FacilityFlow</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight text-ivory">Reliable facility operations,<br />run with clarity.</h2>
          <p className="mt-4 max-w-md text-base text-sand/70">Connect with vetted service providers and track every job from schedule to approval.</p>
        </div>
        <p className="text-xs text-sand/50">© {new Date().getFullYear()} FacilityFlow</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-6 py-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pine text-sm font-bold text-brass">FF</div>
              <span className="text-lg font-bold text-pine">FacilityFlow</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-charcoal">Sign in</h1>
          <p className="mt-1 text-sm text-sage">Welcome back. Access your operations dashboard.</p>
          {error && <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="mt-6 space-y-4">
            <Field label="Email" error={errors.email?.message}>
              <Input placeholder="m@example.com" type="email" autoComplete="username" {...register("email")} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <div className="relative">
                <Input type={showPw ? "text" : "password"} autoComplete="current-password" className="pr-10" {...register("password")} />
                <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sage hover:text-charcoal" aria-label="Toggle password">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
              {isSubmitting ? "Signing in…" : "Sign in"} {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-sage">
            <Link href="/forgot-password" className="font-medium text-pine hover:underline">Forgot password?</Link>
          </p>
          <p className="mt-3 text-center text-sm text-sage">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-pine hover:underline">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

