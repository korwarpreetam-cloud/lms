"use client";

import React, { useState, useEffect } from "react";
import { useToast } from "../../../hooks/useToast";

interface Lecture {
  id: string;
  title: string;
  duration: string;
  videoUrl: string;
  description: string;
  status: "completed" | "active" | "upcoming";
}

const LECTURES: Lecture[] = [
  {
    id: "lec-1",
    title: "1. Course Foundations & Setup",
    duration: "14:20",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    description: "Learn the core prerequisites of the course, configure your local environment, and setup your Git workspace.",
    status: "completed",
  },
  {
    id: "lec-2",
    title: "2. HTML5 Semantics & CSS Layouts",
    duration: "22:15",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    description: "Deep dive into Flexbox and Grid, semantic accessibility guidelines, and modern responsive design patterns.",
    status: "completed",
  },
  {
    id: "lec-3",
    title: "3. React State & Component Lifecycle",
    duration: "30:45",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    description: "Master interactive UI controls, user input form validations, and conditional rendering using React hooks.",
    status: "active",
  },
  {
    id: "lec-4",
    title: "4. Next.js App Router Structure",
    duration: "25:30",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
    description: "Understand page rendering patterns, layout files, standard routing middleware, and server component concepts.",
    status: "upcoming",
  },
  {
    id: "lec-5",
    title: "5. Supabase Integration & RLS Rules",
    duration: "28:10",
    videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
    description: "Secure database bindings, setup Row-Level Security (RLS) policies, and trigger custom token claims.",
    status: "upcoming",
  },
];

export default function CoursesPage() {
  const { showToast } = useToast();
  const [activeLecture, setActiveLecture] = useState<Lecture>(LECTURES[2]); // Default to the active React lecture
  const [notes, setNotes] = useState("");

  // Load notes from localStorage whenever active lecture changes
  useEffect(() => {
    const savedNotes = localStorage.getItem(`lms-notes-${activeLecture.id}`) || "";
    setNotes(savedNotes);
  }, [activeLecture]);

  const handleSaveNotes = () => {
    localStorage.setItem(`lms-notes-${activeLecture.id}`, notes);
    showToast("Notes saved successfully!", "success");
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#4A3ABA] via-[#6B5CE7] to-[#F5A623] rounded-3xl p-6 text-white relative overflow-hidden shadow-md">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">Courses Curriculum & Video Hub</h1>
          <p className="text-sm text-white/90 mt-1 max-w-2xl">
            Watch recorded lectures, access reference materials, and save notes directly inside your dashboard.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Video Player & Note Taking */}
        <div className="lg:col-span-2 space-y-6">
          {/* Video Player Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#4A3ABA] to-[#6B5CE7]" />
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">{activeLecture.title}</h2>
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black shadow-inner group">
                <video
                  key={activeLecture.id}
                  src={activeLecture.videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  poster="/api/placeholder/800/450"
                  autoPlay
                />
              </div>
              <p className="text-sm text-gray-500 mt-4 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-150">
                <span className="font-bold text-[#4A3ABA] block mb-1">Lecture Overview</span>
                {activeLecture.description}
              </p>
            </div>
          </div>

          {/* Notes Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#F5A623]" />
            <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-[#F5A623]">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Class Notes & Textbook Work
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              Write summaries, key code snippets, or notes here. Your progress is auto-saved locally.
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Start taking notes for this lecture here..."
              rows={6}
              className="w-full px-4 py-3 rounded-2xl border-2 border-gray-200 bg-white text-sm focus:border-[#4A3ABA] focus:ring-4 focus:ring-[#4A3ABA]/10 outline-none text-gray-900 transition-all font-medium resize-y"
            />
            <div className="flex justify-between items-center mt-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Word Count: {notes.trim() === "" ? 0 : notes.trim().split(/\s+/).length}
              </span>
              <button
                onClick={handleSaveNotes}
                className="bg-[#4A3ABA] text-white hover:bg-[#3A2A9A] px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-100 uppercase tracking-wider flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Notes
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Lecture Playlist */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#6B5CE7]" />
            <h3 className="text-lg font-bold text-gray-900 mb-4">Lecture Syllabus</h3>
            
            <div className="space-y-3">
              {LECTURES.map((lec) => {
                const isActive = activeLecture.id === lec.id;
                return (
                  <button
                    key={lec.id}
                    onClick={() => setActiveLecture(lec)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex flex-col gap-2 group cursor-pointer ${
                      isActive
                        ? "border-[#4A3ABA] bg-purple-50/50"
                        : "border-gray-100 hover:border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <h4 className={`font-bold text-sm transition-colors ${
                        isActive ? "text-[#4A3ABA]" : "text-gray-800 group-hover:text-gray-950"
                      }`}>
                        {lec.title}
                      </h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        lec.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : lec.status === "active"
                          ? "bg-purple-100 text-[#4A3ABA] animate-pulse"
                          : "bg-gray-100 text-gray-500"
                      }`}>
                        {lec.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400 font-semibold w-full mt-1">
                      <div className="flex items-center gap-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{lec.duration} mins</span>
                      </div>
                      
                      {isActive && (
                        <span className="text-[#4A3ABA] font-bold text-[10px] uppercase flex items-center gap-1">
                          Now Playing
                          <span className="w-1.5 h-1.5 rounded-full bg-[#4A3ABA] animate-ping" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Stats Widget */}
          <div className="bg-gradient-to-br from-[#4A3ABA] to-[#6B5CE7] rounded-3xl p-6 text-white relative overflow-hidden shadow-md">
            <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10" />
            <h4 className="font-bold text-sm uppercase tracking-widest text-white/70">Your Progress</h4>
            <div className="text-3xl font-black mt-2">60%</div>
            <p className="text-xs text-white/80 mt-1">3 of 5 lectures completed</p>
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-[#F5A623] h-full w-[60%] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
