import React, { useState, useRef, useEffect, useCallback } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";

export interface SearchSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  error?: boolean;
  disabled?: boolean;
  clearable?: boolean;
}

export default function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option…",
  searchPlaceholder = "Search…",
  emptyText = "No options found",
  className = "",
  error = false,
  disabled = false,
  clearable = false,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = search.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          (o.sublabel || "").toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    setHighlighted(0);
  }, [search, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted((h) => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlighted]) {
          onChange(filtered[highlighted].value);
          setOpen(false);
        }
      }
    },
    [open, filtered, highlighted, onChange]
  );

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        className={[
          "w-full flex items-center gap-2 h-10 px-3 rounded-lg border text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-400 focus:ring-red-300"
            : open
            ? "border-indigo-400 ring-2 ring-indigo-200"
            : "border-slate-200 focus:ring-indigo-200",
          disabled ? "bg-slate-50 cursor-not-allowed opacity-60" : "bg-white hover:border-slate-300",
        ].join(" ")}
      >
        <span className={`flex-1 truncate ${selected ? "text-slate-900" : "text-slate-400"}`}>
          {selected ? selected.label : placeholder}
        </span>
        {clearable && value && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown
            className={`shrink-0 w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search input */}
          {options.length > 5 && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full h-8 pl-8 pr-3 text-sm bg-slate-50 border border-slate-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:border-indigo-300"
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <ul
            ref={listRef}
            className="overflow-y-auto max-h-56 py-1"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-slate-400 text-center">{emptyText}</li>
            ) : (
              filtered.map((opt, i) => {
                const isActive = opt.value === value;
                const isHighlighted = i === highlighted;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isActive}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={[
                      "flex items-center gap-2 px-3 py-2 cursor-pointer select-none transition-colors",
                      isHighlighted ? "bg-indigo-50" : "",
                      isActive ? "font-semibold" : "",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${isActive ? "text-indigo-700" : "text-slate-900"}`}>
                        {opt.label}
                      </p>
                      {opt.sublabel && (
                        <p className="text-xs text-slate-400 truncate">{opt.sublabel}</p>
                      )}
                    </div>
                    {opt.badge && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                        {opt.badge}
                      </span>
                    )}
                    {isActive && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
