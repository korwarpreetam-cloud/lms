// =====================================================================
// types/index.ts
// Unified TypeScript definitions for database rows and claims.
// =====================================================================

export type User = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

export type Role = {
  id: number;
  code: string;
  label: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at: string;
};

export type Membership = {
  membership_id: string;
  org_id: string;
  org_name: string;
  org_slug: string;
  role: string;
  role_rank: number;
};

export type AppClaims = {
  memberships: Membership[];
  active_org_id: string | null;
  active_role: string | null;
  account_disabled: boolean;
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

export type DashboardMetric = {
  label: string;
  value: string;
  change?: string;
  detail?: string;
  trend?: 'up' | 'down' | 'flat';
  color: 'purple' | 'amber';
};

export type NavigationItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
};
