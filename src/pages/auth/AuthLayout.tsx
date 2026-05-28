import React from "react";
import BrandLogo from "@/components/BrandLogo";

interface AuthLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export default function AuthLayout({ children, maxWidth = "max-w-[440px]" }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[oklch(0.208_0.042_265.755)] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-48 -left-40 h-[650px] w-[650px] rounded-full bg-violet-700/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-48 -right-40 h-[550px] w-[550px] rounded-full bg-blue-600/18 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[320px] w-[320px] rounded-full bg-indigo-500/8 blur-[90px]" />

      <div className={`relative z-10 w-full ${maxWidth}`}>
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" />
        </div>
        {children}
      </div>
    </div>
  );
}
