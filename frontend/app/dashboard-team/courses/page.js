"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "../../../lib/hooks";
import { fetchCourses } from "../../../lib/queries";
import { createCourse } from "../../../lib/mutations";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { createClient } from "../../../lib/auth";
import { Card } from "../../../components/ui/Card";
import { TableRowSkeleton } from "../../../components/ui/Skeleton";

export default function CoreTeamCoursesFlowPage() {
  const router = useRouter();
  const { claims } = useAuth();
  const { showToast } = useToast();
  const activeOrgId = claims?.active_org_id || "";

  // 1. Fetch courses
  const { data: courses, loading: coursesLoading, refetch } = useQuery(
    () => fetchCourses(activeOrgId),
    [activeOrgId]
  );

  // Flow State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // Modal / Form States
  const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseDesc, setCourseDesc] = useState("");

  const [isAddChapterOpen, setIsAddChapterOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");

  const [isAddLectureOpen, setIsAddLectureOpen] = useState(false);
  const [lectureTitle, setLectureTitle] = useState("");
  const [lectureType, setLectureType] = useState("video"); // video, pdf, assignment
  const [lectureUrl, setLectureUrl] = useState("");
  const [lectureDesc, setLectureDesc] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

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
      
      // Auto-select first chapter (module) if exists and none selected
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

  // Handlers
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!courseName.trim()) return;
    setActionLoading(true);
    try {
      await createCourse(activeOrgId, courseName, courseDesc);
      showToast("Course created successfully!", "success");
      setIsAddCourseOpen(false);
      setCourseName("");
      setCourseDesc("");
      refetch();
    } catch (err) {
      showToast(err.message || "Failed to create course", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateChapter = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !chapterTitle.trim()) return;
    setActionLoading(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("course_materials")
        .insert({
          course_id: selectedCourse.id,
          title: chapterTitle,
          type: "module",
          description: "Chapter module"
        });

      if (error) throw error;
      showToast("Chapter added successfully!", "success");
      setIsAddChapterOpen(false);
      setChapterTitle("");
      loadMaterials(selectedCourse.id);
    } catch (err) {
      showToast(err.message || "Failed to add chapter", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateLecture = async (e) => {
    e.preventDefault();
    if (!selectedCourse || !selectedChapter || !lectureTitle.trim()) return;
    setActionLoading(true);
    const supabase = createClient();

    // Map custom types to DB compliant types:
    // 'video' -> 'video'
    // 'pdf' -> 'pdf'
    // 'assignment' -> 'notes'
    const dbType = (lectureType === "assignment") ? "notes" : lectureType;

    try {
      const { error } = await supabase
        .from("course_materials")
        .insert({
          course_id: selectedCourse.id,
          title: lectureTitle,
          type: dbType,
          content_url: lectureUrl || null,
          description: `ChapterID:${selectedChapter.id}|ClassType:${lectureType}|${lectureDesc}`
        });

      if (error) throw error;
      showToast("Lecture added successfully!", "success");
      setIsAddLectureOpen(false);
      setLectureTitle("");
      setLectureUrl("");
      setLectureDesc("");
      loadMaterials(selectedCourse.id);
    } catch (err) {
      showToast(err.message || "Failed to add lecture", "error");
    } finally {
      setActionLoading(false);
    }
  };

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
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Curriculum Flow Builder</h1>
          <p className="text-sm text-gray-550 font-medium mt-1">
            Configure Courses (e.g. 6-7class, 8-9class), Chapter hierarchy, and Lectures (Video, PDF, Assignments).
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Courses */}
        <Card className="flex flex-col h-[600px] border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <span className="font-extrabold text-sm text-purple-750 uppercase tracking-wider">1. Course Level</span>
            <button
              onClick={() => setIsAddCourseOpen(true)}
              className="text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-750 px-3 py-1.5 rounded-lg cursor-pointer"
            >
              + Course
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {coursesLoading ? (
              <TableRowSkeleton />
            ) : courses?.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">No courses created yet.</p>
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
        <Card className="flex flex-col h-[600px] border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <span className="font-extrabold text-sm text-purple-750 uppercase tracking-wider">2. Chapters</span>
            {selectedCourse && (
              <button
                onClick={() => setIsAddChapterOpen(true)}
                className="text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-750 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                + Chapter
              </button>
            )}
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
        <Card className="flex flex-col h-[600px] border border-gray-200">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
            <span className="font-extrabold text-sm text-purple-750 uppercase tracking-wider">3. Lectures</span>
            {selectedChapter && (
              <button
                onClick={() => setIsAddLectureOpen(true)}
                className="text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-750 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                + Lecture
              </button>
            )}
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
                        onClick={() => router.push(`/dashboard-team/courses/lectures/${lec.id}`)}
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
                        onClick={() => router.push(`/dashboard-team/courses/lectures/${lec.id}`)}
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
                        onClick={() => router.push(`/dashboard-team/courses/lectures/${lec.id}`)}
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

      {/* Add Course Modal */}
      {isAddCourseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl animate-fade-in">
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Add New Course</h3>
              <input
                type="text"
                required
                placeholder="e.g. 6-7class"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
              />
              <textarea
                placeholder="Course description"
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900 h-20"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsAddCourseOpen(false)} className="text-xs font-bold text-gray-500 border border-gray-250 px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="text-xs font-bold text-white bg-[#4A3ABA] px-4 py-2 rounded-xl cursor-pointer" disabled={actionLoading}>
                  {actionLoading ? "Saving..." : "Add Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Chapter Modal */}
      {isAddChapterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl animate-fade-in">
            <form onSubmit={handleCreateChapter} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Add Chapter</h3>
              <input
                type="text"
                required
                placeholder="Chapter title, e.g. Introduction"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsAddChapterOpen(false)} className="text-xs font-bold text-gray-500 border border-gray-250 px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="text-xs font-bold text-white bg-[#4A3ABA] px-4 py-2 rounded-xl cursor-pointer" disabled={actionLoading}>
                  {actionLoading ? "Saving..." : "Add Chapter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lecture Modal */}
      {isAddLectureOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-gray-150 shadow-2xl animate-fade-in">
            <form onSubmit={handleCreateLecture} className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Add Lecture Content</h3>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Lecture Title</label>
                <input
                  type="text"
                  required
                  placeholder="Lecture Title"
                  value={lectureTitle}
                  onChange={(e) => setLectureTitle(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Resource Type</label>
                <select
                  value={lectureType}
                  onChange={(e) => setLectureType(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900 bg-white"
                >
                  <option value="video">Video Lecture</option>
                  <option value="pdf">PDF File</option>
                  <option value="assignment">Assignment Task</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Resource URL (Optional)</label>
                <input
                  type="url"
                  placeholder="Resource URL"
                  value={lectureUrl}
                  onChange={(e) => setLectureUrl(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Notes / Guidelines</label>
                <textarea
                  placeholder="Extra description"
                  value={lectureDesc}
                  onChange={(e) => setLectureDesc(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900 h-16"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setIsAddLectureOpen(false)} className="text-xs font-bold text-gray-500 border border-gray-250 px-4 py-2 rounded-xl">Cancel</button>
                <button type="submit" className="text-xs font-bold text-white bg-[#4A3ABA] px-4 py-2 rounded-xl cursor-pointer" disabled={actionLoading}>
                  {actionLoading ? "Saving..." : "Add Lecture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
