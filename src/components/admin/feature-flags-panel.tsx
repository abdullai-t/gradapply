"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type FeatureFlag = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [createKey, setCreateKey] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createEnabled, setCreateEnabled] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadFlags = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/feature-flags", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as
      | { flags?: FeatureFlag[]; error?: string }
      | null;
    if (!res.ok || !data || !Array.isArray(data.flags)) {
      setError(data?.error ?? "Could not load flags.");
      setLoading(false);
      return;
    }
    setFlags(data.flags);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFlags();
  }, [loadFlags]);

  const createFlag = async () => {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/feature-flags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: createKey.trim(),
        name: createName.trim(),
        description: createDescription.trim() || null,
        enabled: createEnabled,
      }),
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!res.ok) {
      setError(data?.error ?? "Could not create flag.");
      setCreating(false);
      return;
    }
    setCreateKey("");
    setCreateName("");
    setCreateDescription("");
    setCreateEnabled(false);
    await loadFlags();
    setCreating(false);
  };

  const toggleFlag = async (flag: FeatureFlag) => {
    setSavingId(flag.id);
    setError(null);
    const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !flag.enabled }),
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!res.ok) {
      setError(data?.error ?? "Could not update flag.");
      setSavingId(null);
      return;
    }
    await loadFlags();
    setSavingId(null);
  };

  const deleteFlag = async (flag: FeatureFlag) => {
    setDeletingId(flag.id);
    setError(null);
    const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!res.ok) {
      setError(data?.error ?? "Could not delete flag.");
      setDeletingId(null);
      return;
    }
    await loadFlags();
    setDeletingId(null);
  };

  return (
    <div className="space-y-5">
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">Feature flags</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Gate features behind runtime toggles and roll out safely.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void loadFlags()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Input
            value={createKey}
            onChange={(e) => setCreateKey(e.target.value)}
            placeholder="flag key (e.g. admin-export)"
          />
          <Input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Display name"
          />
        </div>
        <Textarea
          value={createDescription}
          onChange={(e) => setCreateDescription(e.target.value)}
          placeholder="What does this feature flag control?"
          className="mt-3 min-h-[90px]"
        />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={createEnabled}
            onChange={(e) => setCreateEnabled(e.target.checked)}
          />
          Start enabled
        </label>
        <div className="mt-3">
          <Button
            onClick={() => void createFlag()}
            disabled={creating || !createKey.trim() || !createName.trim()}
          >
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Create flag
          </Button>
        </div>
      </div>

      <div className="glass-panel overflow-x-auto p-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading flags...
          </div>
        ) : (
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2 font-mono text-xs">{flag.key}</td>
                  <td className="px-3 py-2 font-medium">{flag.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {flag.description?.trim() || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {flag.enabled ? (
                      <Badge className="bg-emerald-600/20 text-emerald-200">Enabled</Badge>
                    ) : (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(flag.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingId === flag.id || deletingId === flag.id}
                        onClick={() => void toggleFlag(flag)}
                      >
                        {savingId === flag.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {flag.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={savingId === flag.id || deletingId === flag.id}
                        onClick={() => void deleteFlag(flag)}
                      >
                        {deletingId === flag.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {flags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    No feature flags yet. Create one above.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
