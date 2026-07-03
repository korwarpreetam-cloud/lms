"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../hooks/useAuth";
import { useToast } from "../../../../hooks/useToast";
import { createClient } from "../../../../lib/auth";

export default function SchoolDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const schoolId = params.id;

  // School profile state
  const [school, setSchool] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [schoolSlug, setSchoolSlug] = useState("");
  const [schoolStatus, setSchoolStatus] = useState(true);

  // Lists state
  const [students, setStudents] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSchoolData = async () => {
    if (!schoolId) return;
    setLoading(true);
    const supabase = createClient();
    try {
      // 1. Fetch organization details
      const { data: orgData, error: orgErr } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", schoolId)
        .single();
      if (orgErr) throw orgErr;
      setSchool(orgData);
      setSchoolName(orgData.name);
      setSchoolSlug(orgData.slug);
      setSchoolStatus(orgData.is_active);

      // 2. Fetch students
      const { data: studentData, error: studentErr } = await supabase
        .from("student_profiles")
        .select(`
          id,
          branch,
          users:user_id (email, full_name)
        `)
        .eq("organization_id", schoolId);
      if (studentErr) throw studentErr;
      setStudents(studentData || []);

      // 3. Fetch trainers (organization memberships where role_id = 3)
      const { data: trainerData, error: trainerErr } = await supabase
        .from("organization_memberships")
        .select(`
          id,
          users:user_id (email, full_name),
          roles:role_id (label)
        `)
        .eq("organization_id", schoolId)
        .eq("role_id", 3);
      if (trainerErr) throw trainerErr;
      setTrainers(trainerData || []);

      // 4. Fetch courses
      const { data: courseData, error: courseErr } = await supabase
        .from("courses")
        .select("*")
        .eq("organization_id", schoolId);
      if (courseErr) throw courseErr;
      setCourses(courseData || []);

    } catch (err) {
      showToast(err.message || "Failed to load school details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchoolData();
  }, [schoolId]);

  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    if (!schoolName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: schoolName,
          slug: schoolSlug,
          is_active: schoolStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", schoolId);

      if (error) throw error;
      showToast("School details updated successfully!", "success");
      fetchSchoolData();
    } catch (err) {
      showToast(err.message || "Failed to update school info", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push("/dashboard/schools")}
          className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
        >
          ← Back to Schools list
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: School info form (EDITABLE) */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4 h-fit">
          <h2 className="text-xl font-black text-gray-900">Edit School Info</h2>
          <form onSubmit={handleUpdateSchool} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">School Name</label>
              <input
                type="text"
                required
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900 font-bold"
              />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Slug URL</label>
              <input
                type="text"
                required
                value={schoolSlug}
                onChange={(e) => setSchoolSlug(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-[#4A3ABA] text-gray-900 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={schoolStatus}
                onChange={(e) => setSchoolStatus(e.target.checked)}
                className="rounded text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="is_active" className="text-xs font-bold text-gray-700">Active status (Enable logins)</label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#4A3ABA] text-white py-2.5 rounded-xl text-xs font-bold hover:bg-[#3A2A9A] transition-all disabled:opacity-55"
            >
              {saving ? "Saving changes..." : "Save Details"}
            </button>
          </form>
        </div>

        {/* Right Columns: School directory details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Courses Section */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900">School Curriculum & Courses ({courses.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {courses.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No courses offered yet.</p>
              ) : (
                courses.map(course => (
                  <div key={course.id} className="p-3 bg-gray-50 rounded-xl border border-gray-150 text-xs">
                    <span className="font-bold text-gray-900 block">{course.name}</span>
                    <span className="text-[10px] text-gray-500 block mt-1">{course.description || "No description"}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Trainers Section */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900">Active Trainers ({trainers.length})</h3>
            <div className="space-y-2">
              {trainers.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No trainers registered.</p>
              ) : (
                trainers.map(tr => (
                  <div key={tr.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-150 flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-900">{tr.users?.full_name || "Trainer User"}</span>
                    <span className="text-[10px] text-gray-450 font-mono">{tr.users?.email}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Students Section */}
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900">Enrolled Students ({students.length})</h3>
            <div className="space-y-2">
              {students.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No students enrolled.</p>
              ) : (
                students.map(st => (
                  <div key={st.id} className="p-3.5 bg-gray-50 rounded-xl border border-gray-150 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-gray-900 block">{st.users?.full_name || "Student Profile"}</span>
                      <span className="text-[10px] text-gray-400 block mt-0.5">Branch: {st.branch || "Main branch"}</span>
                    </div>
                    <span className="text-[10px] text-gray-450 font-mono">{st.users?.email}</span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
