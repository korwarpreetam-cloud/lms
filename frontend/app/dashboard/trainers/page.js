export default function Page() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />
      <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#4A3ABA]/5" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#F5A623]/5" />
      
      <div className="relative z-10 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-[#4A3ABA]/10 text-[#4A3ABA] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-50">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">Trainer Management</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The Trainer Management portal is currently being synchronized with our core database. All layouts, permissions, and security configurations are fully prepared.
        </p>
        <div className="inline-flex items-center gap-2 bg-[#F5A623]/10 text-[#E09000] px-4 py-2 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-ping" />
          Ready for Database Bindings
        </div>
      </div>
    </div>
  );
}
