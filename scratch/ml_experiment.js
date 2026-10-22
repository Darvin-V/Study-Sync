import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

/**
 * StudySync AI — Phase 6 Evidence-Based Machine Learning Experiment
 * 
 * TASK: Predicting Adaptive Learning Recommendation Follow-Through
 * 
 * Target Variable (Binary):
 *   y = 1 if recommendation is followed through (completed)
 *   y = 0 if recommendation is dismissed or ignored past the observation window (7 days)
 * 
 * STRICT PRIVACY & SAFETY CONTRACT:
 * - Isolated from running production server.
 * - Zero inference of mental state, attention, or personal characteristics.
 * - No paid APIs, cloud services, or external ML services.
 */

console.log('================================================================');
console.log('StudySync AI — Phase 6 Evidence-Based Machine Learning Experiment');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// STEP 1: Audit Data Readiness on Legitimate Database (server/data/studysync.db)
// -----------------------------------------------------------------------------
const dbPath = path.resolve('server/data/studysync.db');
const db = new DatabaseSync(dbPath);

console.log('--- Step 1: Auditing Legitimate Database Records ---');

const totalUsers = db.prepare('SELECT count(*) as c FROM users').get().c;
const totalTracking = db.prepare('SELECT count(*) as c FROM recommendation_tracking').get().c;
const trackingStatuses = db.prepare(`
  SELECT lifecycle_status, count(*) as count 
  FROM recommendation_tracking 
  GROUP BY lifecycle_status
`).all();

const totalAssessments = db.prepare('SELECT count(*) as c FROM topic_assessments').get().c;
const totalFocus = db.prepare('SELECT count(*) as c FROM user_focus_intervals').get().c;
const totalFeedback = db.prepare('SELECT count(*) as c FROM recommendation_explicit_feedback').get().c;
const totalPeerFeedback = db.prepare('SELECT count(*) as c FROM peer_collaboration_feedback').get().c;

console.log(`Users in database:                ${totalUsers}`);
console.log(`Recommendation tracking records: ${totalTracking}`);
console.log(`Tracking lifecycle breakdown:    ${JSON.stringify(trackingStatuses)}`);
console.log(`Topic assessments logged:        ${totalAssessments}`);
console.log(`Focus intervals logged:          ${totalFocus}`);
console.log(`Explicit feedback records:       ${totalFeedback}`);
console.log(`Peer collaboration reviews:      ${totalPeerFeedback}`);

// Check label availability
const followedThroughCount = db.prepare(`
  SELECT count(*) as c FROM recommendation_tracking WHERE lifecycle_status = 'followed_through'
`).get().c;
const dismissedCount = db.prepare(`
  SELECT count(*) as c FROM recommendation_tracking WHERE lifecycle_status = 'dismissed'
`).get().c;
const acceptedCount = db.prepare(`
  SELECT count(*) as c FROM recommendation_tracking WHERE lifecycle_status = 'accepted'
`).get().c;
const presentedOnlyCount = db.prepare(`
  SELECT count(*) as c FROM recommendation_tracking WHERE lifecycle_status = 'presented'
`).get().c;

console.log('\n--- Label Distribution for Supervised Learning ---');
console.log(`  Positive labels (followed_through): ${followedThroughCount}`);
console.log(`  Negative labels (dismissed):        ${dismissedCount}`);
console.log(`  Intermediate (accepted):            ${acceptedCount}`);
console.log(`  Unlabeled / Censored (presented):   ${presentedOnlyCount}`);

const MIN_RECOMMENDED_SAMPLES = 250;
const MIN_POSITIVE_LABELS = 50;
const MIN_NEGATIVE_LABELS = 50;

console.log(`\nStatistical Adequacy Check:`);
console.log(`  Minimum samples required:  ${MIN_RECOMMENDED_SAMPLES} (Found: ${totalTracking})`);
console.log(`  Minimum positive outcomes: ${MIN_POSITIVE_LABELS} (Found: ${followedThroughCount})`);
console.log(`  Minimum negative outcomes: ${MIN_NEGATIVE_LABELS} (Found: ${dismissedCount})`);

const isDataAdequate = (
  totalTracking >= MIN_RECOMMENDED_SAMPLES &&
  followedThroughCount >= MIN_POSITIVE_LABELS &&
  dismissedCount >= MIN_NEGATIVE_LABELS
);

if (!isDataAdequate) {
  console.log('\n🚨 DATA READINESS AUDIT CONCLUSION: INSUFFICIENT DATA');
  console.log('Reason: The production database contains only 8 recommendation records, all in');
  console.log('status "presented" (0 positive labels, 0 negative labels, zero label variance).');
  console.log('Attempting to fit a supervised ML model directly on this dataset would result in:');
  console.log('  1. Ill-conditioned mathematical formulation (zero variance in y).');
  console.log('  2. Extreme overfitting to single-user test fixtures.');
  console.log('  3. High probability of fabricated conclusions.');
  console.log('\nAction: Model training on real data is strictly HALTED per Phase 6 instructions.');
}

db.close();

// -----------------------------------------------------------------------------
// STEP 2: Methodology & Evaluation Plan Verification
// To provide an actionable, reproducible evaluation plan for when real data
// reaches threshold, we execute a benchmark pipeline using an explicitly labeled
// synthetic development test benchmark.
// -----------------------------------------------------------------------------

console.log('\n================================================================');
console.log('Step 2 & 3: Baseline Formulation & Benchmarking Simulation');
console.log('[SYNTHETIC TEST BENCHMARK ONLY - NOT USED IN PRODUCTION]');
console.log('================================================================\n');

// Deterministic synthetic dataset generator with known behavioral distributions
function generateSyntheticBenchmark(n = 300, seed = 42) {
  let s = seed;
  function rand() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  const recTypes = ['revise_weak_area', 'continue_topic', 'practice_quiz', 'next_learning_task'];
  const difficulties = ['Beginner', 'Intermediate', 'Advanced'];
  const rows = [];

  for (let i = 0; i < n; i++) {
    const userId = `synth-user-${Math.floor(i / 6)}`; // ~50 users, 6 recs each
    const recType = recTypes[Math.floor(rand() * recTypes.length)];
    const difficulty = difficulties[Math.floor(rand() * difficulties.length)];
    const pastQuizScore = Math.round(40 + rand() * 55); // 40% - 95%
    const sessionsInSubject = Math.floor(rand() * 12);
    const daysSinceLastSession = Math.floor(rand() * 14);
    const isLearningNow = rand() > 0.4 ? 1 : 0;

    // Ground truth probability (synthetic behavior):
    // Students are more likely to follow through if:
    // 1. Recommendation is 'revise_weak_area' and quiz score was low (needs help)
    // 2. Currently learning the topic
    // 3. Active recently (daysSinceLastSession is low)
    let logOdds = -0.5;
    if (recType === 'revise_weak_area' && pastQuizScore < 70) logOdds += 1.2;
    if (recType === 'practice_quiz') logOdds += 0.4;
    if (isLearningNow === 1) logOdds += 0.6;
    if (daysSinceLastSession <= 3) logOdds += 0.5;
    if (difficulty === 'Advanced' && pastQuizScore < 60) logOdds -= 0.7;

    const prob = 1 / (1 + Math.exp(-logOdds));
    const followedThrough = rand() < prob ? 1 : 0;

    rows.push({
      userId,
      recType,
      difficulty,
      pastQuizScore,
      sessionsInSubject,
      daysSinceLastSession,
      isLearningNow,
      followedThrough,
    });
  }

  return rows;
}

const benchmarkData = generateSyntheticBenchmark(300, 42);
const totalPositive = benchmarkData.filter((r) => r.followedThrough === 1).length;
console.log(`Generated Synthetic Benchmark Dataset:`);
console.log(`  Total instances: ${benchmarkData.length} across 50 users`);
console.log(`  Followed through (y = 1): ${totalPositive} (${Math.round((totalPositive / benchmarkData.length) * 100)}%)`);
console.log(`  Dismissed/Ignored (y = 0): ${benchmarkData.length - totalPositive} (${Math.round(((benchmarkData.length - totalPositive) / benchmarkData.length) * 100)}%)\n`);

// Feature Encoding (Available strictly at prediction time - NO target leakage)
function extractFeatures(row) {
  return [
    1.0, // Intercept
    row.recType === 'revise_weak_area' ? 1.0 : 0.0,
    row.recType === 'practice_quiz' ? 1.0 : 0.0,
    row.recType === 'continue_topic' ? 1.0 : 0.0,
    row.difficulty === 'Advanced' ? 1.0 : 0.0,
    (row.pastQuizScore - 70.0) / 30.0, // Normalized quiz score delta from 70% passing
    Math.min(row.sessionsInSubject / 10.0, 1.0),
    Math.min(row.daysSinceLastSession / 14.0, 1.0),
    row.isLearningNow ? 1.0 : 0.0,
  ];
}

// User-isolated Train/Test Split (80% train, 20% test by distinct user IDs to prevent cross-user leakage)
const allUsers = [...new Set(benchmarkData.map((r) => r.userId))];
const splitIdx = Math.floor(allUsers.length * 0.8);
const trainUsers = new Set(allUsers.slice(0, splitIdx));
const testUsers = new Set(allUsers.slice(splitIdx));

const trainData = benchmarkData.filter((r) => trainUsers.has(r.userId));
const testData = benchmarkData.filter((r) => testUsers.has(r.userId));

console.log(`User-Isolated Split (Zero Cross-User Contamination):`);
console.log(`  Training Users: ${trainUsers.size} (Records: ${trainData.length})`);
console.log(`  Testing Users:  ${testUsers.size}  (Records: ${testData.length})\n`);

// -----------------------------------------------------------------------------
// Baseline 1: Current StudySync Deterministic Rule Engine
// The existing rule engine prioritizes recommendations where:
// - Quiz score < 70% (weak area) OR is currently learning
// -----------------------------------------------------------------------------
function evaluateHeuristicBaseline(dataset) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  let brierSum = 0;

  for (const r of dataset) {
    // Deterministic rule: Predict follow-through if weak score (< 70%) or active topic
    const predictedProb = (r.pastQuizScore < 70 || r.isLearningNow === 1) ? 0.70 : 0.30;
    const predictedClass = predictedProb >= 0.50 ? 1 : 0;
    const actual = r.followedThrough;

    if (predictedClass === 1 && actual === 1) tp++;
    else if (predictedClass === 1 && actual === 0) fp++;
    else if (predictedClass === 0 && actual === 0) tn++;
    else fn++;

    brierSum += Math.pow(predictedProb - actual, 2);
  }

  const accuracy = (tp + tn) / dataset.length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const brierScore = brierSum / dataset.length;

  return { accuracy, precision, recall, f1, brierScore, tp, fp, tn, fn };
}

// -----------------------------------------------------------------------------
// Candidate ML Model: L2-Regularized Logistic Regression
// Transparent, linear, explainable weights without black-box opacity
// -----------------------------------------------------------------------------
function trainLogisticRegression(trainSet, numEpochs = 400, lr = 0.05, lambdaL2 = 0.01) {
  const X = trainSet.map(extractFeatures);
  const Y = trainSet.map((r) => r.followedThrough);
  const numFeatures = X[0].length;
  let weights = new Array(numFeatures).fill(0.0);

  function sigmoid(z) {
    return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, z))));
  }

  for (let epoch = 0; epoch < numEpochs; epoch++) {
    const gradients = new Array(numFeatures).fill(0.0);

    for (let i = 0; i < X.length; i++) {
      let z = 0;
      for (let j = 0; j < numFeatures; j++) {
        z += weights[j] * X[i][j];
      }
      const pred = sigmoid(z);
      const err = pred - Y[i];

      for (let j = 0; j < numFeatures; j++) {
        gradients[j] += err * X[i][j];
      }
    }

    for (let j = 0; j < numFeatures; j++) {
      // Apply L2 penalty (skip intercept j=0)
      const reg = j === 0 ? 0 : lambdaL2 * weights[j];
      weights[j] -= lr * (gradients[j] / X.length + reg);
    }
  }

  return {
    weights,
    predictProb: (row) => {
      const feat = extractFeatures(row);
      let z = 0;
      for (let j = 0; j < feat.length; j++) z += weights[j] * feat[j];
      return sigmoid(z);
    },
  };
}

function evaluateModel(model, dataset) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  let brierSum = 0;

  for (const r of dataset) {
    const prob = model.predictProb(r);
    const predictedClass = prob >= 0.50 ? 1 : 0;
    const actual = r.followedThrough;

    if (predictedClass === 1 && actual === 1) tp++;
    else if (predictedClass === 1 && actual === 0) fp++;
    else if (predictedClass === 0 && actual === 0) tn++;
    else fn++;

    brierSum += Math.pow(prob - actual, 2);
  }

  const accuracy = (tp + tn) / dataset.length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const brierScore = brierSum / dataset.length;

  return { accuracy, precision, recall, f1, brierScore, tp, fp, tn, fn };
}

// Train & Evaluate
const model = trainLogisticRegression(trainData);
const baselineResults = evaluateHeuristicBaseline(testData);
const mlResults = evaluateModel(model, testData);

console.log('--- Comparison on Held-Out Test Set (10 Users, 60 Recommendations) ---');
console.log(`Metric               | Heuristic Baseline | Candidate ML Model | Delta`);
console.log(`----------------------------------------------------------------------`);
console.log(`Accuracy             | ${(baselineResults.accuracy * 100).toFixed(1)}%              | ${(mlResults.accuracy * 100).toFixed(1)}%              | ${((mlResults.accuracy - baselineResults.accuracy) * 100).toFixed(1)}%`);
console.log(`Precision            | ${(baselineResults.precision * 100).toFixed(1)}%              | ${(mlResults.precision * 100).toFixed(1)}%              | ${((mlResults.precision - baselineResults.precision) * 100).toFixed(1)}%`);
console.log(`Recall               | ${(baselineResults.recall * 100).toFixed(1)}%              | ${(mlResults.recall * 100).toFixed(1)}%              | ${((mlResults.recall - baselineResults.recall) * 100).toFixed(1)}%`);
console.log(`F1-Score             | ${(baselineResults.f1 * 100).toFixed(1)}%              | ${(mlResults.f1 * 100).toFixed(1)}%              | ${((mlResults.f1 - baselineResults.f1) * 100).toFixed(1)}%`);
console.log(`Brier Score (Calib)  | ${baselineResults.brierScore.toFixed(3)}              | ${mlResults.brierScore.toFixed(3)}              | ${(mlResults.brierScore - baselineResults.brierScore).toFixed(3)} (lower is better)`);

console.log('\n--- Learned Feature Weights (Interpretability Audit) ---');
const featureNames = [
  'Intercept',
  'Type: Revise Weak Area',
  'Type: Practice Quiz',
  'Type: Continue Topic',
  'Difficulty: Advanced',
  'Normalized Quiz Score (< 70% is neg)',
  'Sessions In Subject (Frequency)',
  'Days Since Last Session (Recency)',
  'Is Learning Now Flag',
];

featureNames.forEach((name, idx) => {
  const w = model.weights[idx];
  const direction = w > 0 ? '(+ increases follow-through)' : '(- decreases follow-through)';
  console.log(`  ${name.padEnd(40)}: ${w.toFixed(3).padStart(6)} ${direction}`);
});

console.log('\n================================================================');
console.log('Experiment Completed Safely in Scratch Sandbox.');
console.log('Zero production code, zero SQLite schema modifications made.');
console.log('================================================================');
