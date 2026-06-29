import React from "react";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "text" | "rect" | "circle";
};

export function Skeleton({
  className = "",
  variant = "rect",
  ...props
}: SkeletonProps) {
  const base = "animate-pulse bg-gray-200";
  const shapes = {
    text: "h-4 w-full rounded-lg",
    rect: "h-16 w-full rounded-2xl",
    circle: "rounded-full",
  };

  return <div className={`${base} ${shapes[variant]} ${className}`} {...props} />;
}

export function MetricSkeleton() {
  return (
    <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col space-y-3">
      <Skeleton variant="text" className="w-24 h-3.5" />
      <Skeleton variant="text" className="w-16 h-8" />
      <Skeleton variant="text" className="w-32 h-3" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="flex items-center space-x-4 py-3 border-b border-gray-100">
      <Skeleton variant="circle" className="w-10 h-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/3 h-4" />
        <Skeleton variant="text" className="w-1/4 h-3" />
      </div>
      <Skeleton variant="rect" className="w-20 h-8 rounded-full shrink-0" />
    </div>
  );
}
