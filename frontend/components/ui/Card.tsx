import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  hoverEffect?: boolean;
  accentBar?: boolean;
  glass?: boolean;
};

export function Card({
  children,
  className = "",
  hoverEffect = false,
  accentBar = false,
  glass = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 ${
        hoverEffect ? "hover:shadow-md hover:-translate-y-0.5" : ""
      } ${glass ? "backdrop-blur-md bg-white/80" : ""} ${className}`}
      {...props}
    >
      {accentBar && (
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />
      )}
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`flex flex-col space-y-1.5 pb-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = "", ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={`text-lg font-bold tracking-tight text-gray-900 ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={`text-sm text-gray-500 ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`${className}`} {...props}>
      {children}
    </div>
  );
}
