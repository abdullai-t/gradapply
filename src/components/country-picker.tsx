"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import { cn } from "@/lib/utils";

type Props = {
  label?: string;
  value: string[];
  onChange: (countries: string[]) => void;
  max?: number;
  hint?: string;
};

export function CountryPicker({
  label,
  value,
  onChange,
  max = 5,
  hint,
}: Props) {
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const atMax = value.length >= max;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COUNTRY_OPTIONS.filter((country) => {
      if (selected.has(country)) return false;
      if (!q) return true;
      return country.toLowerCase().includes(q);
    });
  }, [query, selected]);

  const addCountry = (country: string) => {
    if (selected.has(country) || atMax) return;
    onChange([...value, country]);
    setQuery("");
  };

  const removeCountry = (country: string) => {
    onChange(value.filter((c) => c !== country));
  };

  return (
    <div className="space-y-2">
      {label ? (
        <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
          {label}
        </Label>
      ) : null}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search countries…"
        aria-label="Search countries"
        disabled={atMax}
        autoComplete="off"
      />

      <div
        className={cn(
          "overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]",
          atMax && "opacity-60",
        )}
      >
        <ScrollArea className="h-48">
          <ul className="p-1" role="listbox" aria-label="Country options">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-[var(--on-surface-variant)]">
                {query.trim()
                  ? "No countries match your search."
                  : "All matching countries are already selected."}
              </li>
            ) : (
              filtered.map((country) => (
                <li key={country}>
                  <button
                    type="button"
                    role="option"
                    disabled={atMax}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-[var(--on-surface)] transition-colors hover:bg-[var(--surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)] disabled:cursor-not-allowed"
                    onClick={() => addCountry(country)}
                  >
                    <span>{country}</span>
                    <Icon
                      name="add"
                      size={16}
                      className="text-[var(--primary)]"
                      aria-hidden
                    />
                  </button>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </div>

      {hint ? (
        <p className="text-xs text-[var(--on-surface-variant)]">{hint}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {value.map((country) => (
          <span
            key={country}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--secondary-container)]/40 bg-[var(--secondary-container)]/30 px-3 py-1 text-xs font-bold text-[var(--on-secondary-container)]"
          >
            {country}
            <button
              type="button"
              aria-label={`Remove ${country}`}
              onClick={() => removeCountry(country)}
              className="grid h-4 w-4 place-items-center rounded-full hover:bg-black/10"
            >
              <Icon name="close" size={12} />
            </button>
          </span>
        ))}
        {value.length === 0 ? (
          <p className="text-sm italic text-[var(--outline)]">
            Search and click a country to add it.
          </p>
        ) : null}
      </div>

      <p className="text-xs text-[var(--outline)]">
        {value.length} / {max} selected
      </p>
    </div>
  );
}
