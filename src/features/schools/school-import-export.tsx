"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { schoolsKeys } from "@/features/schools/api";

type ImportResult = {
  created: number;
  updated: number;
  skippedForLimit: number;
  warnings: string[];
  errors: string[];
};

type Props = {
  onImported?: () => void;
};

export function SchoolImportExport({ onImported }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  const download = (template: boolean) => {
    const url = template
      ? "/api/schools/export?template=1"
      : "/api/schools/export";
    window.location.assign(url);
  };

  const runImport = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/schools/import", {
        method: "POST",
        body,
      });
      const data = (await res.json().catch(() => ({}))) as ImportResult & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Import failed. Check the file matches the template.",
        );
      }
      await qc.invalidateQueries({ queryKey: schoolsKeys.all });
      onImported?.();

      const parts = [
        data.created > 0 ? `${data.created} added` : null,
        data.updated > 0 ? `${data.updated} updated` : null,
      ].filter(Boolean);
      const summary =
        parts.length > 0 ? parts.join(", ") : "No changes (file may match existing rows).";
      const warn =
        data.skippedForLimit > 0
          ? ` ${data.skippedForLimit} skipped (school limit).`
          : "";
      setMessage({
        tone: "success",
        text: `Import complete: ${summary}.${warn}`,
      });
    } catch (e) {
      setMessage({
        tone: "error",
        text: e instanceof Error ? e.message : "Import failed",
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void runImport(file);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="lg"
            icon="table_chart"
            disabled={busy}
            loading={busy}
          >
            Excel
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => download(true)}>
            Download template
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => download(false)}>
            Export my schools
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => inputRef.current?.click()}>
            Import from Excel…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {message ? (
        <p
          className={`m-0 max-w-xs text-right text-xs font-semibold ${
            message.tone === "error"
              ? "text-[var(--error)]"
              : "text-[var(--tertiary)]"
          }`}
          role="status"
        >
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
