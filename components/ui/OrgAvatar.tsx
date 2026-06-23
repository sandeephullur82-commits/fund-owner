import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface OrgAvatarProps {
  imageUrl?: string | null;
  name?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  isLoading?: boolean;
}

const sizeMap = {
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-base",
};

export default function OrgAvatar({ imageUrl, name, size = "md", className = "", isLoading = false }: OrgAvatarProps) {
  const sizeClass = sizeMap[size];
  const initial = (name || "O").charAt(0).toUpperCase();

  if (isLoading) {
    return <Skeleton className={`${sizeClass} rounded-xl ${className}`} />;
  }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || "Organization"}
        className={`${sizeClass} rounded-xl object-cover shrink-0 ring-1 ring-black/5 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-xl shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br from-violet-600 to-blue-600 select-none ${className}`}
    >
      {initial}
    </div>
  );
}
