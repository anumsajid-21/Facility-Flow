"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ArrowRight, Building2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/kit";
import { authService } from "@/services/api";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  companyName: z.string().min(2, "Company/Organization name is required"),
  role: z.enum(["HIRING_ORG", "PROVIDER"]),
});


export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [error, setError] = useState("");
  
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      role: "HIRING_ORG",
    }
  });

  const selectedRole = watch("role");

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setError("");
      const res = await authService.register(values);
      setAuth(res.user, res.access_token);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.message || "An error occurred during registration");
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
          <h2 className="text-3xl font-bold leading-tight text-ivory">Streamline your<br />facility operations.</h2>
          <p className="mt-4 max-w-md text-base text-sand/70">Whether you manage properties or provide services, FacilityFlow helps you collaborate and deliver.</p>
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
          <h1 className="text-2xl font-bold text-charcoal">Create your account</h1>
          <p className="mt-1 text-sm text-sage">Start managing facility services in minutes.</p>
          {error && <div className="mt-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <form onSubmit={handleSubmit(onSubmit)} autoComplete="off" className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-charcoal">I want to…</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "HIRING_ORG", label: "Hire a service", icon: Building2 },
                  { key: "PROVIDER", label: "Provide services", icon: Wrench },
                ] as const).map((opt) => {
                  const active = selectedRole === opt.key;
                  const Icon = opt.icon;
                  return (
                    <label key={opt.key} className={cn("flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors", active ? "border-pine bg-pine/5 text-pine" : "border-border bg-ivory text-sage hover:border-brass hover:text-charcoal")}>
                      <input type="radio" value={opt.key} {...register("role")} className="sr-only" />
                      <Icon className={cn("h-5 w-5", active && "text-pine")} />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <Field label="Full name" error={errors.name?.message}>
              <Input placeholder="John Doe" {...register("name")} />
            </Field>
            <Field label="Company / Organization" error={errors.companyName?.message}>
              <Input placeholder="Acme Corp" {...register("companyName")} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <Input placeholder="m@example.com" type="email" autoComplete="off" {...register("email")} />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <Input type="password" placeholder="Min. 8 characters" autoComplete="new-password" {...register("password")} />
              
              {/* Password Strength Indicator */}
              {(() => {
                const pass = watch("password") || "";
                if (!pass) return (
                  <p className="mt-1 text-xs text-sage">At least 8 characters with 1 uppercase, 1 lowercase, 1 number & 1 special character.</p>
                );

                const hasMin = pass.length >= 8;
                const hasUpper = /[A-Z]/.test(pass);
                const hasLower = /[a-z]/.test(pass);
                const hasNum = /[0-9]/.test(pass);
                const hasSpecial = /[^A-Za-z0-9]/.test(pass);

                const score = [hasMin, hasUpper, hasLower, hasNum, hasSpecial].filter(Boolean).length;
                let label = "Weak";
                let colorClass = "bg-rose-500 text-rose-700";
                let bgBarClass = "bg-rose-500";

                if (score >= 5) {
                  label = "Strong";
                  colorClass = "text-emerald-700 font-bold";
                  bgBarClass = "bg-emerald-500";
                } else if (score >= 3) {
                  label = "Medium";
                  colorClass = "text-amber-700 font-bold";
                  bgBarClass = "bg-amber-500";
                } else {
                  label = "Weak";
                  colorClass = "text-rose-700 font-bold";
                  bgBarClass = "bg-rose-500";
                }

                return (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-ivory p-2.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-sage">Password strength:</span>
                      <span className={cn("font-semibold uppercase tracking-wide", colorClass)}>{label}</span>
                    </div>

                    {/* 3-segment meter bar */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className={cn("h-1.5 rounded-full transition-all duration-300", score >= 1 ? bgBarClass : "bg-border")} />
                      <div className={cn("h-1.5 rounded-full transition-all duration-300", score >= 3 ? bgBarClass : "bg-border")} />
                      <div className={cn("h-1.5 rounded-full transition-all duration-300", score >= 5 ? bgBarClass : "bg-border")} />
                    </div>

                    {/* Requirements checklist */}
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px]">
                      <span className={hasMin ? "text-emerald-700 font-medium" : "text-sage"}>{hasMin ? "✓" : "○"} 8+ chars</span>
                      <span className={hasUpper ? "text-emerald-700 font-medium" : "text-sage"}>{hasUpper ? "✓" : "○"} Uppercase</span>
                      <span className={hasLower ? "text-emerald-700 font-medium" : "text-sage"}>{hasLower ? "✓" : "○"} Lowercase</span>
                      <span className={hasNum ? "text-emerald-700 font-medium" : "text-sage"}>{hasNum ? "✓" : "○"} Number</span>
                      <span className={hasSpecial ? "text-emerald-700 font-medium" : "text-sage"}>{hasSpecial ? "✓" : "○"} Special character</span>
                    </div>
                  </div>
                );
              })()}
            </Field>
            <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
              {isSubmitting ? "Creating account…" : "Create account"} {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-sage">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-pine hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
