
"use client";
import { useState, FormEvent } from "react";
import { withBasePath } from "@/config/base-path";
import {
    ShieldCheck,
    Mail,
    LockKeyhole,
    Eye,
    EyeOff,
    Loader2,
    ArrowRight,
} from "lucide-react";

interface LoginResponse {
    success: boolean;
    message?: string;
    admin?: {
        fullName: string;
        email: string;
        role: string;
    };
}

export default function AdminLoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    async function handleLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (isLoading) return;

        setError("");

        if (!email.trim() || !password) {
            setError("Please enter your email and password.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError("Please enter a valid email address.");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(withBasePath("/api/admin/login"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    password,
                }),
            });

            const data: LoginResponse = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Invalid email or password.");
                return;
            }

            if (!data.admin?.role) {
                setError("Unable to identify your admin role.");
                return;
            }

            switch (data.admin.role) {
                case "SUPER_ADMIN":
                case "REGISTRATION_ADMIN":
                    window.location.assign(withBasePath("/admin/dashboard"));
                    break;

                case "ENTRY_SCANNER":
                    window.location.assign(withBasePath("/entry-scanner"));
                    break;

                case "FOOD_SCANNER":
                    window.location.assign(withBasePath("/food-scanner"));
                    break;

                default:
                    setError("Your account does not have a valid portal role.");
                    break;
            }
        } catch {
            setError("Unable to connect to the server. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-10">

            {/* Background decoration */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-purple-100/60 blur-3xl" />
                <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-violet-100/60 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">

                {/* Brand */}
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-700 text-white shadow-lg shadow-purple-700/20">
                        <ShieldCheck size={25} strokeWidth={1.8} />
                    </div>

                    <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                        Seaise Gala Event
                    </h1>

                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-purple-600">
                        Administration Portal
                    </p>
                </div>

                {/* Login Card */}
                <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/[0.04] sm:p-8">

                    <div className="mb-7">
                        <h2 className="text-lg font-semibold text-slate-900">
                            Welcome back
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Sign in to access your administration portal.
                        </p>
                    </div>

                    <form onSubmit={handleLogin} noValidate className="space-y-5">

                        {/* Email */}
                        <div>
                            <label
                                htmlFor="email"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Email Address
                            </label>

                            <div className="relative">
                                <Mail
                                    size={17}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />

                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(event) => {
                                        setEmail(event.target.value);
                                        setError("");
                                    }}
                                    placeholder="admin@company.com"
                                    autoComplete="username"
                                    disabled={isLoading}
                                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:opacity-60"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-slate-700"
                                >
                                    Password
                                </label>
                            </div>

                            <div className="relative">
                                <LockKeyhole
                                    size={17}
                                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                                />

                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value);
                                        setError("");
                                    }}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                    className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 disabled:opacity-60"
                                />

                                <button
                                    type="button"
                                    onClick={() => setShowPassword((previous) => !previous)}
                                    disabled={isLoading}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                                >
                                    {showPassword ? (
                                        <EyeOff size={17} />
                                    ) : (
                                        <Eye size={17} />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div
                                role="alert"
                                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
                            >
                                {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex h-11 w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-lg bg-purple-700 text-sm font-semibold text-white shadow-sm shadow-purple-700/20 transition hover:bg-purple-800 active:bg-purple-900 disabled:cursor-wait disabled:opacity-60"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={17} className="animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign in to your portal
                                    <ArrowRight size={17} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Security note */}
                    <div className="mt-6 flex items-start gap-2.5 border-t border-slate-100 pt-5">
                        <ShieldCheck
                            size={17}
                            className="mt-0.5 shrink-0 text-emerald-600"
                        />

                        <p className="text-xs leading-5 text-slate-500">
                            This is a restricted administration portal.
                            Only authorized personnel can access this system.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-slate-400">
                    Authorized Access Only · Seaise Gala Event Management
                </p>
            </div>
        </main>
    );
}
