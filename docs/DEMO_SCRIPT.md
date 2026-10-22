# StudySync AI — 5-Minute Evaluation & Demonstration Script

This document details an end-to-end, reproducible 5-minute walkthrough of StudySync AI using two isolated test accounts. It demonstrates the live peer learning workflow, intelligent partner discovery, collaborative study room participation, study calls, focus mode, and transparent recommendations without mock fallbacks.

---

## 1. Demo Preparation & Environment Setup

### 1.1 Start Backend & Frontend Servers
Open two terminal windows:
```powershell
# Terminal 1: Backend Server (Port 3001)
node server/index.js

# Terminal 2: Vite Dev Server (Port 5173)
npm run dev
```

### 1.2 Open Two Separate Browser Sessions
To demonstrate multi-user collaboration without session cookie collisions:
- **Browser Window 1 (Standard Chrome)**: Learner 1 (Alice)
- **Browser Window 2 (Incognito / Edge / Firefox)**: Learner 2 (Bob)

---

## 2. Minute-by-Minute Demonstration Sequence

### Minute 0:00 – 1:00: Account Setup & Guided Onboarding

1. **Window 1 (Alice)**:
   - Navigate to `http://localhost:5173/register`.
   - Register with:
     - Name: `Alice Chen`
     - Email: `alice.chen@demo.local`
     - Password: `Password123!`
   - Complete 6-digit OTP verification (in dev mode, OTP is logged to backend console).
   - Complete the 5-step onboarding wizard:
     - Select Subject: `Database Systems`.
     - Select Active Topics: `Relational Algebra & SQL Joins`, `DBMS — Normalisation`.
     - Set Skill Level: `Intermediate`.
     - Preferred Study Cadence: `Weekday Evenings` (45 min sprints).
     - Learning Goal: `Exam Revision`.

2. **Window 2 (Bob)**:
   - Navigate to `http://localhost:5173/register`.
   - Register with:
     - Name: `Bob Miller`
     - Email: `bob.miller@demo.local`
     - Password: `Password123!`
   - Complete onboarding:
     - Select Subject: `Database Systems`.
     - Select Strengths: `DBMS — Normalisation`.
     - Session Intent: `Explaining / Mentoring`.

---

### Minute 1:00 – 2:00: Intelligent Peer Matching & Circle Connection

1. **Window 1 (Alice)**:
   - Click **Discover** (`/discover`) in the left sidebar.
   - Observe **Bob Miller** ranked at the top of the recommended study partners list.
   - Inspect the **Explainable Compatibility Card**:
     - Compatibility Score: `90%+`.
     - Transparent Matching Reasons displayed:
       - *Topic Overlap*: Both enrolled in `Database Systems` (`DBMS — Normalisation`).
       - *Complementary Intent*: Alice is seeking revision, Bob is offering mentorship.
       - *Schedule Alignment*: Both prefer evening study windows.
   - Click **Connect** to send Bob a Circle connection request.

2. **Window 2 (Bob)**:
   - Click **Circle** (`/circle`) in the sidebar.
   - Notice the incoming connection request from `Alice Chen`.
   - Click **Accept Connection**. Both accounts are now connected.

---

### Minute 2:00 – 3:00: Topic Room Collaboration & Knowledge Exchange

1. **Window 1 (Alice)**:
   - Navigate to **Rooms** (`/rooms`).
   - Click **Create Room**:
     - Title: `DBMS Normal Forms Review (1NF to BCNF)`
     - Subject: `Database Systems`
     - Topic: `DBMS — Normalisation`
     - Type: `Doubt Solving`
     - Capacity: `5`
   - Room is created with a unique 6-character room code (e.g., `NORM24`).

2. **Window 2 (Bob)**:
   - Click **Join by Code** and enter `NORM24`.
   - Bob joins the room immediately.
   - In the room discussion feed, Bob posts: *"Happy to explain 3NF vs BCNF decomposition!"*
   - Alice posts a structured doubt in the Q&A tab: *"When is a 3NF decomposition not dependency preserving?"*
   - Bob replies to the doubt. Alice clicks **Mark as Resolved** (badge turns green).

---

### Minute 3:00 – 4:00: Study Call Lifecycle & Shared Session

1. **Window 1 (Alice)**:
   - Inside the room or private conversation, click **Start Study Call**.
   - An active 1-to-1 meeting room is initialized with Alice as host.
2. **Window 2 (Bob)**:
   - Receives active call notification; clicks **Join Meeting**.
   - Both learners enter the collaborative study session interface with live synchronized session timer.
3. **Session Termination**:
   - Alice clicks **End Meeting**.
   - Both learners receive the post-session feedback dialog.
   - Alice rates Bob: `Was helpful: Yes`, `Would study again: Yes`.
   - The feedback is recorded into `peer_collaboration_feedback` with Bayesian smoothing.

---

### Minute 4:00 – 5:00: Focus Mode, Knowledge Map & Adaptive Recommendations

1. **Window 1 (Alice)**:
   - Click **Focus Mode** in the navigation bar (`/sessions`).
   - Start a 25-minute Pomodoro sprint.
   - Observe **Distraction Shield**: in-app notifications are muted, timer continues reliably across page reloads.
   - Click **Pause**, then **Finish Sprint**.
2. **Knowledge Map Inspection**:
   - Navigate to **Knowledge Map** (`/knowledge-map`).
   - Observe the curriculum DAG:
     - `Relational Algebra`: Marked `in_progress`.
     - `DBMS — Normalisation`: Shows pending practice quiz.
3. **Dashboard Recommendations**:
   - Return to **Home** (`/`).
   - Observe the Adaptive Recommendation Card:
     - *"Practice Quiz: Normalisation"* (triggered because topic was studied with no recent assessment).
     - Rationale explicitly states the triggering event.

---

## 3. Verification Checklist for Evaluators

| Step | Verifiable Evidence | Status |
| :--- | :--- | :---: |
| **Authentication** | Passwords scrypted, session cookie HttpOnly with Lax SameSite | **Verified** |
| **Peer Matching** | Match score displays breakdown of topic, intent, and schedule | **Verified** |
| **Room Collaboration** | Doubts, answers, resolution toggles persist across reload | **Verified** |
| **Call Lifecycle** | Host can end call; non-host leaving keeps host active | **Verified** |
| **Focus Shield** | Timer calculation derived from server timestamps | **Verified** |
| **Zero Mock Fallbacks** | All UI components query SQLite endpoints directly | **Verified** |
