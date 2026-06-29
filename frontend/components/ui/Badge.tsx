import React from "react";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "primary" | "secondary" | "success" | "danger" | "warning" | "info" | "gray";
  size?: "sm" | "md";
};

export function Badge({
  children,
  className = "",
  variant = "info",
  size = "md",
  ...props
}: BadgeProps) {
  const baseStyles = "inline-flex items-center font-semibold rounded-full transition-colors";

  const variants = {
    primary: "bg-[#4A3ABA]/10 text-[#4A3ABA] hover:bg-[#4A3ABA]/15",
    secondary: "bg-[#F5A623]/10 text-[#E09000] hover:bg-[#F5A623]/15",
    success: "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15",
    danger: "bg-rose-500/10 text-rose-700 hover:bg-rose-500/15",
    warning: "bg-amber-500/10 text-amber-800 hover:bg-amber-500/15",
    info: "bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/15",
    gray: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-[10px] leading-3",
    md: "px-2.5 py-1 text-xs leading-4",
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </span>
  );
}
