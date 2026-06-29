// =====================================================================
// lib/queries.ts
// Reusable Supabase query functions for dashboard data fetching.
// All queries go through the browser client and respect RLS — the
// logged-in user only sees data their role permits.
// =====================================================================
import { createClient } from './auth';

// ── Types ──────────────────────────────────────────────────

export type DashboardMetric = {
  label: string;
  value: string;
  change?: string;
  detail?: string;
  trend?: 'up' | 'down' | 'flat';
  color: 'purple' | 'amber';
};

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
};

export type MemberRow = {
  id: string;
  user_id: string;
  role_id: number;
  status: string;
  users: { email: string; full_name: string | null };
  roles: { code: string; label: string };
};

export type CourseRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  organization_id: string;
};

export type CohortRow = {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  course_id: string;
  courses: { name: string } | null;
};

export type AssignmentRow = {
  id: string;
  title: string;
  max_score: number;
  cohort_id: string;
  organization_id: string;
  created_at: string;
  cohorts?: { name: string; courses?: { name: string } } | null;
};

export type SubmissionRow = {
  id: string;
  content: string;
  student_id: string;
  assignment_id: string;
  created_at: string;
  updated_at: string;
  assignments?: { title: string; max_score: number } | null;
  grades?: { score: number; grader_id: string } | null;
  student_profiles?: { users: { email: string; full_name: string | null } } | null;
};

export type GradeRow = {
  id: string;
  score: number;
  grader_id: string;
  submission_id: string;
  created_at: string;
  submissions?: { content: string; assignments?: { title: string; max_score: number } } | null;
};

// ── Count Helpers ──────────────────────────────────────────

async function countTable(table: string, filters?: Record<string, any>): Promise<number> {
  const supabase = createClient();
  let query = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filters) {
    for (const [key, val] of Object.entries(filters)) {
      query = query.eq(key, val);
    }
  }
  const { count, error } = await query;
  if (error) {
    console.error(`countTable(${table}) error:`, error.message);
    return 0;
  }
  return count ?? 0;
}

// ── Owner / Core Team Dashboard Queries ───────────────────

export async function fetchAdminMetrics(activeOrgId?: string): Promise<DashboardMetric[]> {
  const filters: Record<string, any> = activeOrgId ? { organization_id: activeOrgId } : {};
  const [orgs, students, trainers, courses, assignments, submissions] = await Promise.all([
    countTable('organizations'),
    countTable('student_profiles', filters),
    countTable('organization_memberships', { role_id: 3, status: 'active', ...filters }),
    countTable('courses', filters),
    countTable('assignments', filters),
    countTable('submissions', filters),
  ]);

  return [
    { label: 'Total Schools', value: orgs.toLocaleString(), color: 'purple', trend: 'up' },
    { label: 'Total Students', value: students.toLocaleString(), color: 'amber', trend: 'up' },
    { label: 'Total Trainers', value: trainers.toLocaleString(), color: 'purple', trend: 'up' },
    { label: 'Total Courses', value: courses.toLocaleString(), color: 'amber', trend: 'up' },
    { label: 'Assignments', value: assignments.toLocaleString(), color: 'purple', trend: 'up' },
    { label: 'Submissions', value: submissions.toLocaleString(), color: 'amber', trend: 'up' },
  ];
}

export async function fetchOrganizations(): Promise<OrgSummary[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, is_active')
    .order('name');
  if (error) { console.error('fetchOrganizations error:', error.message); return []; }
  return data ?? [];
}

export async function fetchMembers(activeOrgId?: string): Promise<MemberRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('organization_memberships')
    .select('id, user_id, role_id, status, users!user_id(email, full_name), roles(code, label)')
    .eq('status', 'active');

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) { console.error('fetchMembers error:', error.message); return []; }
  return (data as any) ?? [];
}

export async function fetchCourses(activeOrgId?: string): Promise<CourseRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('courses')
    .select('id, name, description, is_active, organization_id');

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data, error } = await query.order('name');
  if (error) { console.error('fetchCourses error:', error.message); return []; }
  return data ?? [];
}

// ── Trainer Dashboard Queries ────────────────────────────

export async function fetchTrainerMetrics(activeOrgId?: string): Promise<DashboardMetric[]> {
  const filters: Record<string, any> = activeOrgId ? { organization_id: activeOrgId } : {};
  
  const supabase = createClient();
  let cohortsQuery = supabase.from('cohort_trainers').select('cohort_id, cohorts!inner(organization_id)', { count: 'exact', head: true });
  if (activeOrgId) {
    cohortsQuery = cohortsQuery.eq('cohorts.organization_id', activeOrgId);
  }
  
  const [{ count: cohorts }, pendingSubmissions, gradedCount] = await Promise.all([
    cohortsQuery,
    countTable('submissions', filters),
    countTable('grades', filters),
  ]);

  const cohortsVal = cohorts ?? 0;
  const submissionsVal = pendingSubmissions ?? 0;
  const gradedVal = gradedCount ?? 0;
  const pendingReviewVal = Math.max(0, submissionsVal - gradedVal);

  return [
    { label: 'Assigned Cohorts', value: cohortsVal.toLocaleString(), detail: 'Active classes', color: 'purple' },
    { label: 'Submissions', value: submissionsVal.toLocaleString(), detail: 'From students', color: 'amber' },
    { label: 'Graded', value: gradedVal.toLocaleString(), detail: 'Submissions graded', color: 'purple' },
    { label: 'Pending Review', value: pendingReviewVal.toLocaleString(), detail: 'Need grading', color: 'amber' },
  ];
}

export async function fetchTrainerCohorts(activeOrgId?: string): Promise<CohortRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('cohort_trainers')
    .select('cohorts(id, name, status, start_date, end_date, course_id, organization_id, courses(name))');

  if (activeOrgId) {
    query = query.eq('cohorts.organization_id', activeOrgId);
  }

  const { data, error } = await query.order('assigned_at', { ascending: false });
  if (error) { console.error('fetchTrainerCohorts error:', error.message); return []; }
  return (data ?? []).map((row: any) => row.cohorts).filter(Boolean);
}

export async function fetchTrainerSubmissions(activeOrgId?: string): Promise<SubmissionRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('submissions')
    .select('id, content, student_id, assignment_id, created_at, updated_at, assignments(title, max_score), grades(score, grader_id), student_profiles(users(email, full_name))');

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data, error } = await query
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) { console.error('fetchTrainerSubmissions error:', error.message); return []; }
  return (data as any) ?? [];
}

// ── Student Dashboard Queries ────────────────────────────

export async function fetchStudentMetrics(activeOrgId?: string): Promise<DashboardMetric[]> {
  const supabase = createClient();
  const filters: Record<string, any> = activeOrgId ? { organization_id: activeOrgId } : {};

  // Get student's enrolled cohorts with courses
  let enrollmentsQuery = supabase
    .from('cohort_students')
    .select('cohorts!inner(name, organization_id, courses(name))')
    .limit(1);

  if (activeOrgId) {
    enrollmentsQuery = enrollmentsQuery.eq('cohorts.organization_id', activeOrgId);
  }

  const { data: enrollments } = await enrollmentsQuery;
  const currentCourse = (enrollments?.[0] as any)?.cohorts?.courses?.name ?? 'No course';

  const [assignmentCount, submissionCount, gradeCount] = await Promise.all([
    countTable('assignments', filters),     // RLS scopes to student's cohorts
    countTable('submissions', filters),     // RLS scopes to student's own
    countTable('grades', filters),          // RLS scopes to student's own
  ]);

  const pendingCount = Math.max(0, assignmentCount - submissionCount);

  // Fetch actual attendance logs
  let attendanceQuery = supabase.from('attendance').select('status');
  if (activeOrgId) {
    attendanceQuery = attendanceQuery.eq('organization_id', activeOrgId);
  }
  const { data: attData } = await attendanceQuery;
  const totalDays = attData?.length || 0;
  const presentDays = attData?.filter(a => a.status === 'present' || a.status === 'late').length || 0;
  const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  return [
    { label: 'Current Course', value: currentCourse, detail: 'Active enrollment', color: 'purple' },
    { label: 'Total Assignments', value: assignmentCount.toLocaleString(), detail: 'In your cohort', color: 'amber' },
    { label: 'Submitted', value: submissionCount.toLocaleString(), detail: 'Assignments done', color: 'purple' },
    { label: 'Pending', value: pendingCount.toLocaleString(), detail: 'Need submission', color: 'amber' },
    { label: 'Attendance', value: `${attendancePct}%`, detail: `${presentDays}/${totalDays} days marked`, color: 'purple' },
  ];
}

export async function fetchStudentAssignments(activeOrgId?: string): Promise<(AssignmentRow & { submission?: SubmissionRow })[]> {
  const supabase = createClient();

  let query = supabase
    .from('assignments')
    .select('id, title, max_score, cohort_id, organization_id, created_at, cohorts(name, courses(name))');

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data: assignments, error: aErr } = await query.order('created_at', { ascending: false });
  if (aErr) { console.error('fetchStudentAssignments error:', aErr.message); return []; }

  // Fetch the student's own submissions
  let subQuery = supabase
    .from('submissions')
    .select('id, content, student_id, assignment_id, created_at, updated_at, grades(score, grader_id)');

  if (activeOrgId) {
    subQuery = subQuery.eq('organization_id', activeOrgId);
  }

  const { data: submissions } = await subQuery;

  const subMap = new Map((submissions ?? []).map((s: any) => [s.assignment_id, s]));
  return (assignments ?? []).map((a: any) => ({
    ...a,
    submission: subMap.get(a.id) ?? undefined,
  }));
}

export async function fetchStudentGrades(activeOrgId?: string): Promise<GradeRow[]> {
  const supabase = createClient();
  let query = supabase
    .from('grades')
    .select('id, score, grader_id, submission_id, created_at, submissions(content, assignments(title, max_score))');

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) { console.error('fetchStudentGrades error:', error.message); return []; }
  return (data as any) ?? [];
}

export async function fetchCurrentStudentProfile(): Promise<{ id: string; organization_id: string } | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('student_profiles')
    .select('id, organization_id')
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('fetchCurrentStudentProfile error:', error.message);
    return null;
  }
  return data;
}

export async function fetchStudents(activeOrgId?: string): Promise<any[]> {
  const supabase = createClient();
  let query = supabase
    .from('student_profiles')
    .select('id, user_id, organization_id, branch, guardian_name, guardian_phone, created_at, users!user_id(email, full_name), memberships:organization_memberships!membership_id(id, status)');

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('fetchStudents error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchPendingStudentInvites(activeOrgId?: string): Promise<any[]> {
  const supabase = createClient();
  let query = supabase
    .from('invites')
    .select('id, email, role_id, status, expires_at, created_at, roles(code, label)')
    .eq('status', 'pending');

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    console.error('fetchPendingStudentInvites error:', error.message);
    return [];
  }
  return (data ?? []).filter((inv: any) => inv.roles?.code === 'student');
}

export async function fetchCohortStudents(cohortId: string): Promise<any[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('cohort_students')
    .select('student_profile_id, student_profiles!inner(id, user_id, branch, users!inner(email, full_name))')
    .eq('cohort_id', cohortId)
    .eq('status', 'enrolled');

  if (error) {
    console.error('fetchCohortStudents error:', error.message);
    return [];
  }
  return (data ?? []).map((row: any) => row.student_profiles).filter(Boolean);
}

export async function fetchStudentAttendance(studentProfileId: string, activeOrgId?: string): Promise<any[]> {
  const supabase = createClient();
  let query = supabase
    .from('attendance')
    .select('id, date, status, cohort_id, cohorts(name)')
    .eq('student_id', studentProfileId);

  if (activeOrgId) {
    query = query.eq('organization_id', activeOrgId);
  }

  const { data, error } = await query.order('date', { ascending: false });
  if (error) {
    console.error('fetchStudentAttendance error:', error.message);
    return [];
  }
  return data ?? [];
}
