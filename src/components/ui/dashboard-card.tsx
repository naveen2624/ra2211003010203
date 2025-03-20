import React from "react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export default function DashboardCard({
  title,
  children,
  className,
  footer,
}: DashboardCardProps) {
  return (
    <div
      className={cn("bg-white rounded-lg shadow-md overflow-hidden", className)}
    >
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
      {footer && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          {footer}
        </div>
      )}
    </div>
  );
}
