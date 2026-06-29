"use client";

import React, { useState, useRef, useEffect } from "react";

type DropdownProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
};

export function Dropdown({
  trigger,
  children,
  align = "left",
  className = "",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className={`relative inline-block text-left ${className}`} ref={containerRef}>
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      {open && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} mt-2 w-56 rounded-2xl bg-white border border-gray-100 shadow-xl focus:outline-none z-50 overflow-hidden transform origin-top-right transition-all duration-200 animate-in fade-in zoom-in-95`}
          onClick={() => setOpen(false)}
        >
          <div className="py-1.5">{children}</div>
        </div>
      )}
    </div>
  );
}

type DropdownItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
};

export function DropdownItem({
  children,
  className = "",
  active = false,
  ...props
}: DropdownItemProps) {
  return (
    <button
      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-purple-50 text-[#4A3ABA]"
          : "text-gray-700 hover:bg-gray-50"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
