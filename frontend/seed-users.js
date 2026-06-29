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

const USERS = [
  { email: 'owner@robotics.com', password: 'password123', role: 'owner', roleId: 1 },
  { email: 'team@robotics.com', password: 'password123', role: 'core_team', roleId: 2 },
  { email: 'trainer@robotics.com', password: 'password123', role: 'trainer', roleId: 3 },
  { email: 'student@robotics.com', password: 'password123', role: 'student', roleId: 4 }
];

async function seed() {
  try {
    console.log('Fetching seeded organization robotics-north...');
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', 'robotics-north')
      .single();

    if (orgError || !org) {
      throw new Error(`Failed to find robotics-north organization. Error: ${orgError?.message}`);
    }
    const orgId = org.id;
    console.log(`Found organization ID: ${orgId}`);

    // List existing auth users to clean up
    console.log('Cleaning up existing matching accounts...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const emailsToCreate = USERS.map(u => u.email.toLowerCase());
    for (const user of users) {
      if (emailsToCreate.includes(user.email.toLowerCase())) {
        console.log(`Deleting existing auth user: ${user.email}`);
        await supabase.auth.admin.deleteUser(user.id);
      }
    }

    // Double check clean up in public schema to avoid constraints issues
    for (const email of emailsToCreate) {
      await supabase.from('users').delete().eq('email', email);
    }

    // Create fresh users and insert their memberships
    for (const userSpec of USERS) {
      console.log(`Creating user: ${userSpec.email}...`);
      const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
        email: userSpec.email,
        password: userSpec.password,
        email_confirm: true
      });

      if (createError) {
        throw new Error(`Failed to create auth user ${userSpec.email}: ${createError.message}`);
      }

      console.log(`Creating membership for ${userSpec.email} as ${userSpec.role}...`);
      const { error: membershipError } = await supabase
        .from('organization_memberships')
        .insert({
          organization_id: orgId,
          user_id: user.id,
          role_id: userSpec.roleId,
          status: 'active'
        });

      if (membershipError) {
        throw new Error(`Failed to create membership: ${membershipError.message}`);
      }

      // If the role is student, create a student profile
      if (userSpec.role === 'student') {
        console.log(`Creating student profile for ${userSpec.email}...`);
        
        // Fetch membership id
        const { data: membership, error: memFetchError } = await supabase
          .from('organization_memberships')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', orgId)
          .single();

        if (memFetchError || !membership) {
          throw new Error(`Failed to find membership to link profile: ${memFetchError?.message}`);
        }

        const { error: profileError } = await supabase
          .from('student_profiles')
          .insert({
            membership_id: membership.id,
            user_id: user.id,
            organization_id: orgId,
            branch: 'East Campus',
            metadata: { notes: 'Seeded test student profile' }
          });

        if (profileError) {
          throw new Error(`Failed to create student profile: ${profileError.message}`);
        }
      }
    }

    console.log('\n=========================================');
    console.log('SUCCESS: All 4 users seeded successfully!');
    console.log('=========================================');
    console.log('Owner Console (Owner Dashboard):');
    console.log('  Email:    owner@robotics.com');
    console.log('  Password: password123\n');
    console.log('Operations Team Console (Team Dashboard):');
    console.log('  Email:    team@robotics.com');
    console.log('  Password: password123\n');
    console.log('Trainer Console (Trainer Dashboard):');
    console.log('  Email:    trainer@robotics.com');
    console.log('  Password: password123\n');
    console.log('Student Hub (Student Dashboard):');
    console.log('  Email:    student@robotics.com');
    console.log('  Password: password123');
    console.log('=========================================');

  } catch (err) {
    console.error('Seeding process failed:', err.message);
    process.exit(1);
  }
}

seed();
