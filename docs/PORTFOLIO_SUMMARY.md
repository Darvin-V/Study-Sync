# StudySync AI — Data Science & Engineering Portfolio Summary

## 1. Project Title & Problem Statement

**Project Title**: StudySync AI — Intelligent Peer Learning & Collaborative Study Platform  
**Problem Statement**: Self-directed and remote students face high friction in finding compatible study partners, maintaining structured focus without invasive surveillance, and sequencing their self-study curricula with transparent guidance. Conventional platforms either rely on invasive tracking (cameras, keystroke monitors) or opaque, unvalidated recommendation algorithms that trap students in feedback loops.

---

## 2. Role & Technologies Used

- **Role**: Full-Stack Software Engineer & Applied Data Science Auditor
- **Frontend Technologies**: React 19, Vite 6, React Router DOM v7, Vanilla CSS Design System (custom property tokens, dark/light theme, continuous font scaling), Context API, Capacitor 8 (Android wrapper).
- **Backend Technologies**: Node.js (v24), Express 5, native `node:sqlite` (`DatabaseSync`), Write-Ahead Logging (`WAL`), Litestream backup replication.
- **Data Science & Algorithmic Methods**: 
  - Multi-criteria two-sided complementary matching engine (8 dimensions).
  - Rule-based adaptive curriculum recommendation engine with duplicate cooldowns.
  - Heuristic interval pacing coach with zero biological surveillance.
  - Bayesian-smoothed peer reliability scoring ($N \ge 3$ threshold).
  - Ridge (L2-regularized) Logistic Regression experimental benchmark harness.
- **Testing & Verification**: Native Node.js test runner (`node --test`), 671 automated tests across 107 test suites with 0 failures, 100% clean production bundle build.

---

## 3. Implemented AI & Recommendation Methods

### 3.1 Explainable Peer Matching Engine (`server/services/matching/matchingEngine.js`)
- **8 Scoring Dimensions**: Topic Similarity (25%), Skill Compatibility (15%), Goal Compatibility (15%), Schedule Overlap (10%), Language Match (10%), Learning Style (10%), Reliability (10%), Prior Collaboration (5%).
- **Complementary Intent Modeling**: Mathematically pairs students seeking help with students offering mentorship, while enabling balanced reciprocal co-studying.
- **Fairness & Anti-Monopoly Rotation**: Implements cold-start neutral baselines for new learners and Fisher-Yates candidate rotation among similarly qualified peers, preventing request hoarding by high-reputation accounts.

### 3.2 Adaptive Learning Recommendations (`server/services/recommendation/learningRecommendations.js`)
- Actionable suggestions (`REVISE_WEAK_AREA`, `PRACTICE_QUIZ`, `CONTINUE_TOPIC`, `JOIN_ROOM`) dynamically triggered by verified quiz scores ($< 70\%$) and study session recency ($> 3$ days).
- Automatic 7-day duplicate suppression for dismissed or followed-through items, plus permanent removal for explicitly irrelevant topics.

### 3.3 Focus Coach Heuristics (`server/services/focus/focusCoachService.js`)
- Derives pacing recommendations (e.g., suggesting 25-minute Pomodoro sprints when session completion ratio $< 0.60$) from authentic duration and pause timestamps.
- Explicitly avoids cognitive inference: zero webcam, eye-tracking, or keystroke monitoring.

---

## 4. Verified Technical Achievements

| Dimension | Verification Evidence | Result |
| :--- | :--- | :---: |
| **Backend Test Suite** | `npm run test:server` (671 tests across 107 suites) | **671 / 671 Passed (0 Failures)** |
| **Frontend Production Build** | `npm run build` (Vite v6.4.4 bundling 138 modules) | **Built Cleanly in 3.75s** |
| **Zero-Cost Deployment** | Single-container architecture running native SQLite + Litestream | **Zero Paid Cloud Dependencies** |
| **Web Security Hardening** | Cookie-first HttpOnly sessions, CSRF headers, Scrypt hashing, two-way user blocking | **Fully Verified** |

---

## 5. Evaluation Evidence & Honest Machine Learning Findings

### 5.1 Data-Readiness Audit
An audit of the authentic production database (`server/data/studysync.db`) revealed:
- 15 total user accounts (all development seed fixtures or automated test accounts; 0 real human learners).
- 8 recommendation records, all in lifecycle status `presented` (0 `followed_through`, 0 `dismissed`).
- **Data Science Integrity Decision**: Supervised machine-learning training on live data was **halted** due to zero label variance. No synthetic records were disguised as real human behavior.

### 5.2 Phase 6 ML Benchmark Experiment Results
An isolated benchmark was executed on a clearly labeled synthetic development test harness ($N = 300$, 50 users, user-isolated train/test split):
- **Candidate ML Model**: L2-Regularized Logistic Regression.
- **Baseline Comparison**: The heuristic baseline achieved significantly higher Recall ($88.5\%$ vs $61.5\%$) and F1-Score ($60.5\%$ vs $48.5\%$) than the ML model.
- **Portfolio Takeaway**: Machine learning is not automatically superior to domain-specific heuristics. StudySync AI preserved the deterministic baseline in production rather than deploying an unvalidated, underperforming model.

---

## 6. System Limitations & Future Work

### 6.1 Current Limitations
- **Single-Node Write Concurrency**: SQLite with WAL mode supports high read throughput, but concurrent write spikes across hundreds of simultaneous study rooms require eventual migration to PostgreSQL.
- **Transport Latency**: Discussion feeds and active room rosters rely on HTTP polling rather than persistent WebSockets.

### 6.2 Planned Future Enhancements
- **Real-Time WebSockets**: Bi-directional socket connections for live study call signaling, cursor presence, and shared whiteboards.
- **Telemetry Accumulation Gate**: Re-evaluating supervised ML only after accumulating $\ge 250$ verified outcomes across $\ge 50$ active human learners.
- **Shadow Mode ML Evaluation**: Running candidate models in parallel logging mode to measure real-world ranking calibration before exposing outputs to students.
