"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "../../../lib/hooks";
import { fetchCourses } from "../../../lib/queries";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";
import { Card } from "../../../components/ui/Card";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function TrainerCoursesFlowPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  // 1. Fetch courses
  const { data: courses, loading: coursesLoading } = useQuery(
    () => fetchCourses(activeOrgId),
    [activeOrgId]
  );

  // Flow State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // Load materials (modules and lectures) for selected course
  const loadMaterials = async (courseId) => {
    setMaterialsLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from("course_materials")
        .select("*")
        .eq("course_id", courseId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMaterials(data || []);
      
      const firstChap = data?.find(m => m.type === "module");
      if (firstChap) {
        setSelectedChapter(firstChap);
      } else {
        setSelectedChapter(null);
      }
    } catch (err) {
      showToast(err.message || "Failed to load course materials", "error");
    } finally {
      setMaterialsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCourse) {
      loadMaterials(selectedCourse.id);
    } else {
      setMaterials([]);
      setSelectedChapter(null);
    }
  }, [selectedCourse]);

  // Filter lectures belonging to active chapter and type
  const activeLectures = materials.filter(m => 
    m.type !== "module" && 
    selectedChapter && 
    m.description?.includes(`ChapterID:${selectedChapter.id}`)
  );

  const getLecturesOfSubtype = (subtype) => {
    return activeLectures.filter(m => m.description?.includes(`ClassType:${subtype}`));
  };

  const videoLectures = getLecturesOfSubtype("video").concat(activeLectures.filter(m => m.type === "video" && !m.description?.includes("ClassType:")));
  const pdfLectures = getLecturesOfSubtype("pdf").concat(activeLectures.filter(m => m.type === "pdf" && !m.description?.includes("ClassType:")));
  const assignmentLectures = getLecturesOfSubtype("assignment");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/dashboard-trainer")}
            className="text-xs font-bold text-purple-650 hover:underline flex items-center gap-1 mb-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Syllabus Explorer</h1>
          <p className="text-sm text-gray-550 font-medium mt-1">
            Browse course chapters, guidelines, and materials allocated to your school. (Read-Only)
          </p>
        </div>
        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full uppercase tracking-wider">
          Read-Only Mode
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Courses */}
        <Card className="flex flex-col h-[550px] border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
            <span className="font-extrabold text-sm text-purple-755 uppercase tracking-wider">1. Course Level</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {coursesLoading ? (
              <TableRowSkeleton />
            ) : courses?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No courses available.</p>
            ) : (
              courses?.map(course => (
                <button
                  key={course.id}
                  onClick={() => {
                    setSelectedCourse(course);
                    setSelectedChapter(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs font-semibold flex justify-between items-center ${
                    selectedCourse?.id === course.id
                      ? "bg-purple-50 border-[#4A3ABA] text-[#4A3ABA] font-bold shadow-sm"
                      : "bg-white border-gray-100 hover:border-gray-300 text-gray-650"
                  }`}
                >
                  <div>
                    <span className="block text-gray-900 font-bold">{course.name}</span>
                    <span className="block text-[10px] text-gray-400 font-medium mt-0.5">{course.description || "No description"}</span>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Column 2: Chapters */}
        <Card className="flex flex-col h-[550px] border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
            <span className="font-extrabold text-sm text-purple-755 uppercase tracking-wider">2. Chapters</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!selectedCourse ? (
              <p className="text-xs text-gray-400 text-center py-8">Select a course to load chapters.</p>
            ) : materialsLoading ? (
              <TableRowSkeleton />
            ) : materials.filter(m => m.type === "module").length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No chapters added yet.</p>
            ) : (
              materials.filter(m => m.type === "module").map((chap, idx) => (
                <button
                  key={chap.id}
                  onClick={() => setSelectedChapter(chap)}
                  className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-semibold flex justify-between items-center ${
                    selectedChapter?.id === chap.id
                      ? "bg-purple-50 border-[#4A3ABA] text-[#4A3ABA] font-bold shadow-sm"
                      : "bg-white border-gray-100 hover:border-gray-200 text-gray-650"
                  }`}
                >
                  <span>Chapter {idx + 1}: {chap.title}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Column 3: Lectures */}
        <Card className="flex flex-col h-[550px] border border-gray-200">
          <div className="p-4 border-b border-gray-100 bg-gray-50 shrink-0">
            <span className="font-extrabold text-sm text-purple-755 uppercase tracking-wider">3. Lectures</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedChapter ? (
              <p className="text-xs text-gray-400 text-center py-8">Select a chapter to see lectures.</p>
            ) : (
              <div className="space-y-4">
                {/* Section A: Video */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-650 bg-purple-50 px-2.5 py-1 rounded-md inline-block">Video Lectures</h4>
                  {videoLectures.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic pl-1">No videos attached.</p>
                  ) : (
                    videoLectures.map(lec => (
                      <button
                        key={lec.id}
                        onClick={() => router.push(`/dashboard-trainer/courses/lectures/${lec.id}`)}
                        className="w-full text-left p-3.5 bg-white hover:bg-gray-50 rounded-xl border border-gray-950 text-xs flex justify-between items-center cursor-pointer group shadow-sm transition-all"
                      >
                        <span className="font-bold text-gray-900 block">{lec.title}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-900"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    ))
                  )}
                </div>

                {/* Section B: PDF */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2.5 py-1 rounded-md inline-block">PDF Materials</h4>
                  {pdfLectures.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic pl-1">No PDF files attached.</p>
                  ) : (
                    pdfLectures.map(lec => (
                      <button
                        key={lec.id}
                        onClick={() => router.push(`/dashboard-trainer/courses/lectures/${lec.id}`)}
                        className="w-full text-left p-3.5 bg-white hover:bg-gray-50 rounded-xl border border-gray-950 text-xs flex justify-between items-center cursor-pointer group shadow-sm transition-all"
                      >
                        <span className="font-bold text-gray-900 block">{lec.title}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-900"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    ))
                  )}
                </div>

                {/* Section C: Assignment */}
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md inline-block">Assignments</h4>
                  {assignmentLectures.length === 0 ? (
                    <p className="text-[10px] text-gray-400 italic pl-1">No assignments attached.</p>
                  ) : (
                    assignmentLectures.map(lec => (
                      <button
                        key={lec.id}
                        onClick={() => router.push(`/dashboard-trainer/courses/lectures/${lec.id}`)}
                        className="w-full text-left p-3.5 bg-white hover:bg-gray-50 rounded-xl border border-gray-950 text-xs flex justify-between items-center cursor-pointer group shadow-sm transition-all"
                      >
                        <span className="font-bold text-gray-900 block">{lec.title}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-900"><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}
