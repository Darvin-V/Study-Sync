# StudySync AI — Privacy, Security & System Limitations

## 1. Data Collection & Ethical AI Principles

StudySync AI adheres to a strict "data minimization by design" philosophy. Educational software should empower students without creating an environment of continuous surveillance.

### 1.1 What We Collect
- **Authentication & Profile**: Email address, scrypt-hashed password, display name, school/year (optional), study languages, and curriculum topics declared active (`learning_now`, `strengths`, `improving`).
- **Academic Progress Records**: Quiz attempts, pass/fail status, and timestamped topic assessment scores.
- **Session Attendance Intervals**: Discrete session join and leave timestamps, planned duration, and user-initiated pause durations.
- **Collaborative Artifacts**: Notes authored by the student, topic room chat messages, questions/doubts submitted, and shared learning resource links.
- **Voluntary Feedback**: Post-session pairwise ratings (`was_helpful`, `would_study_again`) and explicit recommendation relevance ratings.

### 1.2 Prohibited Data Practices (What We NEVER Collect)
- **Zero Audio/Visual Surveillance**: The platform **never** accesses student webcams, microphones, or ambient audio for "attention monitoring."
- **Zero Keystroke or Eye-Tracking Telemetry**: No logging of student typing speed, biometric eye movements, or tab-switching frequency.
- **No Psychological Profiling**: The system does not attempt to infer mental health, emotional state, cognitive deficit, or intelligence quotients from activity data.

---

## 2. Access Controls & Cross-User Isolation

### 2.1 Database Query Scoping
Every authenticated endpoint strictly scopes data queries using the user ID derived from the verified session:
```sql
SELECT * FROM notes WHERE user_id = ? AND is_archived = 0;
```
Direct client manipulation of user IDs in request bodies is rejected with `403 Forbidden`.

### 2.2 In-Room Access Control & Privacy
- **Private Topic Rooms**: Only enrolled members can access message history or question threads.
- **Doubt Resolution**: Only the student who originally authored a question (or the room creator) is authorized to mark it as resolved.
- **Resource Deletion**: Only the uploading student or room creator can delete shared resources.

### 2.3 Mutual User Blocking & Safety
- When User A blocks User B:
  - User B is immediately excluded from User A's peer discovery and partner matching feeds.
  - User A is symmetrically hidden from User B's feeds.
  - Direct messaging between both users is permanently disabled.
  - If both users are members of the same topic room, their messages are masked to prevent harassment.
- **Abuse Reporting**: Reports are stored in a secure moderation queue (`abuse_reports`) with reporter anonymity preserved.

---

## 3. Focus Mode & Notification Limitations

### 3.1 In-App Notification Muting vs. Operating System DND
- **In-App Toast Suppression**: During an active Focus Mode sprint, application toasts and non-critical alerts are suppressed. Critical security, authentication, and error warnings remain visible.
- **OS-Level Limitations**: Web browsers cannot unilaterally place a user's operating system (Windows, macOS, Android, iOS) into "Do Not Disturb" mode without native permissions. StudySync AI provides on-screen guidance prompting the user to activate their system DND switch.

### 3.2 Focus Statistics Disclaimer
- All focus metrics (e.g., "50 minutes focused") reflect timer duration only.
- The platform clearly displays a disclaimer that logged intervals measure *session time*, not biological concentration or cognitive absorption.

---

## 4. Known Technical Risks & Architecture Limitations

### 4.1 Single-Node SQLite Concurrency Limits
- **Current Mitigation**: The application runs SQLite in `WAL` (Write-Ahead Logging) mode with `PRAGMA busy_timeout = 5000;`. This allows unlimited concurrent readers alongside a single writer.
- **Limitation**: Highly concurrent write spikes (e.g., thousands of simultaneous writes per second across hundreds of study rooms) will encounter lock contention. For enterprise deployments ($> 10,000$ concurrent users), migration to a distributed database (PostgreSQL) would be required.

### 4.2 WebSockets vs. HTTP Polling
- **Current State**: Room messages, discussion feeds, and roster updates are driven by client-side HTTP polling and manual refresh.
- **Limitation**: Discussion feeds have a latency equal to the polling interval (1–3 seconds). Live whiteboard collaboration and real-time cursor presence are planned for a subsequent release.

### 4.3 Algorithmic Feedback Loops (Filter Bubble Risk)
- If the recommendation engine prioritizes topics with high completion probability, it may continuously recommend comfortable subjects while neglecting challenging areas.
- **Current Safeguard**: The deterministic heuristic explicitly injects a $+30$ point priority boost for topics with quiz scores $< 70\%$, forcing weak topics to the top of the queue.

### 4.4 Attribution Ambiguity
- When a student completes a quiz 4 days after viewing a recommendation, it is difficult to prove causality (did the recommendation cause the study action, or was the student already planning to study for an exam?). True causal uplift requires randomized control trials (RCTs).
