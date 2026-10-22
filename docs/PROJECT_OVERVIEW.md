# StudySync AI — Project Overview

## 1. Executive Summary

StudySync AI is an open, zero-cost, privacy-first peer learning and collaborative study platform. It connects students through intelligent, explainable study partner matching, topic-oriented collaborative study rooms, goal-driven study sessions, interactive knowledge maps, and honest focus coaching.

Unlike conventional edtech platforms that rely on invasive device telemetry or black-box neural networks, StudySync AI is built on deterministic, inspectable heuristic algorithms with a strict separation between verified comprehension and attendance.

---

## 2. Problem Statement & Target Audience

### 2.1 The Problem
Students engaged in remote, blended, or self-directed coursework face three recurring structural hurdles:
1. **Isolation & Incompatible Study Partners**: Finding peers studying the exact same syllabus topic at a compatible skill level, time window, and study cadence is difficult.
2. **Superficial Productivity & Invasive Monitoring**: Existing focus apps either provide superficial gamified timers or employ invasive surveillance (camera feeds, screen tracking, keystroke logging).
3. **Opaque Recommendation Engines**: Learning platforms often recommend content without clear attribution, trapping students in feedback loops or recommending irrelevant materials.

### 2.2 Target Users
- **Undergraduate & Graduate University Students**: Preparing for exams, collaborating on problem sets, and sharing curated revision notes.
- **Independent & Self-Paced Learners**: Working through modular technical topics (e.g., Computer Science, Mathematics, Systems Engineering) requiring structured accountability.
- **Peer Tutoring Groups**: Facilitating reciprocal teaching where stronger students mentor peers on foundational topics.

---

## 3. Core Objectives

- **Zero-Cost Deployment**: Operate completely within free-tier infrastructure (Node.js, SQLite, Vite, React, GitHub Pages/Render/Fly.io) with zero mandatory paid cloud APIs.
- **Transparent & Explainable AI**: Every recommendation, partner match, and focus suggestion provides a plain-text rationale explaining *why* it was selected.
- **Privacy & Psychological Safety**: Zero behavioral surveillance; user blocking with mutual invisibility; strict isolation of private notes and messages.
- **Honest Progress Metrics**: Separate self-reported attendance duration from objectively verified assessment scores (quizzes passed).

---

## 4. Key Feature Matrix

| Feature | Description | Architecture / Source |
| :--- | :--- | :--- |
| **Intelligent Peer Matching** | Two-sided complementary matching engine incorporating 8 weighted dimensions (topic similarity, skill compatibility, schedule overlap, learning style, reliability). | `server/services/matching/matchingEngine.js` |
| **Adaptive Learning Recommendations** | Suggests targeted revision, practice quizzes, or open topic rooms based on recent quiz scores and study recency. | `server/services/recommendation/learningRecommendations.js` |
| **Focus Mode & Distraction Shield** | Timestamp-based interval timer with refresh recovery, in-app notification suppression, and voluntary break guidance. | `server/services/focus/focusCoachService.js`, `src/pages/Sessions.jsx` |
| **Topic Rooms & Live Collaboration** | Persistent SQLite rooms with discussion feeds, structured doubt queues, peer responses, and shared revision resources. | `server/routes/room.routes.js`, `src/pages/Rooms.jsx` |
| **Study Sessions & Calls** | Server-authoritative session timers, individual attendance tracking, post-session reflections, and dedicated 1-to-1 study calls. | `server/routes/session.routes.js`, `src/pages/Sessions.jsx` |
| **Knowledge Map & Learning DNA** | Interactive curriculum DAG showing prerequisite topic nodes, mastery states (`not_started`, `in_progress`, `needs_review`, `assessed`), and custom learning style tags. | `server/services/knowledgeMap/knowledgeMapService.js`, `src/pages/KnowledgeMapPage.jsx` |
| **Recommendation Feedback Loops** | Explicit relevance ratings, pairwise peer reviews (`was_helpful`, `would_study_again`), and Bayesian-smoothed reliability metrics. | `server/services/recommendation/evaluationMetrics.js` |
| **Safety, Trust & Moderation** | Two-way user blocking, abuse reporting queue, input sanitization, and soft account deactivation. | `server/routes/safety.routes.js`, `src/pages/Settings.jsx` |

---

## 5. Implementation Status Audit

To maintain strict technical honesty, the project's features are classified into four verifiable states:

### 5.1 Implemented and Tested (671 Automated Tests Passing)
- **Authentication & Security**: Scrypt password hashing, session tokens in SQLite, cookie-first HttpOnly sessions with fallback bearer tokens for native clients, CSRF protection, and email OTP verification infrastructure (`server/tests/auth.test.js`, `server/tests/email_otp_verification.test.js`).
- **Peer Matching Engine**: 8-factor weighted scoring with cold-start neutral baselines, anti-monopoly fair rotation, schedule overlap modeling, and mutual block filtering (`server/tests/phase3_study_partner_matching.test.js`, `server/tests/advanced_peer_matching_and_fair_recommendations.test.js`).
- **Adaptive Recommendations**: Rule-based priority scoring for weak areas (quiz $< 70\%$), spaced revision, active session integration, and 7-day duplicate suppression (`server/tests/phase2_adaptive_learning_and_revision.test.js`).
- **Focus Coach & Shield**: Pacing analysis, interval completion tracking, refresh recovery, and honest disclaimers (`server/tests/phase1_ai_focus_coach.test.js`).
- **Topic Rooms & Sessions**: Full CRUD, creator authorization, participant rosters, discrete attendance intervals, notes, doubt resolution, and study calls (`server/tests/rooms.test.js`, `server/tests/sessions.test.js`, `server/tests/study_call_integration.test.js`).
- **Full Integration**: Comprehensive E2E journeys validating multi-user collaboration, privacy controls, and data integrity (`server/tests/phase5_e2e_integration_verification.test.js`, `server/tests/comprehensive_qa_integration.test.js`).

### 5.2 Implemented but Not Fully Verified in Production
- **Live Cloudflare R2 Replication**: Litestream replication configuration is defined in `litestream.yml` and `Dockerfile`, but requires live cloud bucket credentials to test continuous production streaming.
- **External Email Delivery**: Resend, SendGrid, and webhook dispatch are implemented in `server/services/email/emailService.js`; local and test environments fall back safely to console logging or test intercepts.
- **External LLM Augmentation**: Google Gemini API provider (`server/services/ai/geminiProvider.js`) is implemented with automatic fallback to `RuleBasedProvider`. Operating safely in zero-cost rule-based mode.

### 5.3 Experimental
- **Phase 6 ML Recommendation Model**: An L2-regularized logistic regression follow-through prediction model was benchmarked in `scratch/ml_experiment.js`. Training on real production data was **halted** due to zero label variance in `recommendation_tracking` (8 records, 100% `presented`). Benchmarking on an isolated synthetic development dataset ($N=300$) showed the ML model did not outperform the baseline heuristic (F1: 48.5% vs 60.5%). Kept strictly experimental.

### 5.4 Planned
- **Live WebSockets**: Bi-directional real-time socket connections for real-time cursor tracking and whiteboard collaboration (currently driven by polling and refresh).
- **Supervised ML Production Deployment**: Blocked until passive telemetry collects $\ge 250$ labeled user outcomes across $\ge 50$ distinct active learners.
