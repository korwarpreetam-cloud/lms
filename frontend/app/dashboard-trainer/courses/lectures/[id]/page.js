"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../../hooks/useAuth";
import { useToast } from "../../../../../hooks/useToast";
import { createClient } from "../../../../../lib/auth";

export default function TrainerLectureViewPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const lectureId = params.id;

  // Lecture details states
  const [lecture, setLecture] = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [assignmentUrl, setAssignmentUrl] = useState("");
  const [quizUrl, setQuizUrl] = useState("");

  const [loading, setLoading] = useState(true);
  const [activePane, setActivePane] = useState("video"); // video, pdf, assignment, quiz

  const fetchLectureData = async () => {
    if (!lectureId) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("course_materials")
        .select("*")
        .eq("id", lectureId)
        .single();

      if (error) throw error;
      setLecture(data);
      setTitle(data.title);
      setVideoUrl(data.content_url || "");

      // Parse metadata from description
      let cleanDesc = data.description || "";
      if (cleanDesc.includes("ChapterID:")) {
        const pdfMatch = cleanDesc.match(/PdfUrl:([^|]+)/);
        const assignMatch = cleanDesc.match(/AssignUrl:([^|]+)/);
        const quizMatch = cleanDesc.match(/QuizUrl:([^|]+)/);
        
        if (pdfMatch) setPdfUrl(pdfMatch[1]);
        if (assignMatch) setAssignmentUrl(assignMatch[1]);
        if (quizMatch) setQuizUrl(quizMatch[1]);

        cleanDesc = cleanDesc.split("|").pop() || "";
      }
      setDesc(cleanDesc);

    } catch (err) {
      showToast(err.message || "Failed to load lecture details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLectureData();
  }, [lectureId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-950 rounded-3xl">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header back link */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard-trainer/courses")}
          className="text-xs font-bold text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
        >
          ← Back to Syllabus Explorer
        </button>
        <span className="text-xs font-bold text-gray-400 bg-gray-900 border border-gray-800 px-3 py-1.5 rounded-full uppercase tracking-wider">
          Read-Only Viewer
        </span>
      </div>

      {/* Main interactive lecture layout (Matches Image 5, Read-Only) */}
      <div className="bg-gradient-to-br from-gray-900 via-gray-950 to-purple-950/40 rounded-3xl p-8 border border-gray-800 shadow-2xl min-h-[500px]">
        
        {/* Title */}
        <div className="mb-8 border-b border-gray-800 pb-4">
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-1">Resource Viewer</span>
          <h1 className="text-3xl font-black text-white tracking-tight">{title}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-stretch">
          
          {/* Column 1: Left Menu Sidebar */}
          <div className="lg:col-span-1 bg-gray-900/60 rounded-3xl p-5 border border-gray-800 flex flex-col justify-between space-y-6">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase block tracking-wider mb-2">Workspace Menu</span>
              <button 
                onClick={() => setActivePane("video")}
                className={`w-full text-left p-3.5 rounded-2xl text-xs font-bold transition-all block cursor-pointer ${
                  activePane === "video" 
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                📹 Video Player
              </button>
              <button 
                onClick={() => setActivePane("pdf")}
                className={`w-full text-left p-3.5 rounded-2xl text-xs font-bold transition-all block cursor-pointer ${
                  activePane === "pdf" 
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                📄 PDF Materials
              </button>
              <button 
                onClick={() => setActivePane("assignment")}
                className={`w-full text-left p-3.5 rounded-2xl text-xs font-bold transition-all block cursor-pointer ${
                  activePane === "assignment" 
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                📝 Assignments
              </button>
              <button 
                onClick={() => setActivePane("quiz")}
                className={`w-full text-left p-3.5 rounded-2xl text-xs font-bold transition-all block cursor-pointer ${
                  activePane === "quiz" 
                    ? "bg-purple-600 text-white shadow-lg shadow-purple-900/30" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                ❓ Quizzes
              </button>
            </div>
            
            <div className="pt-4 border-t border-gray-800">
              <label className="block text-[9px] font-bold text-gray-500 uppercase mb-2">Guidelines / Info</label>
              <p className="text-[11px] text-gray-300 leading-relaxed font-medium bg-gray-950 p-3 rounded-2xl border border-gray-850 min-h-[80px]">
                {desc || "No guidelines or description attached."}
              </p>
            </div>
          </div>

          {/* Column 2: Center Content Player Pane */}
          <div className="lg:col-span-3 bg-gray-900/30 rounded-3xl p-6 border border-gray-850 flex flex-col justify-center items-center relative min-h-[350px]">
            {activePane === "video" && (
              <div className="w-full h-full flex flex-col justify-between space-y-4">
                <div className="flex-1 flex items-center justify-center bg-black rounded-2xl border border-gray-850 relative overflow-hidden h-[280px] shadow-2xl">
                  {videoUrl ? (
                    <iframe 
                      src={(() => {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                        const match = videoUrl.match(regExp);
                        if (match && match[2].length === 11) {
                          return `https://www.youtube.com/embed/${match[2]}`;
                        }
                        return videoUrl;
                      })()} 
                      className="w-full h-full rounded-2xl" 
                      allowFullScreen 
                    />
                  ) : (
                    <div className="text-center text-gray-500 p-8">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-2 text-gray-700"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                      <span className="text-xs font-bold block">No Video URL Configured</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activePane === "pdf" && (
              <div className="w-full h-full flex flex-col justify-between space-y-4">
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-950/80 rounded-2xl border border-gray-850 p-6 text-center h-[280px]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" className="mb-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                  <span className="text-xs font-bold text-white block">PDF Lecture Document</span>
                  {pdfUrl ? (
                    <div className="space-y-4 mt-4">
                      <a 
                        href={pdfUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow cursor-pointer"
                      >
                        Open / Download PDF Document 📄
                      </a>
                      <span className="text-[10px] text-gray-400 block truncate max-w-xs">{pdfUrl}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-500 mt-1">No PDF file uploaded by the Core Team yet.</span>
                  )}
                </div>
              </div>
            )}

            {activePane === "assignment" && (
              <div className="w-full h-full flex flex-col justify-between space-y-4">
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-950/80 rounded-2xl border border-gray-850 p-6 text-center h-[280px]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2" className="mb-3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  <span className="text-xs font-bold text-white block">Lecture Assignment Task</span>
                  {assignmentUrl ? (
                    <div className="space-y-4 mt-4">
                      <a 
                        href={assignmentUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow cursor-pointer"
                      >
                        Open Assignment Link 📝
                      </a>
                      <span className="text-[10px] text-gray-400 block truncate max-w-xs">{assignmentUrl}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-500 mt-1">No assignment file or description added.</span>
                  )}
                </div>
              </div>
            )}

            {activePane === "quiz" && (
              <div className="w-full h-full flex flex-col justify-between space-y-4">
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-950/80 rounded-2xl border border-gray-850 p-6 text-center h-[280px]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" className="mb-3"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <span className="text-xs font-bold text-white block">Interactive Quiz / Questionnaire</span>
                  {quizUrl ? (
                    <div className="space-y-4 mt-4">
                      <a 
                        href={quizUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl transition-all shadow cursor-pointer"
                      >
                        Start Quiz / Test Portal ❓
                      </a>
                      <span className="text-[10px] text-gray-400 block truncate max-w-xs">{quizUrl}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-gray-500 mt-1">No quiz link added yet.</span>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Column 3: Right Stack Pane */}
          <div className="lg:col-span-1 flex flex-col gap-4 justify-center">
            
            <button
              onClick={() => setActivePane("pdf")}
              className={`p-5 rounded-2xl text-xs font-bold uppercase transition-all border text-center cursor-pointer select-none ${
                activePane === "pdf"
                  ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30"
                  : "bg-gray-900/40 border-gray-800 text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              pdf/notes
            </button>

            <button
              onClick={() => setActivePane("assignment")}
              className={`p-5 rounded-2xl text-xs font-bold uppercase transition-all border text-center cursor-pointer select-none ${
                activePane === "assignment"
                  ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30"
                  : "bg-gray-900/40 border-gray-800 text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              assignment
            </button>

            <button
              onClick={() => setActivePane("quiz")}
              className={`p-5 rounded-2xl text-xs font-bold uppercase transition-all border text-center cursor-pointer select-none ${
                activePane === "quiz"
                  ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30"
                  : "bg-gray-900/40 border-gray-800 text-gray-400 hover:bg-gray-900 hover:text-white"
              }`}
            >
              quiz
            </button>

          </div>

        </div>

      </div>

    </div>
  );
}
