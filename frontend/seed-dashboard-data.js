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

async function runSeed() {
  try {
    console.log('Seeding dashboard mock-linkages and data...');

    // 1. Get organization ID (robotics-north)
    const orgSlug = 'robotics-north';
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single();
    if (orgErr || !org) throw new Error(`Could not find organization: ${orgErr?.message}`);
    const orgId = org.id;
    console.log(`Found Organization ID: ${orgId}`);

    // 2. Get Cohort ID (Batch 2026-A)
    const { data: cohort, error: cohortErr } = await supabase
      .from('cohorts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('name', 'Batch 2026-A')
      .single();
    if (cohortErr || !cohort) throw new Error(`Could not find cohort: ${cohortErr?.message}`);
    const cohortId = cohort.id;
    console.log(`Found Cohort ID: ${cohortId}`);

    // 3. Find Student Profile ID for student@robotics.com
    console.log('Searching for student account...');
    const { data: authUsers, error: usersErr } = await supabase.auth.admin.listUsers();
    if (usersErr) throw usersErr;

    const studentUser = authUsers.users.find(u => u.email.toLowerCase() === 'student@robotics.com');
    const trainerUser = authUsers.users.find(u => u.email.toLowerCase() === 'trainer@robotics.com');

    if (!studentUser) throw new Error('student@robotics.com user not found in auth. Please run npm run seed first.');
    if (!trainerUser) throw new Error('trainer@robotics.com user not found in auth. Please run npm run seed first.');

    const { data: studentProfile, error: profileErr } = await supabase
      .from('student_profiles')
      .select('id')
      .eq('user_id', studentUser.id)
      .single();
    if (profileErr || !studentProfile) throw new Error(`Could not find student profile: ${profileErr?.message}`);
    console.log(`Found Student Profile ID: ${studentProfile.id}`);

    // 4. Link Student to Cohort
    console.log('Linking Student to Cohort...');
    const { error: studentLinkErr } = await supabase
      .from('cohort_students')
      .upsert({
        cohort_id: cohortId,
        student_profile_id: studentProfile.id
      }, { onConflict: 'cohort_id,student_profile_id' });
    if (studentLinkErr) throw studentLinkErr;
    console.log('Student linked to cohort successfully.');

    // 5. Find Trainer Membership ID for trainer@robotics.com
    const { data: trainerMem, error: memErr } = await supabase
      .from('organization_memberships')
      .select('id')
      .eq('user_id', trainerUser.id)
      .eq('organization_id', orgId)
      .single();
    if (memErr || !trainerMem) throw new Error(`Could not find trainer membership: ${memErr?.message}`);
    console.log(`Found Trainer Membership ID: ${trainerMem.id}`);

    // 6. Link Trainer to Cohort
    console.log('Linking Trainer to Cohort...');
    const { error: trainerLinkErr } = await supabase
      .from('cohort_trainers')
      .upsert({
        cohort_id: cohortId,
        membership_id: trainerMem.id
      }, { onConflict: 'cohort_id,membership_id' });
    if (trainerLinkErr) throw trainerLinkErr;
    console.log('Trainer linked to cohort successfully.');

    // 7. Seed Assignments
    console.log('Seeding assignments...');
    const assignments = [
      { title: 'Project 1: Basic Sensor Grid', max_score: 100 },
      { title: 'Homework 2: Write-Up on RLS Security', max_score: 50 },
      { title: 'Final Lab: Build a Robot Arm Simulation', max_score: 150 }
    ];

    const seededAssignments = [];
    for (const a of assignments) {
      // Check if assignment exists
      const { data: existing, error: findErr } = await supabase
        .from('assignments')
        .select('*')
        .eq('cohort_id', cohortId)
        .eq('title', a.title)
        .maybeSingle();

      if (findErr) throw findErr;

      let assignmentData = existing;
      if (!existing) {
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
        if (insertErr) throw insertErr;
        assignmentData = inserted;
        console.log(`Assignment inserted: "${a.title}"`);
      } else {
        console.log(`Assignment already exists: "${a.title}"`);
      }
      seededAssignments.push(assignmentData);
    }

    // 8. Seed a past submission for the first assignment to let trainer grade it
    console.log('Seeding a past submission for trainer grading...');
    const { error: subErr } = await supabase
      .from('submissions')
      .upsert({
        organization_id: orgId,
        assignment_id: seededAssignments[0].id,
        student_id: studentProfile.id,
        content: 'Here is my submission for Project 1. I connected the sensor grid successfully.\n\nRepository: https://github.com/student/sensor-grid'
      }, { onConflict: 'assignment_id,student_id' });
    if (subErr) throw subErr;
    console.log('Past submission seeded successfully!');

    console.log('\n======================================================');
    console.log('SUCCESS: Dashboard relationship seed complete!');
    console.log('You can now log in and see live data in your dashboards!');
    console.log('======================================================');

  } catch (err) {
    console.error('Seeding relationships failed:', err.message);
    process.exit(1);
  }
}

runSeed();
