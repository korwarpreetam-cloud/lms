"use client";

import { useState } from "react";
import Image from "next/image";

/* ── SVG Doodle Components ─────────────────────────────────── */

function GlassesIcon({ className, isDarkMode }) {
  const strokeColor = isDarkMode ? "#475569" : "#2D2D2D";
  return (
    <svg
      className={className}
      width="80"
      height="40"
      viewBox="0 0 80 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="20" cy="20" r="14" stroke={strokeColor} strokeWidth="2.5" fill="none" />
      <circle cx="60" cy="20" r="14" stroke={strokeColor} strokeWidth="2.5" fill="none" />
      <path d="M34 20 Q40 14 46 20" stroke={strokeColor} strokeWidth="2.5" fill="none" />
      <path d="M6 20 Q2 16 0 14" stroke={strokeColor} strokeWidth="2.5" fill="none" />
      <path d="M74 20 Q78 16 80 14" stroke={strokeColor} strokeWidth="2.5" fill="none" />
    </svg>
  );
}

function AlarmClockIcon({ className, isDarkMode }) {
  const strokeColor = isDarkMode ? "#475569" : "#2D2D2D";
  return (
    <svg
      className={className}
      width="70"
      height="75"
      viewBox="0 0 70 75"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="35" cy="40" r="25" stroke={strokeColor} strokeWidth="2.5" fill="none" />
      <path d="M35 25 L35 40 L45 45" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M12 15 Q5 8 10 5" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M58 15 Q65 8 60 5" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="10" cy="5" r="4" stroke={strokeColor} strokeWidth="2" fill="none" />
      <circle cx="60" cy="5" r="4" stroke={strokeColor} strokeWidth="2" fill="none" />
      <path d="M25 67 L20 73" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M45 67 L50 73" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function StarBurst({ className, color = "#F5A623" }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill={color}>
      <path d="M12 0 L14 9 L24 12 L14 14 L12 24 L10 14 L0 12 L10 9 Z" />
    </svg>
  );
}

function DottedCurve({ className, isDarkMode }) {
  const strokeColor = isDarkMode ? "#1e293b" : "#CCCCCC";
  return (
    <svg
      className={className}
      width="200"
      height="100"
      viewBox="0 0 200 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 80 Q50 0 100 50 Q150 100 200 20"
        stroke={strokeColor}
        strokeWidth="2"
        strokeDasharray="6 6"
        fill="none"
      />
    </svg>
  );
}

function SmallDots({ className, isDarkMode }) {
  const dotColor = isDarkMode ? "#22c55e" : "#4A3ABA";
  return (
    <svg className={className} width="6" height="6" viewBox="0 0 6 6" fill={dotColor}>
      <circle cx="3" cy="3" r="3" />
    </svg>
  );
}

/* ── Main Page ─────────────────────────────────────────────── */

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(true);

  return (
    <main className={`flex-1 overflow-hidden transition-colors duration-300 ${isDarkMode ? "bg-[#0A0A0C] text-slate-100" : "bg-white text-gray-900"}`}>
      {/* ── Navbar ── */}
      <nav className={`w-full px-6 md:px-12 lg:px-20 py-5 flex items-center justify-between sticky top-0 z-50 border-b backdrop-blur-md transition-all duration-300 ${
        isDarkMode 
          ? "bg-[#0A0A0C]/90 border-slate-900/60 text-slate-100" 
          : "bg-white/80 border-gray-100 text-gray-900"
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? "bg-[#22c55e]" : "bg-[#4A3ABA]"}`}>
            <span className={`font-black text-lg ${isDarkMode ? "text-black" : "text-white"}`}>S</span>
          </div>
          <span className="text-xl font-black tracking-tight">
            solutiions<span className={isDarkMode ? "text-[#22c55e]" : "text-[#4A3ABA]"}>.com</span>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8 font-semibold">
          <a href="#features" className={`text-sm transition-colors ${isDarkMode ? "text-slate-400 hover:text-white" : "text-gray-600 hover:text-[#4A3ABA]"}`}>
            Features
          </a>
          <a href="#services" className={`text-sm transition-colors ${isDarkMode ? "text-slate-400 hover:text-white" : "text-gray-600 hover:text-[#4A3ABA]"}`}>
            Services
          </a>
          <a href="#about" className={`text-sm transition-colors ${isDarkMode ? "text-slate-400 hover:text-white" : "text-gray-600 hover:text-[#4A3ABA]"}`}>
            About
          </a>
          <a href="#contact" className={`text-sm transition-colors ${isDarkMode ? "text-slate-400 hover:text-white" : "text-gray-600 hover:text-[#4A3ABA]"}`}>
            Contact
          </a>
        </div>
        <div className="flex items-center gap-4">
          {/* Light/Dark Toggle Button */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              isDarkMode 
                ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800" 
                : "bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
            aria-label="Toggle Theme Mode"
            title="Toggle theme mode"
          >
            {isDarkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>

          <a href="/login" className={`px-6 py-2.5 rounded-full text-sm font-bold uppercase transition-all duration-300 shadow-md ${
            isDarkMode 
              ? "bg-[#22c55e] text-black hover:bg-[#16a34a] hover:shadow-emerald-950/20" 
              : "bg-[#4A3ABA] text-white hover:bg-[#3A2A9A] shadow-purple-200"
          }`}>
            Login
          </a>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className={`relative w-full py-16 md:py-20 lg:py-24 overflow-hidden transition-colors duration-300 ${isDarkMode ? "bg-[#0A0A0C]" : "bg-white"}`}>
        {/* Dotted curves */}
        <DottedCurve className="absolute top-24 left-[15%] opacity-40 hidden lg:block" isDarkMode={isDarkMode} />
        <DottedCurve className="absolute top-40 right-[10%] opacity-30 rotate-12 hidden lg:block" isDarkMode={isDarkMode} />

        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="relative flex flex-col items-center text-center">
            {/* ── Floating person images ── */}

            {/* Top-left person */}
            <div className="absolute -left-4 md:left-4 lg:left-8 top-0 md:top-4 animate-float hidden md:block">
              <div className={`arch-shape w-28 h-36 lg:w-36 lg:h-44 relative overflow-hidden rounded-t-full border-2 ${
                isDarkMode ? "bg-[#18181b] border-slate-800" : "bg-[#4A3ABA] border-transparent"
              }`}>
                <Image
                  src="/person1.png"
                  alt="Learner"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 112px, 144px"
                />
              </div>
            </div>

            {/* Top-right person */}
            <div className="absolute -right-4 md:right-4 lg:right-8 top-0 md:top-4 animate-float-delayed hidden md:block">
              <div className={`arch-shape w-28 h-36 lg:w-36 lg:h-44 relative overflow-hidden rounded-t-full border-2 ${
                isDarkMode ? "bg-[#18181b] border-slate-800" : "bg-[#F5A623] border-transparent"
              }`}>
                <Image
                  src="/person2.png"
                  alt="Student"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 112px, 144px"
                />
              </div>
            </div>

            {/* Bottom-left person */}
            <div className="absolute left-12 md:left-20 lg:left-32 bottom-4 md:bottom-8 animate-float-delayed hidden md:block">
              <div className={`arch-shape w-24 h-32 lg:w-32 lg:h-40 relative overflow-hidden rounded-t-full border-2 ${
                isDarkMode ? "bg-[#18181b] border-slate-800" : "bg-[#F5A623] border-transparent"
              }`}>
                <Image
                  src="/person4.png"
                  alt="Professional"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 96px, 128px"
                />
              </div>
            </div>

            {/* Bottom-right person */}
            <div className="absolute right-12 md:right-20 lg:right-32 bottom-4 md:bottom-8 animate-float hidden md:block">
              <div className={`arch-shape w-24 h-32 lg:w-32 lg:h-40 relative overflow-hidden rounded-t-full border-2 ${
                isDarkMode ? "bg-[#18181b] border-slate-800" : "bg-[#4A3ABA] border-transparent"
              }`}>
                <Image
                  src="/person3.png"
                  alt="Educator"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 96px, 128px"
                />
              </div>
            </div>

            {/* ── Doodle decorations ── */}
            <GlassesIcon className="absolute top-6 right-[22%] lg:right-[28%] animate-float hidden md:block" isDarkMode={isDarkMode} />
            <AlarmClockIcon className="absolute bottom-10 left-[18%] lg:left-[22%] animate-float-delayed hidden md:block" isDarkMode={isDarkMode} />

            {/* Star bursts */}
            <StarBurst className="absolute top-16 left-[30%] animate-pulse-star" color={isDarkMode ? "#22c55e" : "#F5A623"} />
            <StarBurst className="absolute top-32 right-[30%] animate-pulse-star delay-300" color={isDarkMode ? "#22c55e" : "#4A3ABA"} />
            <StarBurst className="absolute bottom-24 right-[25%] animate-pulse-star delay-500" color={isDarkMode ? "#22c55e" : "#F5A623"} />
            <StarBurst className="absolute bottom-32 left-[28%] animate-pulse-star delay-200" color={isDarkMode ? "#22c55e" : "#4A3ABA"} />
            <StarBurst className="absolute top-48 left-[42%] animate-pulse-star delay-700" color={isDarkMode ? "#22c55e" : "#F5A623"} />

            {/* Small dots */}
            <SmallDots className="absolute top-20 left-[35%] hidden md:block" isDarkMode={isDarkMode} />
            <SmallDots className="absolute top-44 right-[35%] hidden md:block" isDarkMode={isDarkMode} />
            <SmallDots className="absolute bottom-16 left-[40%] hidden md:block" isDarkMode={isDarkMode} />

            {/* ── Main heading ── */}
            <div className="relative z-10 max-w-2xl mx-auto pt-8 pb-6">
              <h1 className="text-6xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight animate-fade-in-up">
                <span className="block">
                  <span className={isDarkMode ? "text-[#22c55e]" : "text-[#4A3ABA]"}>✦</span> Learn.
                </span>
                <span className="block mt-1">Grow.</span>
                <span className="block mt-1">Serve.</span>
              </h1>

              {/* Tagline pill */}
              <div className="mt-6 animate-fade-in-up delay-200 opacity-0" style={{ animationFillMode: 'forwards', animationDelay: '200ms' }}>
                <span className={`inline-flex items-center gap-2 border rounded-full px-6 py-2.5 text-sm font-bold shadow-sm uppercase tracking-wider ${
                  isDarkMode 
                    ? "bg-[#121214] border-slate-800 text-slate-300" 
                    : "bg-gray-100 border-gray-200 text-gray-700"
                }`}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 0L10 6L16 8L10 10L8 16L6 10L0 8L6 6Z" fill={isDarkMode ? "#22c55e" : "#F5A623"} />
                  </svg>
                  Let&apos;s Learn Together
                </span>
              </div>

              {/* Description */}
              <p className={`mt-6 text-base md:text-lg max-w-md mx-auto animate-fade-in-up opacity-0 leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`} style={{ animationFillMode: 'forwards', animationDelay: '400ms' }}>
                A modern LMS platform that empowers organizations to deliver, manage, and track world-class training programs.
              </p>

              {/* ── CTA Buttons ── */}
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up opacity-0" style={{ animationFillMode: 'forwards', animationDelay: '600ms' }}>
                <a
                  href="#use-service"
                  id="cta-use-service"
                  className={`group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-black transition-all duration-300 shadow-xl ${
                    isDarkMode 
                      ? "bg-[#22c55e] text-black hover:bg-[#16a34a] shadow-emerald-950/20" 
                      : "bg-[#4A3ABA] text-white hover:bg-[#3A2A9A] shadow-purple-200"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? "bg-black/10 group-hover:bg-black/20" : "bg-white/20 group-hover:bg-white/30"}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-black/60" : "text-white/70"}`}>Start Learning</div>
                    <div>Use Our Service</div>
                  </div>
                </a>

                <a
                  href="#buy-service"
                  id="cta-buy-service"
                  className={`group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-base font-bold transition-all duration-300 shadow-xl ${
                    isDarkMode 
                      ? "bg-[#121214] text-slate-200 border border-slate-800 hover:bg-slate-900 hover:border-slate-700" 
                      : "bg-[#F5A623] text-gray-900 hover:bg-[#E09000] shadow-amber-200"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isDarkMode ? "bg-white/5 group-hover:bg-white/10" : "bg-white/30 group-hover:bg-white/40"}`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? "text-slate-400" : "text-gray-700/70"}`}>Own Your Platform</div>
                    <div>Buy Our Service</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Bottom spacer for floating images */}
            <div className="h-32 md:h-40 lg:h-48" />
          </div>
        </div>

        {/* Bottom wave divider */}
        <div className="absolute bottom-0 left-0 w-full">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L48 52C96 44 192 28 288 24C384 20 480 28 576 32C672 36 768 36 864 32C960 28 1056 20 1152 20C1248 20 1344 28 1392 32L1440 36V60H0Z" fill={isDarkMode ? "#0A0A0C" : "#F9FAFB"} />
          </svg>
        </div>
      </section>

      {/* ── Services Section ── */}
      <section id="services" className={`py-20 md:py-28 transition-colors duration-300 ${isDarkMode ? "bg-[#121214] border-t border-slate-900/40" : "bg-gray-50"}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="text-center mb-16">
            <span className={`inline-block text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider ${
              isDarkMode ? "bg-emerald-500/10 text-[#22c55e]" : "bg-[#4A3ABA]/10 text-[#4A3ABA]"
            }`}>
              Our Services
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black">
              Choose Your <span className={isDarkMode ? "text-[#22c55e]" : "text-[#4A3ABA]"}>Path</span>
            </h2>
            <p className={`mt-4 text-base md:text-lg max-w-2xl mx-auto font-medium ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
              Whether you want to leverage our platform or own your custom LMS solution, we&apos;ve got you covered.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Use Service Card */}
            <div className={`feature-card relative rounded-3xl p-8 md:p-10 border transition-all group ${
              isDarkMode ? "bg-[#0A0A0C] border-slate-900 text-slate-100" : "bg-white border-gray-100 text-gray-900"
            }`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-3xl ${isDarkMode ? "bg-[#22c55e]" : "bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7]"}`} />
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${
                isDarkMode 
                  ? "bg-slate-900 group-hover:bg-[#22c55e]" 
                  : "bg-[#4A3ABA]/10 group-hover:bg-[#4A3ABA]"
              }`}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors duration-300 ${
                  isDarkMode 
                    ? "text-[#22c55e] group-hover:text-black" 
                    : "text-[#4A3ABA] group-hover:text-white"
                }`}>
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <h3 className="text-2xl font-black mb-3">Use Our Service</h3>
              <p className={`leading-relaxed mb-6 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Get instant access to our fully-managed LMS platform. No setup required — just sign up and start creating courses, enrolling learners, and tracking progress immediately.
              </p>
              <ul className="space-y-3 mb-8">
                {["Instant setup & onboarding", "Cloud-hosted & fully managed", "Pay-as-you-go pricing", "24/7 support & updates"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-semibold">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-emerald-500/10" : "bg-[#4A3ABA]/10"}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke={isDarkMode ? "#22c55e" : "#4A3ABA"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className={isDarkMode ? "text-slate-300" : "text-gray-600"}>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="/login" className={`block w-full py-3.5 rounded-xl font-bold uppercase text-center transition-all duration-300 shadow-lg ${
                isDarkMode 
                  ? "bg-[#22c55e] text-black hover:bg-[#16a34a] shadow-emerald-950/20" 
                  : "bg-[#4A3ABA] text-white hover:bg-[#3A2A9A] shadow-purple-100"
              }`}>
                Start Using Now →
              </a>
            </div>

            {/* Buy Service Card */}
            <div className={`feature-card relative rounded-3xl p-8 md:p-10 border transition-all group ${
              isDarkMode ? "bg-[#0A0A0C] border-slate-900 text-slate-100" : "bg-white border-gray-100 text-gray-900"
            }`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-3xl ${isDarkMode ? "bg-slate-800" : "bg-gradient-to-r from-[#F5A623] to-[#FFC857]"}`} />
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300 ${
                isDarkMode 
                  ? "bg-slate-900 group-hover:bg-slate-800" 
                  : "bg-[#F5A623]/10 group-hover:bg-[#F5A623]"
              }`}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-colors duration-300 ${
                  isDarkMode 
                    ? "text-slate-400 group-hover:text-white" 
                    : "text-[#F5A623] group-hover:text-white"
                }`}>
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              </div>
              <h3 className="text-2xl font-black mb-3">Buy Our Service</h3>
              <p className={`leading-relaxed mb-6 ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Own a fully customized LMS tailored to your brand and requirements. Get a white-label solution deployed on your infrastructure with full source code access.
              </p>
              <ul className="space-y-3 mb-8">
                {["Complete source code ownership", "Custom branding & white-label", "Self-hosted on your servers", "One-time purchase, lifetime use"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-semibold">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? "bg-slate-800" : "bg-[#F5A623]/10"}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke={isDarkMode ? "#cbd5e1" : "#F5A623"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <span className={isDarkMode ? "text-slate-300" : "text-gray-600"}>{item}</span>
                  </li>
                ))}
              </ul>
              <a href="/login" className={`block w-full py-3.5 rounded-xl font-bold uppercase text-center transition-all duration-300 shadow-lg ${
                isDarkMode 
                  ? "bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 shadow-slate-950/20" 
                  : "bg-[#F5A623] text-gray-900 hover:bg-[#E09000] shadow-amber-100"
              }`}>
                Buy Now →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className={`py-20 md:py-28 transition-colors duration-300 ${isDarkMode ? "bg-[#0A0A0C]" : "bg-white"}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="text-center mb-16">
            <span className={`inline-block text-xs font-bold px-4 py-1.5 rounded-full mb-4 uppercase tracking-wider ${
              isDarkMode ? "bg-emerald-500/10 text-[#22c55e]" : "bg-[#F5A623]/10 text-[#E09000]"
            }`}>
              Platform Features
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black">
              Everything You Need to <span className={isDarkMode ? "text-[#22c55e]" : "text-[#4A3ABA]"}>Succeed</span>
            </h2>
            <p className={`mt-4 text-base md:text-lg max-w-2xl mx-auto font-medium ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
              Our LMS comes packed with powerful features designed to make learning engaging, manageable, and measurable.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className={`feature-card rounded-2xl p-7 border transition-all ${
              isDarkMode ? "bg-[#121214] border-slate-900" : "bg-gradient-to-br from-[#4A3ABA]/5 to-white border-[#4A3ABA]/10"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? "bg-[#22c55e]" : "bg-[#4A3ABA]"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? "black" : "white"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Course Management</h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Create, organize, and publish courses with rich multimedia content. Support for video, audio, documents, quizzes, and interactive modules.
              </p>
            </div>

            {/* Feature 2 */}
            <div className={`feature-card rounded-2xl p-7 border transition-all ${
              isDarkMode ? "bg-[#121214] border-slate-900" : "bg-gradient-to-br from-[#F5A623]/5 to-white border-[#F5A623]/10"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? "bg-slate-800 text-white" : "bg-[#F5A623] text-white"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">User Management</h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Manage learners, instructors, and admins with role-based access control. Bulk enrollment, group management, and organizational hierarchies.
              </p>
            </div>

            {/* Feature 3 */}
            <div className={`feature-card rounded-2xl p-7 border transition-all ${
              isDarkMode ? "bg-[#121214] border-slate-900" : "bg-gradient-to-br from-[#4A3ABA]/5 to-white border-[#4A3ABA]/10"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? "bg-[#22c55e]" : "bg-[#4A3ABA]"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? "black" : "white"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Analytics & Reports</h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Track learning progress with detailed dashboards. Completion rates, assessment scores, time-on-task, and custom reports at your fingertips.
              </p>
            </div>

            {/* Feature 4 */}
            <div className={`feature-card rounded-2xl p-7 border transition-all ${
              isDarkMode ? "bg-[#121214] border-slate-900" : "bg-gradient-to-br from-[#F5A623]/5 to-white border-[#F5A623]/10"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? "bg-slate-800 text-white" : "bg-[#F5A623] text-white"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Certificates & Badges</h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Auto-generate certificates upon course completion. Custom badge systems to gamify learning and boost engagement across your organization.
              </p>
            </div>

            {/* Feature 5 */}
            <div className={`feature-card rounded-2xl p-7 border transition-all ${
              isDarkMode ? "bg-[#121214] border-slate-900" : "bg-gradient-to-br from-[#4A3ABA]/5 to-white border-[#4A3ABA]/10"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? "bg-[#22c55e]" : "bg-[#4A3ABA]"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDarkMode ? "black" : "white"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12" y2="18" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Mobile Responsive</h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Learn anywhere, anytime. Fully responsive design that works flawlessly on desktops, tablets, and mobile devices with offline support.
              </p>
            </div>

            {/* Feature 6 */}
            <div className={`feature-card rounded-2xl p-7 border transition-all ${
              isDarkMode ? "bg-[#121214] border-slate-900" : "bg-gradient-to-br from-[#F5A623]/5 to-white border-[#F5A623]/10"
            }`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${isDarkMode ? "bg-slate-800 text-white" : "bg-[#F5A623] text-white"}`}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold mb-2">Enterprise Security</h3>
              <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Bank-grade encryption, SSO integration, GDPR compliance, and row-level security. Your data is protected with industry-leading standards.
              </p>
            </div>
          </div>

          {/* Additional features row */}
          <div className="mt-8 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                ),
                title: "Discussion Forums",
                desc: "Built-in forums for collaborative learning and peer interaction.",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                ),
                title: "Live Sessions",
                desc: "Schedule and host live classes with video conferencing integration.",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                ),
                title: "API & Integrations",
                desc: "Connect with your existing tools via RESTful APIs and webhooks.",
              },
              {
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" />
                  </svg>
                ),
                title: "Multi-Tenant",
                desc: "Support multiple organizations from a single platform instance.",
              },
            ].map((feat) => (
              <div
                key={feat.title}
                className={`feature-card flex items-start gap-4 rounded-xl p-5 border transition-all ${
                  isDarkMode ? "bg-[#121214] border-slate-900" : "bg-gray-50 border-gray-100"
                }`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${isDarkMode ? "bg-slate-900 text-[#22c55e]" : "bg-white text-[#4A3ABA]"}`}>
                  {feat.icon}
                </div>
                <div>
                  <h4 className="font-bold text-sm">{feat.title}</h4>
                  <p className={`text-xs mt-1 ${isDarkMode ? "text-slate-450" : "text-gray-500"}`}>{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About / Stats Section ── */}
      <section id="about" className={`py-20 md:py-24 relative overflow-hidden transition-colors duration-300 ${
        isDarkMode ? "bg-[#121214] border-t border-b border-slate-900/40" : "bg-[#4A3ABA]"
      }`}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/5" />
          <StarBurst className="absolute top-12 left-[10%] animate-pulse-star opacity-30" color="white" />
          <StarBurst className="absolute bottom-20 right-[15%] animate-pulse-star delay-300 opacity-30" color="white" />
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white">
              Trusted by <span className={isDarkMode ? "text-[#22c55e]" : "text-[#FFC857]"}>Thousands</span>
            </h2>
            <p className="mt-4 text-base md:text-lg text-white/70 max-w-2xl mx-auto font-medium">
              Organizations worldwide rely on solutiions.com to power their learning and development programs.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { number: "10K+", label: "Active Learners" },
              { number: "500+", label: "Courses Created" },
              { number: "98%", label: "Completion Rate" },
              { number: "50+", label: "Organizations" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={`text-4xl md:text-5xl font-black ${isDarkMode ? "text-[#22c55e]" : "text-white"}`}>{stat.number}</div>
                <div className="mt-2 text-sm text-white/60 font-semibold uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className={`py-20 md:py-24 transition-colors duration-300 ${isDarkMode ? "bg-[#0A0A0C]" : "bg-gray-50"}`}>
        <div className="max-w-4xl mx-auto px-6 md:px-12 lg:px-20 text-center">
          <div className={`rounded-3xl p-10 md:p-16 border relative overflow-hidden shadow-lg ${
            isDarkMode ? "bg-[#121214] border-slate-900" : "bg-white border-gray-100"
          }`}>
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-[#4A3ABA]/5" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-[#F5A623]/5" />

            <div className="relative z-10">
              <StarBurst className="mx-auto mb-4" color={isDarkMode ? "#22c55e" : "#F5A623"} />
              <h2 className="text-3xl md:text-4xl font-black">
                Ready to Transform Your Learning?
              </h2>
              <p className={`mt-4 text-base md:text-lg max-w-xl mx-auto leading-relaxed ${isDarkMode ? "text-slate-400" : "text-gray-500"}`}>
                Join hundreds of organizations already using solutiions.com to deliver exceptional training experiences.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <a href="/login" className={`px-8 py-4 rounded-xl font-bold uppercase transition-all duration-300 shadow-md ${
                  isDarkMode 
                    ? "bg-[#22c55e] text-black hover:bg-[#16a34a] shadow-emerald-950/20" 
                    : "bg-[#4A3ABA] text-white hover:bg-[#3A2A9A] shadow-purple-200"
                }`}>
                  Use Our Service — Free Trial
                </a>
                <a href="/login" className={`px-8 py-4 rounded-xl font-bold uppercase transition-all duration-300 border-2 ${
                  isDarkMode 
                    ? "bg-transparent text-[#22c55e] border-[#22c55e] hover:bg-[#22c55e] hover:text-black" 
                    : "bg-white text-[#4A3ABA] border-[#4A3ABA] hover:bg-[#4A3ABA] hover:text-white"
                }`}>
                  Buy Custom Solution
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer id="contact" className={`py-16 transition-colors duration-300 ${isDarkMode ? "bg-[#050506] border-t border-slate-950" : "bg-gray-900 text-white"}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20">
          <div className="grid md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${isDarkMode ? "bg-[#22c55e]" : "bg-[#4A3ABA]"}`}>
                  <span className={`font-black text-lg ${isDarkMode ? "text-black" : "text-white"}`}>S</span>
                </div>
                <span className="text-xl font-black tracking-tight">
                  solutiions<span className={isDarkMode ? "text-[#22c55e]" : "text-[#F5A623]"}>.com</span>
                </span>
              </div>
              <p className={`text-sm leading-relaxed ${isDarkMode ? "text-slate-500" : "text-gray-400"}`}>
                Empowering organizations with modern learning management solutions. Learn. Grow. Serve.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-gray-405 mb-4">Platform</h4>
              <ul className="space-y-3 font-semibold">
                {["Features", "Pricing", "Integrations", "API Docs"].map((item) => (
                  <li key={item}>
                    <a href="#" className={`text-sm transition-colors ${isDarkMode ? "text-slate-500 hover:text-white" : "text-gray-500 hover:text-white"}`}>{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-gray-405 mb-4">Company</h4>
              <ul className="space-y-3 font-semibold">
                {["About Us", "Careers", "Blog", "Contact"].map((item) => (
                  <li key={item}>
                    <a href="#" className={`text-sm transition-colors ${isDarkMode ? "text-slate-500 hover:text-white" : "text-gray-500 hover:text-white"}`}>{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-gray-405 mb-4">Legal</h4>
              <ul className="space-y-3 font-semibold">
                {["Privacy Policy", "Terms of Service", "Cookie Policy", "GDPR"].map((item) => (
                  <li key={item}>
                    <a href="#" className={`text-sm transition-colors ${isDarkMode ? "text-slate-500 hover:text-white" : "text-gray-500 hover:text-white"}`}>{item}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={`mt-12 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4 ${isDarkMode ? "border-slate-900/60" : "border-gray-800"}`}>
            <p className={`text-sm ${isDarkMode ? "text-slate-650" : "text-gray-500"}`}>© 2026 solutiions.com. All rights reserved.</p>
            <div className="flex gap-4">
              {/* Social icons */}
              <a href="#" className="w-9 h-9 rounded-full bg-gray-800/20 flex items-center justify-center hover:bg-[#4A3ABA] transition-colors group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 group-hover:text-white">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-gray-800/20 flex items-center justify-center hover:bg-[#4A3ABA] transition-colors group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 group-hover:text-white">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-gray-800/20 flex items-center justify-center hover:bg-[#4A3ABA] transition-colors group">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-400 group-hover:text-white">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
