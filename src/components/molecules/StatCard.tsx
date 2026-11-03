// components/molecules/StatCard.tsx
import React from "react";

export interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClass: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: StatCardProps) {
  return (
    <div className="relative flex items-center justify-between rounded-md border border-purple-200 bg-white p-4 shadow-xs transition-all hover:border-purple-300 hover:shadow-md">
      
      {/* Left Edge: Half-Height Centered Purple Border */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1/2 w-[2px] bg-purple-600 rounded-r" />

      {/* Main Content Area */}
      <div className="pl-2">
        <p className="text-sm font-bold text-slate-700">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-slate-600">
          {value.toLocaleString("en-IN")}
        </p>
      </div>

      {/* Icon Badge */}
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${iconClass}`}>
        <Icon size={18} />
      </div>

    </div>
  );
}