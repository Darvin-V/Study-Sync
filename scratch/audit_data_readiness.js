import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const dbPath = path.resolve('server/data/studysync.db');
const db = new DatabaseSync(dbPath);

console.log('=== STUDYSYNC AI DATA READINESS AUDIT ===\n');
console.log(`Database Path: ${dbPath}`);

// 1. All Tables
const tables = db.prepare(`
  SELECT name FROM sqlite_schema 
  WHERE type='table' AND name NOT LIKE 'sqlite_%'
  ORDER BY name ASC
`).all();

console.log(`\nTotal tables found: ${tables.length}`);

// 2. Row counts across all tables
console.log('\n--- Table Record Counts ---');
const tableStats = [];
for (const t of tables) {
  const countRow = db.prepare(`SELECT count(*) as count FROM "${t.name}"`).get();
  tableStats.push({ table: t.name, count: countRow.count });
  console.log(`  - ${t.name.padEnd(35)}: ${countRow.count} rows`);
}

// 3. Detailed inspection of relevant ML candidate tables
const relevantTables = [
  'users',
  'learner_profiles',
  'learning_topics',
  'user_learning_preferences',
  'study_sessions',
  'session_participants',
  'user_focus_intervals',
  'topic_assessments',
  'recommendation_tracking',
  'recommendation_explicit_feedback',
  'peer_collaboration_feedback',
  'circle_members',
  'circle_requests',
];

console.log('\n--- Deep Inspection of ML Candidate Tables ---');
for (const tbl of relevantTables) {
  const exists = tables.some((t) => t.name === tbl);
  if (!exists) {
    console.log(`\nTable [${tbl}] does not exist.`);
    continue;
  }

  console.log(`\n>>> Table: [${tbl}]`);
  const columns = db.prepare(`PRAGMA table_info("${tbl}")`).all();
  console.log(`  Columns (${columns.length}): ${columns.map((c) => `${c.name} (${c.type})`).join(', ')}`);

  const countRow = db.prepare(`SELECT count(*) as count FROM "${tbl}"`).get();
  console.log(`  Total Rows: ${countRow.count}`);

  if (countRow.count > 0) {
    // Check user distribution
    const colNames = columns.map((c) => c.name);
    if (colNames.includes('user_id')) {
      const distinctUsers = db.prepare(`SELECT count(DISTINCT user_id) as count FROM "${tbl}"`).get();
      console.log(`  Distinct Users: ${distinctUsers.count}`);
    }

    // Inspect lifecycle / status columns
    for (const statusCol of ['status', 'lifecycle_status', 'goal_achieved', 'passed', 'was_helpful', 'is_relevant']) {
      if (colNames.includes(statusCol)) {
        const dist = db.prepare(`
          SELECT "${statusCol}", count(*) as cnt 
          FROM "${tbl}" 
          GROUP BY "${statusCol}"
        `).all();
        console.log(`  Distribution of "${statusCol}": ${JSON.stringify(dist)}`);
      }
    }

    // Inspect timestamps
    for (const timeCol of ['created_at', 'started_at', 'assessed_at', 'presented_at']) {
      if (colNames.includes(timeCol)) {
        const timeRange = db.prepare(`
          SELECT MIN("${timeCol}") as earliest, MAX("${timeCol}") as latest, count(*) as cnt
          FROM "${tbl}"
          WHERE "${timeCol}" IS NOT NULL
        `).get();
        console.log(`  Time range for "${timeCol}": ${timeRange.earliest} to ${timeRange.latest} (count: ${timeRange.cnt})`);
      }
    }
  }
}

// 4. Check user origins (seeded vs synthetic vs test vs real)
console.log('\n--- User Origin & Account Nature ---');
const usersSample = db.prepare(`
  SELECT id, email, is_verified, created_at 
  FROM users 
  LIMIT 25
`).all();
console.log(`Total users in studysync.db: ${db.prepare('SELECT count(*) as count FROM users').get().count}`);
const emailDomains = db.prepare(`
  SELECT 
    CASE 
      WHEN email LIKE '%@example.com' THEN '@example.com (seed/test)'
      WHEN email LIKE '%@studysync.ai' THEN '@studysync.ai (seed/test)'
      WHEN email LIKE '%@test.%' THEN '@test.* (test fixture)'
      WHEN email LIKE '%@phase%' THEN '@phase* (test fixture)'
      ELSE 'other/custom domain'
    END as domain_group,
    count(*) as count
  FROM users
  GROUP BY domain_group
`).all();
console.log('User email domain distribution:');
console.log(JSON.stringify(emailDomains, null, 2));

db.close();
