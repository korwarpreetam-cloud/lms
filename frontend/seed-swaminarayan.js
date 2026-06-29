const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local for keys
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found at', envPath);
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Prepare the list of users to create
const USERS = [];

// 1 Owner
USERS.push({ email: 'owner@swaminarayan.com', password: 'password123', role: 'owner', roleId: 1 });

// 5 Core Team
for (let i = 1; i <= 5; i++) {
  USERS.push({ email: `team${i}@swaminarayan.com`, password: 'password123', role: 'core_team', roleId: 2 });
}

// 2 Trainers
for (let i = 1; i <= 2; i++) {
  USERS.push({ email: `trainer${i}@swaminarayan.com`, password: 'password123', role: 'trainer', roleId: 3 });
}

// 30 Students
for (let i = 1; i <= 30; i++) {
  USERS.push({ email: `student${i}@swaminarayan.com`, password: 'password123', role: 'student', roleId: 4 });
}

async function seed() {
  try {
    console.log('Seeding Swaminarayan Academy data...');

    // 1. Create or get Organization "Swaminarayan Academy"
    console.log('Creating organization "Swaminarayan Academy"...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .upsert({
        name: 'Swaminarayan Academy',
        slug: 'swaminarayan',
        is_active: true
      }, { onConflict: 'slug' })
      .select('id')
      .single();

    if (orgError || !org) {
      throw new Error(`Failed to upsert Swaminarayan organization. Error: ${orgError?.message}`);
    }
    const orgId = org.id;
    console.log(`Organization ID: ${orgId}`);

    // 2. Create Course "Full Stack Web Development"
    console.log('Checking if course "Full Stack Web Development" exists...');
    const { data: existingCourse, error: checkCourseError } = await supabase
      .from('courses')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', 'Full Stack Web Development')
      .maybeSingle();

    if (checkCourseError) throw checkCourseError;

    let courseId;
    if (existingCourse) {
      courseId = existingCourse.id;
      console.log(`Found existing Course ID: ${courseId}`);
    } else {
      console.log('Creating course "Full Stack Web Development"...');
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          organization_id: orgId,
          name: 'Full Stack Web Development',
          description: 'Comprehensive program covering HTML5, CSS3, React, Next.js, and Supabase.',
          is_active: true
        })
        .select('id')
        .single();

      if (courseError || !course) {
        throw new Error(`Failed to insert course. Error: ${courseError?.message}`);
      }
      courseId = course.id;
      console.log(`Created Course ID: ${courseId}`);
    }

    // 3. Create Cohort "Swaminarayan Batch 2026"
    console.log('Checking if cohort "Swaminarayan Batch 2026" exists...');
    const { data: existingCohort, error: checkCohortError } = await supabase
      .from('cohorts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('course_id', courseId)
      .eq('name', 'Swaminarayan Batch 2026')
      .maybeSingle();

    if (checkCohortError) throw checkCohortError;

    let cohortId;
    if (existingCohort) {
      cohortId = existingCohort.id;
      console.log(`Found existing Cohort ID: ${cohortId}`);
    } else {
      console.log('Creating cohort "Swaminarayan Batch 2026"...');
      const { data: cohort, error: cohortError } = await supabase
        .from('cohorts')
        .insert({
          organization_id: orgId,
          course_id: courseId,
          name: 'Swaminarayan Batch 2026',
          status: 'active',
          start_date: '2026-01-01',
          end_date: '2026-12-31'
        })
        .select('id')
        .single();

      if (cohortError || !cohort) {
        throw new Error(`Failed to insert cohort. Error: ${cohortError?.message}`);
      }
      cohortId = cohort.id;
      console.log(`Created Cohort ID: ${cohortId}`);
    }

    // 4. Clean up any existing auth users to avoid conflicts
    console.log('Fetching existing users for cleanup...');
    const { data: { users: existingAuthUsers }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const emailsToCreate = USERS.map(u => u.email.toLowerCase());
    for (const authUser of existingAuthUsers) {
      if (emailsToCreate.includes(authUser.email.toLowerCase())) {
        console.log(`Deleting existing auth user: ${authUser.email}`);
        await supabase.auth.admin.deleteUser(authUser.id);
      }
    }

    // Clean public tables to avoid constraint issues
    for (const email of emailsToCreate) {
      await supabase.from('users').delete().eq('email', email);
    }

    const trainerMembershipIds = [];
    const trainerUserIds = [];
    const studentProfileIds = [];
    const studentUserIds = [];

    // 5. Create fresh users & memberships
    for (const userSpec of USERS) {
      console.log(`Creating user: ${userSpec.email}...`);
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: userSpec.email,
        password: userSpec.password,
        email_confirm: true,
        user_metadata: { full_name: userSpec.role.charAt(0).toUpperCase() + userSpec.role.slice(1) + ' User' }
      });

      if (createError) {
        throw new Error(`Failed to create auth user ${userSpec.email}: ${createError.message}`);
      }

      // Explicitly update public.users name since the sync trigger handles it
      const fullName = `${userSpec.role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} ${userSpec.email.split('@')[0].replace(/\d+/g, '')}`;
      await supabase
        .from('users')
        .update({ full_name: fullName })
        .eq('id', user.id);

      console.log(`Creating membership for ${userSpec.email} as ${userSpec.role}...`);
      const { data: membership, error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: orgId,
          user_id: user.id,
          role_id: userSpec.roleId,
          status: 'active'
        })
        .select('id')
        .single();

      if (membershipError || !membership) {
        throw new Error(`Failed to create membership for ${userSpec.email}: ${membershipError?.message}`);
      }

      if (userSpec.role === 'trainer') {
        trainerMembershipIds.push(membership.id);
        trainerUserIds.push(user.id);
      }

      if (userSpec.role === 'student') {
        console.log(`Creating student profile for ${userSpec.email}...`);
        const { data: profile, error: profileError } = await supabase
          .from('student_profiles')
          .insert({
            membership_id: membership.id,
            user_id: user.id,
            organization_id: orgId,
            branch: 'Swaminarayan Campus',
            metadata: { notes: `Student ${userSpec.email.match(/\d+/)?.[0] || ''} at Swaminarayan Academy` }
          })
          .select('id')
          .single();

        if (profileError || !profile) {
          throw new Error(`Failed to create student profile for ${userSpec.email}: ${profileError?.message}`);
        }

        studentProfileIds.push(profile.id);
        studentUserIds.push(user.id);

        // Link student to cohort
        const { error: studentLinkErr } = await supabase
          .from('cohort_students')
          .insert({
            cohort_id: cohortId,
            student_profile_id: profile.id,
            status: 'enrolled'
          });
        if (studentLinkErr) {
          throw new Error(`Failed to link student to cohort: ${studentLinkErr.message}`);
        }
      }
    }

    // 6. Link Trainers to Cohort
    for (const trainerMemId of trainerMembershipIds) {
      console.log(`Linking trainer membership ${trainerMemId} to cohort...`);
      const { error: trainerLinkErr } = await supabase
        .from('cohort_trainers')
        .insert({
          cohort_id: cohortId,
          membership_id: trainerMemId,
          is_lead: trainerMembershipIds.indexOf(trainerMemId) === 0
        });
      if (trainerLinkErr) {
        throw new Error(`Failed to link trainer to cohort: ${trainerLinkErr.message}`);
      }
    }

    // 7. Seed Assignments
    console.log('Seeding assignments for Swaminarayan cohort...');
    const assignments = [
      { title: 'Assignment 1: Responsive Layouts with Flexbox & Grid', max_score: 100 },
      { title: 'Assignment 2: React Interactive Form with State', max_score: 100 },
      { title: 'Assignment 3: Next.js API Routes & Supabase CRUD', max_score: 150 }
    ];

    const seededAssignments = [];
    for (const a of assignments) {
      const { data: inserted, error: insertErr } = await supabase
        .from('assignments')
        .insert({
          organization_id: orgId,
          cohort_id: cohortId,
          title: a.title,
          max_score: a.max_score
        })
        .select()
        .single();
      if (insertErr) throw new Error(`Failed to insert assignment ${a.title}: ${insertErr.message}`);
      seededAssignments.push(inserted);
    }
    console.log(`Seeded ${seededAssignments.length} assignments.`);

    // 8. Seed submissions and grades for the first 5 students
    console.log('Seeding submissions and grades for the first 5 students...');

    for (let i = 0; i < 5; i++) {
      const studentProfileId = studentProfileIds[i];
      const studentEmail = `student${i + 1}@swaminarayan.com`;

      // Submission for Assignment 1
      console.log(`Seeding submission on Assignment 1 for ${studentEmail}...`);
      const { data: sub1, error: sub1Err } = await supabase
        .from('submissions')
        .insert({
          organization_id: orgId,
          assignment_id: seededAssignments[0].id,
          student_id: studentProfileId,
          content: `Hi trainer, here is my solution for Assignment 1. I built a beautiful landing page with Flexbox. Git repo: https://github.com/swaminarayan-student-${i + 1}/flexbox-landing`
        })
        .select()
        .single();

      if (sub1Err) throw new Error(`Failed to insert submission 1 for student ${i + 1}: ${sub1Err.message}`);

      // Grade for Assignment 1
      console.log(`Grading Assignment 1 for ${studentEmail}...`);
      const score = 85 + i * 3; // 85, 88, 91, 94, 97
      const { error: grade1Err } = await supabase
        .from('grades')
        .insert({
          organization_id: orgId,
          submission_id: sub1.id,
          score,
          grader_id: trainerUserIds[0] // Graded by Trainer 1's User UUID
        });
      if (grade1Err) throw new Error(`Failed to grade submission 1: ${grade1Err.message}`);

      // Submission for Assignment 2 (Not Graded yet)
      console.log(`Seeding submission on Assignment 2 for ${studentEmail}...`);
      const { error: sub2Err } = await supabase
        .from('submissions')
        .insert({
          organization_id: orgId,
          assignment_id: seededAssignments[1].id,
          student_id: studentProfileId,
          content: `Here is my react form task submission. I handled state changes and forms validation successfully. Live link: https://swaminarayan-student-${i + 1}-react-form.vercel.app`
        });
      if (sub2Err) throw new Error(`Failed to insert submission 2: ${sub2Err.message}`);
    }

    // 9. Link Robotics.com default users to Swaminarayan Academy for quick switcher access
    console.log('Linking default robotics.com users to Swaminarayan Academy...');
    const roboticsUsers = [
      { email: 'owner@robotics.com', roleId: 1, isStudent: false },
      { email: 'team@robotics.com', roleId: 2, isStudent: false },
      { email: 'trainer@robotics.com', roleId: 3, isStudent: false },
      { email: 'student@robotics.com', roleId: 4, isStudent: true }
    ];

    for (const rUser of roboticsUsers) {
      // Find auth user
      const foundUser = existingAuthUsers.find(u => u.email.toLowerCase() === rUser.email.toLowerCase());
      if (foundUser) {
        console.log(`Linking existing user ${rUser.email} to Swaminarayan Academy...`);
        
        // Check if membership already exists to prevent duplicate key
        const { data: existingMem } = await supabase
          .from('organization_memberships')
          .select('id')
          .eq('user_id', foundUser.id)
          .eq('organization_id', orgId)
          .eq('role_id', rUser.roleId)
          .maybeSingle();

        let membershipId;
        if (!existingMem) {
          const { data: membership, error: memError } = await supabase
            .from('organization_memberships')
            .insert({
              organization_id: orgId,
              user_id: foundUser.id,
              role_id: rUser.roleId,
              status: 'active'
            })
            .select('id')
            .single();

          if (memError) {
            console.error(`Failed to link robotics user ${rUser.email} to Swaminarayan:`, memError.message);
          } else {
            membershipId = membership.id;
          }
        } else {
          membershipId = existingMem.id;
        }

        // If it's a student, create profile and link to cohort
        if (rUser.isStudent && membershipId) {
          // Check if student profile exists
          const { data: existingProfile } = await supabase
            .from('student_profiles')
            .select('id')
            .eq('user_id', foundUser.id)
            .eq('organization_id', orgId)
            .maybeSingle();

          let profileId;
          if (!existingProfile) {
            const { data: profile, error: profileError } = await supabase
              .from('student_profiles')
              .insert({
                membership_id: membershipId,
                user_id: foundUser.id,
                organization_id: orgId,
                branch: 'Swaminarayan Campus',
                metadata: { notes: 'Linked default student profile to Swaminarayan' }
              })
              .select('id')
              .single();

            if (profileError) {
              console.error(`Failed to create student profile for robotics student:`, profileError.message);
            } else {
              profileId = profile.id;
            }
          } else {
            profileId = existingProfile.id;
          }

          if (profileId) {
            // Link student to cohort
            await supabase
              .from('cohort_students')
              .upsert({
                cohort_id: cohortId,
                student_profile_id: profileId,
                status: 'enrolled'
              }, { onConflict: 'cohort_id,student_profile_id' });
          }
        }
      }
    }


    console.log('\n=========================================');
    console.log('SUCCESS: Swaminarayan Academy data seeded!');
    console.log('=========================================');
    console.log('Credentials list:');
    console.log('- Owner:    owner@swaminarayan.com (password123)');
    console.log('- Core Team: team1@swaminarayan.com to team5@swaminarayan.com (password123)');
    console.log('- Trainer:  trainer1@swaminarayan.com, trainer2@swaminarayan.com (password123)');
    console.log('- Student:  student1@swaminarayan.com to student30@swaminarayan.com (password123)');
    console.log('=========================================');

  } catch (err) {
    console.error('Seeding process failed:', err.message);
    process.exit(1);
  }
}

seed();
