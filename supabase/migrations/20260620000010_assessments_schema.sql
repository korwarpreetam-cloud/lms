-- =====================================================================
-- 00010_assessments_schema.sql
-- Purpose: Schema definitions, triggers, constraints, and RLS policies
--          for assignments, student submissions, grades, and quizzes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- ASSIGNMENTS
-- ---------------------------------------------------------------------
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cohort_id       uuid not null references public.cohorts(id) on delete cascade,
  title           text not null check (char_length(title) between 1 and 200),
  max_score       integer not null check (max_score > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_assignments_cohort on public.assignments (cohort_id);
create index idx_assignments_org on public.assignments (organization_id);

create trigger trg_assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

-- Enforce organization consistency: cohort's organization must match assignment's organization
create or replace function public.enforce_assignment_cohort_same_org()
returns trigger
language plpgsql
as $$
declare
  v_cohort_org uuid;
begin
  select organization_id into v_cohort_org from public.cohorts where id = new.cohort_id;
  if v_cohort_org is null then
    raise exception 'COHORT_NOT_FOUND';
  end if;
  if v_cohort_org <> new.organization_id then
    raise exception 'COHORT_ORG_MISMATCH' using
      detail = 'Assignment organization_id must match its cohort organization_id.';
  end if;
  return new;
end;
$$;

create trigger trg_assignments_cohort_org_check
  before insert or update on public.assignments
  for each row execute function public.enforce_assignment_cohort_same_org();

-- ---------------------------------------------------------------------
-- SUBMISSIONS
-- ---------------------------------------------------------------------
create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id   uuid not null references public.assignments(id) on delete cascade,
  student_id      uuid not null references public.student_profiles(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index idx_submissions_assignment on public.submissions (assignment_id);
create index idx_submissions_student on public.submissions (student_id);

create trigger trg_submissions_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- Enforce tenant consistency: student and assignment must share the submission's organization
create or replace function public.enforce_submission_consistency()
returns trigger
language plpgsql
as $$
declare
  v_assignment_org uuid;
  v_student_org uuid;
begin
  select organization_id into v_assignment_org from public.assignments where id = new.assignment_id;
  select organization_id into v_student_org from public.student_profiles where id = new.student_id;

  if v_assignment_org is null or v_student_org is null then
    raise exception 'ASSIGNMENT_OR_STUDENT_NOT_FOUND';
  end if;

  if v_assignment_org <> new.organization_id or v_student_org <> new.organization_id then
    raise exception 'TENANT_ORGANIZATION_MISMATCH' using
      detail = 'Submission organization_id must match both assignment and student profile organization_ids.';
  end if;

  return new;
end;
$$;

create trigger trg_submissions_consistency_check
  before insert or update on public.submissions
  for each row execute function public.enforce_submission_consistency();

-- ---------------------------------------------------------------------
-- SUBMISSION_ATTEMPTS (History Log)
-- ---------------------------------------------------------------------
create table public.submission_attempts (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now()
);

create index idx_submission_attempts_sub on public.submission_attempts (submission_id);

-- Trigger to automatically log submission attempts
create or replace function public.on_submission_upsert()
returns trigger
language plpgsql
as $$
begin
  insert into public.submission_attempts (submission_id, content)
  values (new.id, new.content);
  return new;
end;
$$;

create trigger trg_submissions_log_attempt
  after insert or update of content on public.submissions
  for each row execute function public.on_submission_upsert();

-- ---------------------------------------------------------------------
-- GRADES
-- ---------------------------------------------------------------------
create table public.grades (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  submission_id   uuid not null unique references public.submissions(id) on delete cascade,
  score           numeric not null,
  grader_id       uuid not null references public.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_grades_submission on public.grades (submission_id);

create trigger trg_grades_updated_at
  before update on public.grades
  for each row execute function public.set_updated_at();

-- Enforce:
-- 1. Grade bounds: 0 <= score <= assignment.max_score
-- 2. Tenant consistency: submission and grader must belong to the grade's organization
-- 3. Prevent submissions from being updated once they are graded (checked in submissions update policy/trigger)
create or replace function public.enforce_grade_constraints()
returns trigger
language plpgsql
as $$
declare
  v_submission_org uuid;
  v_assignment_max_score numeric;
  v_grader_has_membership boolean;
begin
  select s.organization_id, a.max_score 
  into v_submission_org, v_assignment_max_score 
  from public.submissions s
  join public.assignments a on a.id = s.assignment_id
  where s.id = new.submission_id;

  if v_submission_org is null then
    raise exception 'SUBMISSION_NOT_FOUND';
  end if;

  if v_submission_org <> new.organization_id then
    raise exception 'TENANT_ORGANIZATION_MISMATCH' using
      detail = 'Grade organization_id must match submission organization_id.';
  end if;

  if new.score < 0 or new.score > v_assignment_max_score then
    raise exception 'GRADE_OUT_OF_BOUNDS' using
      detail = 'Grade score must be between 0 and the assignment max_score.';
  end if;

  -- Ensure grader is a member of the organization
  select exists (
    select 1 from public.organization_memberships
    where user_id = new.grader_id 
      and organization_id = new.organization_id
      and status = 'active'
  ) into v_grader_has_membership;

  if not v_grader_has_membership then
    raise exception 'GRADER_NOT_MEMBER' using
      detail = 'The grader is not an active member of this organization.';
  end if;

  return new;
end;
$$;

create trigger trg_grades_constraints_check
  before insert or update on public.grades
  for each row execute function public.enforce_grade_constraints();

-- Prevent updating a submission once a grade exists for it
create or replace function public.enforce_submission_unlocked_check()
returns trigger
language plpgsql
as $$
declare
  v_is_graded boolean;
begin
  select exists (
    select 1 from public.grades where submission_id = new.id
  ) into v_is_graded;

  if v_is_graded and new.content is distinct from old.content then
    raise exception 'SUBMISSION_LOCKED' using
      detail = 'Cannot modify submission contents after a grade has been issued.';
  end if;

  return new;
end;
$$;

create trigger trg_submissions_lock_check
  before update on public.submissions
  for each row execute function public.enforce_submission_unlocked_check();

-- ---------------------------------------------------------------------
-- QUIZZES
-- ---------------------------------------------------------------------
create table public.quizzes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  course_id       uuid not null references public.courses(id) on delete restrict,
  title           text not null check (char_length(title) between 1 and 200),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_quizzes_course on public.quizzes (course_id);

create trigger trg_quizzes_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

-- Enforce: quiz course belongs to the quiz organization
create or replace function public.enforce_quiz_course_same_org()
returns trigger
language plpgsql
as $$
declare
  v_course_org uuid;
begin
  select organization_id into v_course_org from public.courses where id = new.course_id;
  if v_course_org is null then
    raise exception 'COURSE_NOT_FOUND';
  end if;
  if v_course_org <> new.organization_id then
    raise exception 'COURSE_ORG_MISMATCH' using
      detail = 'Quiz organization_id must match its course organization_id.';
  end if;
  return new;
end;
$$;

create trigger trg_quizzes_course_org_check
  before insert or update on public.quizzes
  for each row execute function public.enforce_quiz_course_same_org();

-- ---------------------------------------------------------------------
-- QUIZ_QUESTIONS
-- ---------------------------------------------------------------------
create table public.quiz_questions (
  id              uuid primary key default gen_random_uuid(),
  quiz_id         uuid not null references public.quizzes(id) on delete cascade,
  question_text   text not null,
  options         jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_quiz_questions_quiz on public.quiz_questions (quiz_id);

create trigger trg_quiz_questions_updated_at
  before update on public.quiz_questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- QUIZ_ANSWER_KEYS (Answer keys - hidden from students)
-- ---------------------------------------------------------------------
create table public.quiz_answer_keys (
  question_id     uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_answer  text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_quiz_answer_keys_updated_at
  before update on public.quiz_answer_keys
  for each row execute function public.set_updated_at();


-- =====================================================================
-- ROW-LEVEL SECURITY & GRANTS
-- =====================================================================

-- Enable RLS on all tables
alter table public.assignments enable row level security;
alter table public.assignments force row level security;

alter table public.submissions enable row level security;
alter table public.submissions force row level security;

alter table public.submission_attempts enable row level security;
alter table public.submission_attempts force row level security;

alter table public.grades enable row level security;
alter table public.grades force row level security;

alter table public.quizzes enable row level security;
alter table public.quizzes force row level security;

alter table public.quiz_questions enable row level security;
alter table public.quiz_questions force row level security;

alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_answer_keys force row level security;

-- Revoke all direct privileges for anon and authenticated
revoke all on public.assignments, public.submissions, public.submission_attempts, public.grades,
  public.quizzes, public.quiz_questions, public.quiz_answer_keys
  from anon, authenticated;

-- Allow service_role complete access
grant all on public.assignments, public.submissions, public.submission_attempts, public.grades,
  public.quizzes, public.quiz_questions, public.quiz_answer_keys
  to service_role;

-- Grant selective authenticated roles access
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
grant select on public.submission_attempts to authenticated;
grant select, insert, update, delete on public.grades to authenticated;
grant select, insert, update, delete on public.quizzes to authenticated;
grant select, insert, update, delete on public.quiz_questions to authenticated;
grant select, insert, update, delete on public.quiz_answer_keys to authenticated;


-- ---------------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------------

-- ASSIGNMENTS Policies
create policy assignments_select_member on public.assignments
  for select to authenticated
  using (public.has_membership_in_org(organization_id));

create policy assignments_write_admin on public.assignments
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

create policy assignments_write_trainer on public.assignments
  for all to authenticated
  using (
    public.is_trainer_for_cohort(cohort_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_trainer_for_cohort(cohort_id)
    and organization_id = public.active_org_id()
  );

-- SUBMISSIONS Policies
-- Student can select/insert/update their own submissions.
-- Trainers can select submissions for cohorts they teach.
-- Admins can select/write submissions.
create policy submissions_select_student on public.submissions
  for select to authenticated
  using (public.is_own_student_profile(student_id));

create policy submissions_select_trainer on public.submissions
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.id = public.submissions.assignment_id
        and public.is_trainer_for_cohort(a.cohort_id)
    )
  );

create policy submissions_select_admin on public.submissions
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

create policy submissions_insert_student on public.submissions
  for insert to authenticated
  with check (
    public.is_own_student_profile(student_id)
    and organization_id = public.active_org_id()
  );

create policy submissions_update_student on public.submissions
  for update to authenticated
  using (
    public.is_own_student_profile(student_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_own_student_profile(student_id)
    and organization_id = public.active_org_id()
  );

create policy submissions_write_admin on public.submissions
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- SUBMISSION_ATTEMPTS Policies
-- Follows submissions access
create policy submission_attempts_select on public.submission_attempts
  for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = public.submission_attempts.submission_id
    )
  );

-- GRADES Policies
-- Student can view grades for their own submissions.
-- Trainers can view grades and write grades for cohorts they teach.
-- Admins can view/write all grades.
create policy grades_select_student on public.grades
  for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = public.grades.submission_id
        and public.is_own_student_profile(s.student_id)
    )
  );

create policy grades_select_trainer on public.grades
  for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = public.grades.submission_id
        and public.is_trainer_for_cohort(a.cohort_id)
    )
  );

create policy grades_select_admin on public.grades
  for select to authenticated
  using (public.is_admin_in_org(organization_id));

create policy grades_write_trainer on public.grades
  for all to authenticated
  using (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = public.grades.submission_id
        and public.is_trainer_for_cohort(a.cohort_id)
        and s.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.submissions s
      join public.assignments a on a.id = s.assignment_id
      where s.id = public.grades.submission_id
        and public.is_trainer_for_cohort(a.cohort_id)
        and s.organization_id = public.active_org_id()
    )
  );

create policy grades_write_admin on public.grades
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- QUIZZES Policies
create policy quizzes_select_member on public.quizzes
  for select to authenticated
  using (public.has_membership_in_org(organization_id));

create policy quizzes_write_admin on public.quizzes
  for all to authenticated
  using (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  )
  with check (
    public.is_admin_in_org(organization_id)
    and organization_id = public.active_org_id()
  );

-- QUIZ_QUESTIONS Policies
create policy quiz_questions_select_member on public.quiz_questions
  for select to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = public.quiz_questions.quiz_id
        and public.has_membership_in_org(q.organization_id)
    )
  );

create policy quiz_questions_write_admin on public.quiz_questions
  for all to authenticated
  using (
    exists (
      select 1 from public.quizzes q
      where q.id = public.quiz_questions.quiz_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.quizzes q
      where q.id = public.quiz_questions.quiz_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  );

-- QUIZ_ANSWER_KEYS Policies (Students specifically excluded from SELECT)
create policy quiz_answer_keys_select_trainer on public.quiz_answer_keys
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      join public.cohorts c on c.course_id = q.course_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_trainer_for_cohort(c.id)
    )
  );

create policy quiz_answer_keys_select_admin on public.quiz_answer_keys
  for select to authenticated
  using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_admin_in_org(q.organization_id)
    )
  );

create policy quiz_answer_keys_write_admin on public.quiz_answer_keys
  for all to authenticated
  using (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.quiz_questions qq
      join public.quizzes q on q.id = qq.quiz_id
      where qq.id = public.quiz_answer_keys.question_id
        and public.is_admin_in_org(q.organization_id)
        and q.organization_id = public.active_org_id()
    )
  );
