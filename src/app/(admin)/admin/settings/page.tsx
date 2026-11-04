"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Plus, ShieldCheck, ShieldOff } from "lucide-react";
import { withBasePath } from "@/config/base-path";

type EmailDomain = {
  domain: string;
  source: "ADMIN" | "HARDCODED";
  adminPolicy: "ALLOW" | "BLOCK" | null;
  adminRuleActive: boolean | null;
  effectivePolicy: "ALLOW" | "BLOCK" | "NONE";
  isAllowed: boolean;
  canDelete: boolean;
};

export default function SettingsPage() {
  const [domains, setDomains] = useState<EmailDomain[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingDomain, setSavingDomain] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDomains = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(withBasePath("/api/admin/email-domains"), { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to load email domains.");
      setDomains(result.domains);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load email domains.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  async function addDomain(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAdding(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(withBasePath("/api/admin/email-domains"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim().toLowerCase(), policy: "ALLOW" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to add domain.");
      setNewDomain("");
      setMessage("Domain added and enabled for registration.");
      await loadDomains();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add domain.");
    } finally {
      setAdding(false);
    }
  }

  async function setDomainEnabled(domain: string, enabled: boolean) {
    setSavingDomain(domain);
    setError("");
    setMessage("");
    try {
      const response = await fetch(withBasePath("/api/admin/email-domains"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, policy: "ALLOW", isActive: enabled }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Unable to update domain.");
      setMessage(`${domain} ${enabled ? "enabled" : "disabled"} for registration.`);
      await loadDomains();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update domain.");
    } finally {
      setSavingDomain(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Registration email domains</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only enabled domains can receive a registration OTP. Domains that are disabled or not listed will be rejected.
        </p>

        <form onSubmit={addDomain} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={newDomain}
            onChange={(event) => setNewDomain(event.target.value)}
            placeholder="company.com"
            autoComplete="off"
            className="h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm text-slate-800 outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
          />
          <button
            type="submit"
            disabled={adding || !newDomain.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-purple-700 px-4 text-sm font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {adding ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={16} />}
            Add and enable
          </button>
        </form>
      </section>

      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      {message && !error && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">{message}</p>}

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Allowed domain list</h2>
            <p className="mt-0.5 text-xs text-slate-500">{domains.filter((item) => item.isAllowed).length} enabled · {domains.length} listed</p>
          </div>
          <button type="button" onClick={() => void loadDomains()} disabled={loading} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Domain</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source</th>
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Registration OTP</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Enable / Disable</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500"><LoaderCircle size={20} className="mx-auto mb-2 animate-spin" />Loading domains…</td></tr>
              ) : domains.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">No domains have been added.</td></tr>
              ) : domains.map((item) => (
                <tr key={item.domain} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-mono text-sm text-slate-800">@{item.domain}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{item.source === "ADMIN" ? "Admin added" : "Default list"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${item.isAllowed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {item.isAllowed ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
                      {item.isAllowed ? "Accepted" : "Rejected"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={item.isAllowed}
                      aria-label={`${item.isAllowed ? "Disable" : "Enable"} ${item.domain}`}
                      disabled={savingDomain === item.domain}
                      onClick={() => void setDomainEnabled(item.domain, !item.isAllowed)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition disabled:opacity-50 ${item.isAllowed ? "bg-emerald-600" : "bg-slate-300"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white transition ${item.isAllowed ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
