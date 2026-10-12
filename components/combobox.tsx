"use client";
import { useId, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Entity } from "@/lib/types";
export function Combobox({
  entities,
  value,
  onChange,
  label,
}: {
  entities: Entity[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [index, setIndex] = useState(0);
  const id = useId();
  const filtered = entities.filter((e) =>
    e.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")),
  );
  function choose(value: string) {
    onChange(value);
    setOpen(false);
    setSearch("");
  }
  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label
        className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-500"
        htmlFor={id}
      >
        {label}
      </label>
      <button
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setIndex(0);
        }}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left font-semibold focus-visible:outline-emerald-600"
      >
        {entities.find((e) => e.id === value)?.name || "Выберите…"}
        <ChevronDown className="size-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3">
            <Search className="size-4 text-slate-400" />
            <input
              autoFocus
              role="combobox"
              aria-label={`Поиск: ${label}`}
              aria-expanded={true}
              aria-controls={`${id}-list`}
              aria-activedescendant={
                filtered[index] ? `${id}-${index}` : undefined
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setIndex((i) => Math.min(i + 1, filtered.length - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setIndex((i) => Math.max(i - 1, 0));
                }
                if (e.key === "Enter" && filtered[index]) {
                  e.preventDefault();
                  choose(filtered[index].id);
                }
              }}
              placeholder="Начните вводить название"
              className="h-12 min-w-0 flex-1 outline-none"
            />
          </div>
          <div
            id={`${id}-list`}
            role="listbox"
            aria-label={label}
            className="max-h-64 overflow-y-auto p-1"
          >
            {filtered.map((entity, i) => (
              <button
                id={`${id}-${i}`}
                key={entity.id}
                role="option"
                aria-selected={entity.id === value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(entity.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm hover:bg-emerald-50 ${i === index ? "bg-slate-50" : ""}`}
              >
                {entity.name}
                {value === entity.id && (
                  <Check className="size-4 text-emerald-700" />
                )}
              </button>
            ))}
            {!filtered.length && (
              <p className="p-4 text-sm text-slate-500">Ничего не найдено</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
