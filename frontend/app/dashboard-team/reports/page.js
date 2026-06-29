export default function Page() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />
      <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#4A3ABA]/5" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#F5A623]/5" />
      
      <div className="relative z-10 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-[#4A3ABA]/10 text-[#4A3ABA] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-50">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">Operational Reports</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The operational statistics, grades, and attendance metrics report dashboard is currently compiling data.
        </p>
        <div className="inline-flex items-center gap-2 bg-[#F5A623]/10 text-[#E09000] px-4 py-2 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-ping" />
          Aggregating Operations Data
        </div>
      </div>
    </div>
  );
}
