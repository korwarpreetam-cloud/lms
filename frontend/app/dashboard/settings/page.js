export default function Page() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623]" />
      <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-[#4A3ABA]/5" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 rounded-full bg-[#F5A623]/5" />
      
      <div className="relative z-10 text-center max-w-md">
        <div className="w-20 h-20 rounded-2xl bg-[#4A3ABA]/10 text-[#4A3ABA] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-50">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852 1.003 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-3">Platform Settings</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The Platform Settings portal is currently being synchronized with our core database. All layouts, permissions, and security configurations are fully prepared.
        </p>
        <div className="inline-flex items-center gap-2 bg-[#F5A623]/10 text-[#E09000] px-4 py-2 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#F5A623] animate-ping" />
          Ready for Database Bindings
        </div>
      </div>
    </div>
  );
}
