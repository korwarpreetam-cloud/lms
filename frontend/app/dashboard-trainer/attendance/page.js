"use client";

import { useState, useEffect } from "react";
import { useQuery } from "../../../lib/hooks";
import { useAuth } from "../../../hooks/useAuth";
import { useToast } from "../../../hooks/useToast";
import { fetchTrainerCohorts, fetchCohortStudents } from "../../../lib/queries";
import { submitAttendance } from "../../../lib/mutations";

export default function AttendancePage() {
  const { claims } = useAuth();
  const activeOrgId = claims?.active_org_id || "";
  const { showToast } = useToast();
  
  const [step, setStep] = useState(1);
  const [selectedCohortId, setSelectedCohortId] = useState("");
  const [selectedCohortName, setSelectedCohortName] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState({}); // student_profile_id -> status
  const [submitLoading, setSubmitLoading] = useState(false);

  // Fetch cohorts for the trainer
  const { data: cohorts, loading: cohortsLoading } = useQuery(() => fetchTrainerCohorts(activeOrgId), [activeOrgId]);

  // Fetch students when a cohort is selected
  useEffect(() => {
    if (!selectedCohortId) return;
    setStudentsLoading(true);
    fetchCohortStudents(selectedCohortId)
      .then(data => {
        setStudents(data);
        // Initialize all status to 'present'
        const initial = {};
        data.forEach(s => {
          initial[s.id] = "present";
        });
        setAttendanceRecords(initial);
      })
      .catch(err => {
        console.error(err);
        showToast("Failed to fetch students for cohort", "error");
      })
      .finally(() => {
        setStudentsLoading(false);
      });
  }, [selectedCohortId, showToast]);

  const toggleStatus = (studentId) => {
    setAttendanceRecords(prev => {
      const current = prev[studentId];
      let next = "present";
      if (current === "present") next = "absent";
      else if (current === "absent") next = "late";
      return { ...prev, [studentId]: next };
    });
  };

  const handleSubmit = async () => {
    setSubmitLoading(true);
    try {
      const records = Object.entries(attendanceRecords).map(([studentId, status]) => ({
        studentId,
        status
      }));
      if (records.length === 0) {
        showToast("No students to mark attendance for", "warning");
        return;
      }
      await submitAttendance(activeOrgId, selectedCohortId, attendanceDate, records);
      showToast("Attendance submitted successfully!", "success");
      setStep(3);
    } catch (err) {
      showToast(err.message || "Failed to submit attendance", "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedCohortId("");
    setSelectedCohortName("");
    setStudents([]);
    setAttendanceRecords({});
    setStep(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Attendance Logs</h1>
        <p className="text-sm text-gray-550 font-medium mt-1">
          Select an assigned cohort and record students attendance status live.
        </p>
      </div>

      <div className="bg-white rounded-3xl p-8 border border-gray-100 max-w-xl mx-auto shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h4 className="font-bold text-gray-900 text-base">Attendance Capture Tool</h4>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((sNum) => (
              <div
                key={sNum}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step >= sNum
                    ? "bg-[#4A3ABA] text-white"
                    : "bg-gray-200 text-gray-400"
                }`}
              >
                {sNum}
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <label className="block text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Select Cohort / Class</label>
            {cohortsLoading ? (
              <div className="text-sm text-gray-500 animate-pulse">Loading assigned cohorts...</div>
            ) : !cohorts || cohorts.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-200 rounded-xl">
                No active cohorts assigned to you in this school.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {cohorts.map((cohort) => (
                  <button
                    key={cohort.id}
                    onClick={() => {
                      setSelectedCohortId(cohort.id);
                      setSelectedCohortName(cohort.name);
                      setStep(2);
                    }}
                    className="w-full text-left p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-750 hover:border-[#4A3ABA]/55 hover:bg-purple-50/20 transition-all font-semibold cursor-pointer"
                  >
                    <div className="text-sm font-bold text-gray-900">{cohort.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{cohort.courses?.name || "Active Batch"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="bg-[#4A3ABA]/5 rounded-xl p-3 text-xs text-[#4A3ABA] font-bold flex justify-between items-center">
              <span>Class: {selectedCohortName}</span>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="bg-white px-2 py-1 rounded border border-gray-250 text-xs font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4A3ABA]"
              />
            </div>

            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
              Mark Attendance status (Click badge to cycle: present → absent → late)
            </label>
            
            {studentsLoading ? (
              <div className="text-sm text-gray-500 animate-pulse text-center py-4">Loading students list...</div>
            ) : students.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-xl">
                No students enrolled in this cohort.
              </div>
            ) : (
              <div className="space-y-2.5">
                {students.map((student) => {
                  const status = attendanceRecords[student.id] || "present";
                  return (
                    <div key={student.id} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-gray-150 shadow-sm">
                      <div>
                        <span className="font-semibold text-gray-800 text-sm block">{student.users?.full_name || "Enrolling Student"}</span>
                        <span className="text-xs text-gray-400 font-mono">{student.users?.email}</span>
                      </div>
                      <button
                        onClick={() => toggleStatus(student.id)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase transition-all min-w-[90px] text-center cursor-pointer ${
                          status === "present" ? "bg-green-100 text-green-700 hover:bg-green-200" :
                          status === "absent" ? "bg-red-100 text-red-600 hover:bg-red-200" :
                          "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        }`}
                      >
                        {status}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-between items-center pt-4">
              <button onClick={() => setStep(1)} className="text-sm font-semibold text-[#4A3ABA] hover:underline cursor-pointer" disabled={submitLoading}>
                ← Back
              </button>
              {students.length > 0 && (
                <button
                  onClick={handleSubmit}
                  disabled={submitLoading}
                  className="bg-[#4A3ABA] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#3A2A9A] transition-all disabled:opacity-55 cursor-pointer"
                >
                  {submitLoading ? "Submitting..." : "Save & Submit"}
                </button>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="text-center py-6 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h5 className="text-lg font-bold text-gray-900 font-black">Attendance Logged!</h5>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto font-medium">
              Log uploaded to database. Synced with student portals live.
            </p>
            <button
              onClick={handleReset}
              className="mt-6 bg-gray-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-gray-800 transition-all uppercase tracking-wider cursor-pointer"
            >
              Mark Another Class
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
