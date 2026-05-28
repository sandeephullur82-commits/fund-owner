import React from "react";

/**
 * BrandMark — compact logo for light-background surfaces (sidebars, navbars, headers).
 * Wraps the full logo image in a dark rounded pill so the white text stays visible.
 */
export function BrandMark({
  size = "md",
  className = "",
}: {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const heights: Record<string, string> = {
    xs: "h-5",
    sm: "h-7",
    md: "h-9",
    lg: "h-11",
  };
  return (
    <div
      className={`inline-flex items-center shrink-0 bg-[#0d1225] rounded-xl px-3 py-1.5 shadow-sm ${className}`}
    >
      <img
        src="/fundcircle-logo-full.png"
        alt="FundCircle"
        className={`${heights[size]} w-auto object-contain`}
        draggable={false}
      />
    </div>
  );
}

/**
 * BrandLogo — full-size logo for dark-background pages (auth, splash, onboarding).
 * Renders the image directly without a wrapper — the page itself provides the dark bg.
 */
interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const logoHeights: Record<string, string> = {
  sm: "h-14",
  md: "h-20",
  lg: "h-28",
};

export default function BrandLogo({ size = "md", className = "" }: BrandLogoProps) {
  return (
    <div className={`flex justify-center ${className}`}>
      <img
        src="/fundcircle-logo-full.png"
        alt="FundCircle"
        className={`${logoHeights[size]} w-auto object-contain`}
        draggable={false}
      />
    </div>
  );
}
