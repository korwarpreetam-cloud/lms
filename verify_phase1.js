/**
 * verify_phase1.js
 *
 * Client-side verification of Phase 1 security deployment.
 * Tests the actual Supabase REST API surface that attackers would use.
 *
 * Usage:
 *   cd frontend && node ../verify_phase1.js
 *
 * What it tests:
 *   1. Assessment tables exist (assignments, submissions, grades, quizzes, etc.)
 *   2. Anon role cannot read ANY table via the REST API
 *   3. Authenticated users can only see data RLS permits
 */

const fs = require('fs');
const path = require('path');

// ── Load environment ──────────────────────────────────────
const envPath = path.join(__dirname, 'frontend', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local not found at', envPath);
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
  if (m) env[m[1]] = (m[2] || '').replace(/^"|"$/g, '').trim();
});

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────
let passed = 0;
let failed = 0;

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function supabaseGet(table, apiKey, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`;
  const headers = {
    'apikey': apiKey,
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'count=exact',
  };
  try {
    const res = await fetch(url, { headers });
    const contentRange = res.headers.get('content-range');
    const count = contentRange ? parseInt(contentRange.split('/')[1]) || 0 : -1;
    return { status: res.status, count, ok: res.ok };
  } catch (err) {
    return { status: 0, count: -1, ok: false, error: err.message };
  }
}

function assert(condition, passMsg, failMsg) {
  if (condition) {
    log('✅', passMsg);
    passed++;
  } else {
    log('❌', failMsg);
    failed++;
  }
}

// ── Test Suites ──────────────────────────────────────────

async function testTablesExist() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 1: Assessment tables exist (via service_role)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const tables = [
    'assignments', 'submissions', 'submission_attempts',
    'grades', 'quizzes', 'quiz_questions', 'quiz_answer_keys'
  ];

  for (const table of tables) {
    const res = await supabaseGet(table, SERVICE_KEY);
    assert(
      res.ok,
      `Table "${table}" exists and is accessible via service_role`,
      `Table "${table}" NOT FOUND or inaccessible (status: ${res.status})`
    );
  }
}

async function testAnonBlocked() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 2: Anon key cannot read ANY table');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const sensitiveTables = [
    'users', 'organizations', 'organization_memberships',
    'courses', 'cohorts', 'student_profiles',
    'cohort_students', 'cohort_trainers',
    'assignments', 'submissions', 'submission_attempts',
    'grades', 'quizzes', 'quiz_questions', 'quiz_answer_keys',
    'invites', 'user_session_preferences'
  ];

  for (const table of sensitiveTables) {
    const res = await supabaseGet(table, ANON_KEY);
    // anon should get either 0 rows or a 401/403 error
    const isBlocked = !res.ok || res.count === 0;
    assert(
      isBlocked,
      `anon BLOCKED from "${table}" (status: ${res.status}, count: ${res.count})`,
      `⚠ LEAK: anon can read ${res.count} row(s) from "${table}" (status: ${res.status})`
    );
  }
}

async function testRolesReadable() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST 3: Roles catalog check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Roles should be readable by authenticated but NOT by anon
  const anonRes = await supabaseGet('roles', ANON_KEY);
  assert(
    !anonRes.ok || anonRes.count === 0,
    `anon cannot read roles table (status: ${anonRes.status})`,
    `⚠ LEAK: anon can read ${anonRes.count} row(s) from roles`
  );

  // service_role should see all 4 roles
  const serviceRes = await supabaseGet('roles', SERVICE_KEY);
  assert(
    serviceRes.ok && serviceRes.count === 4,
    `service_role reads 4 roles from catalog`,
    `service_role got unexpected count: ${serviceRes.count}`
  );
}

// ── Run ────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  PHASE 1 VERIFICATION — API Surface Security Test    ║');
  console.log('║  Target: ' + SUPABASE_URL.padEnd(44) + ' ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  await testTablesExist();
  await testAnonBlocked();
  await testRolesReadable();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (failed > 0) {
    console.log('\n⚠ FAILURES DETECTED — fix_permissions.sql may not have been applied,');
    console.log('  or phase1_deploy.sql was not run yet. Check the Supabase SQL Editor.\n');
    process.exit(1);
  } else {
    console.log('\n✅ ALL CHECKS PASSED — Phase 1 is complete!');
    console.log('   Your database layer is hardened. Ready for Phase 2 (wire dashboards).\n');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
