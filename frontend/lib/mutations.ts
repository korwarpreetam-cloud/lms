// =====================================================================
// lib/mutations.ts
// Database write operations (inserts, updates, RPCs) for Solutiions LMS.
// All requests are run via the browser client and respect Postgres RLS.
// =====================================================================
import { createClient } from './auth';

/**
 * Creates a membership invitation (Admin-only).
 * Calls the `create_invite` RPC.
 * Requires MFA (aal2) active session.
 */
export async function createInvite(email: string, orgId: string, roleCode: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('create_invite', {
    p_email: email,
    p_organization_id: orgId,
    p_role_code: roleCode,
  });

  if (error) {
    console.error('createInvite error:', error.message);
    throw error;
  }

  // Returns array [{ invite_id, raw_token, expires_at }]
  return data?.[0] || null;
}

/**
 * Redeems an invite token (Public/New authenticated user).
 * Calls the `redeem_invite` RPC.
 */
export async function redeemInvite(token: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('redeem_invite', {
    p_raw_token: token,
  });

  if (error) {
    console.error('redeemInvite error:', error.message);
    throw error;
  }

  return data?.[0] || null;
}

/**
 * Submits an assignment solution (Student-only).
 * Inserts or updates a submission row.
 */
export async function submitAssignment(orgId: string, assignmentId: string, studentId: string, content: string) {
  const supabase = createClient();
  
  // Try to upsert the submission (it has a unique constraint on assignment_id + student_id)
  const { data, error } = await supabase
    .from('submissions')
    .upsert({
      organization_id: orgId,
      assignment_id: assignmentId,
      student_id: studentId,
      content,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'assignment_id,student_id'
    })
    .select()
    .single();

  if (error) {
    console.error('submitAssignment error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Grades a student submission (Trainer/Admin).
 * Inserts or updates a grade row.
 */
export async function gradeSubmission(orgId: string, submissionId: string, score: number, graderId: string) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('grades')
    .upsert({
      organization_id: orgId,
      submission_id: submissionId,
      score,
      grader_id: graderId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'submission_id'
    })
    .select()
    .single();

  if (error) {
    console.error('gradeSubmission error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Revokes a membership (Admin-only).
 * Calls the `revoke_membership` RPC.
 * Requires MFA (aal2) active session.
 */
export async function revokeMembership(membershipId: string, reason?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('revoke_membership', {
    p_membership_id: membershipId,
    p_reason: reason || null,
  });

  if (error) {
    console.error('revokeMembership error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Reinstates a revoked membership (Admin-only).
 * Calls the `reinstate_membership` RPC.
 * Requires MFA (aal2) active session.
 */
export async function reinstateMembership(membershipId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('reinstate_membership', {
    p_membership_id: membershipId,
  });

  if (error) {
    console.error('reinstateMembership error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Deactivates a user globally (Admin-only).
 * Calls the `deactivate_user` RPC.
 * Requires MFA (aal2) active session.
 */
export async function deactivateUser(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('deactivate_user', {
    p_user_id: userId,
  });

  if (error) {
    console.error('deactivateUser error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Reactivates a deactivated user globally (Admin-only).
 * Calls the `reactivate_user` RPC.
 * Requires MFA (aal2) active session.
 */
export async function reactivateUser(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('reactivate_user', {
    p_user_id: userId,
  });

  if (error) {
    console.error('reactivateUser error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Invokes the send-invite Deno Edge Function to create an invite
 * and trigger an invitation email delivery.
 */
export async function sendInviteEmail(email: string, orgId: string, roleCode: string) {
  const supabase = createClient();
  const { data, error } = await supabase.functions.invoke('send-invite', {
    body: { email, organizationId: orgId, roleCode },
  });

  if (error) {
    console.error('sendInviteEmail error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Uploads an assignment solution file to the 'assignments' bucket.
 */
export async function uploadAssignmentFile(assignmentId: string, userId: string, file: File) {
  const supabase = createClient();
  const filePath = `${assignmentId}/${userId}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('assignments')
    .upload(filePath, file, { upsert: true });

  if (error) {
    console.error('uploadAssignmentFile error:', error.message);
    throw error;
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from('assignments')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Updates a membership role (Admin-only).
 * Updates the role_id of the specified organization membership.
 * Requires MFA (aal2) active session.
 */
export async function updateMemberRole(membershipId: string, roleId: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('organization_memberships')
    .update({
      role_id: roleId,
      updated_at: new Date().toISOString()
    })
    .eq('id', membershipId)
    .select()
    .single();

  if (error) {
    console.error('updateMemberRole error:', error.message);
    throw error;
  }

  return data;
}

/**
 * Creates a new assignment for a cohort (Trainer/Admin).
 */
export async function createAssignment(orgId: string, cohortId: string, title: string, maxScore: number) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      organization_id: orgId,
      cohort_id: cohortId,
      title,
      max_score: maxScore
    })
    .select()
    .single();

  if (error) {
    console.error('createAssignment error:', error.message);
    throw error;
  }
  return data;
}

/**
 * Saves/marks student attendance (Trainer/Admin).
 */
export async function submitAttendance(orgId: string, cohortId: string, date: string, records: { studentId: string, status: string }[]) {
  const supabase = createClient();
  
  const rows = records.map(r => ({
    organization_id: orgId,
    cohort_id: cohortId,
    student_id: r.studentId,
    date: date,
    status: r.status,
    updated_at: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('attendance')
    .upsert(rows, {
      onConflict: 'cohort_id,student_id,date'
    })
    .select();

  if (error) {
    console.error('submitAttendance error:', error.message);
    throw error;
  }
  return data;
}

/**
 * Creates a new Course (Admin only).
 */
export async function createCourse(orgId: string, name: string, description: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('courses')
    .insert({
      organization_id: orgId,
      name,
      description,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    console.error('createCourse error:', error.message);
    throw error;
  }
  return data;
}

/**
 * Toggles a Course active/inactive status (Admin only).
 */
export async function toggleCourseStatus(courseId: string, isActive: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('courses')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString()
    })
    .eq('id', courseId)
    .select()
    .single();

  if (error) {
    console.error('toggleCourseStatus error:', error.message);
    throw error;
  }
  return data;
}


