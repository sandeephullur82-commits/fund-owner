import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface BackToHomeButtonProps {
  dark?: boolean;
}

export default function BackToHomeButton({ dark = true }: BackToHomeButtonProps) {
  return (
    <Link
      to="/"
      aria-label="Back to FundCircle"
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5",
        "text-sm font-medium transition-all cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        dark
          ? "border-white/15 text-white/55 hover:border-white/30 hover:text-white/80 hover:bg-white/[0.06] focus-visible:ring-white/30 focus-visible:ring-offset-transparent"
          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400",
      ].join(" ")}
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
      <span>Back to FundCircle</span>
    </Link>
  );
}
