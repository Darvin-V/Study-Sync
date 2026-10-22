# StudySync AI — Recommendation & Matching Methods

## 1. Overview of Recommendation Philosophy

StudySync AI rejects opaque, uncalibrated "black-box" machine learning algorithms for its production core. In educational environments, learners and educators require:
1. **Explainability**: Clear understanding of *why* a peer or topic was suggested.
2. **Deterministic Fairness**: Consistent scoring that prevents popular learners from monopolizing incoming study requests.
3. **Data Protection**: Strict adherence to behavioral metrics without inferring cognitive capacity, attention spans, or psychological states.

The platform employs three distinct recommendation systems:
- **Intelligent Peer Matching Engine** (`server/services/matching/matchingEngine.js`)
- **Adaptive Learning Recommendation Engine** (`server/services/recommendation/learningRecommendations.js`)
- **Focus Coach Pacing Heuristic** (`server/services/focus/focusCoachService.js`)

---

## 2. Study Partner Matching Algorithm

The matching engine computes a two-sided compatibility score $S \in [0, 100]$ between a target learner $u$ and each candidate peer $c \in C$.

### 2.1 The 8 Scoring Dimensions & Weights

The composite match score is defined as:

$$S(u, c) = \sum_{k=1}^8 w_k \cdot d_k(u, c)$$

$$\sum_{k=1}^8 w_k = 1.00 \quad (100\%)$$

| Dimension ($k$) | Weight ($w_k$) | Description | Scoring Rule |
| :--- | :---: | :--- | :--- |
| **Topic Similarity** | 0.25 (25%) | Academic overlap in curriculum taxonomy | Exact topic match = 100; Shared subject/sibling topic = 70; Taxonomy ancestor match = 50; No overlap = 10. |
| **Skill Compatibility** | 0.15 (15%) | Balanced or complementary skill level | Complementary pair (Advanced mentor + Beginner seeker) = 95; Aligned peers (Intermediate + Intermediate) = 90; Incompatible = 30. |
| **Goal Compatibility** | 0.15 (15%) | Shared study milestones and session objectives | Identical learning goals (e.g. "Exam Revision") = 100; Compatible goals = 75; Neutral baseline = 50. |
| **Schedule Overlap** | 0.10 (10%) | Overlapping study hours and availability | Confirmed overlapping time slots = 100; Flexible schedules = 80; Unconfirmed schedule = 60 (neutral baseline, not penalized); Mismatch = 25. |
| **Language Match** | 0.10 (10%) | Spoken and coursework study languages | Shared primary language = 100; Shared secondary language = 75; No shared language = 20. |
| **Learning Style** | 0.10 (10%) | Cadence and session duration preferences | Aligned session duration (e.g. both prefer 45-min sprints) = 90; Neutral/unspecified = 50; Polar opposites = 30. |
| **Reliability** | 0.10 (10%) | Historical session completion & peer reviews | Bayesian smoothed completion rate (prior = 85%, weight = 3 sessions). Minimum $N \ge 3$ sessions required to deviate from prior. |
| **Prior Collaboration**| 0.05 (5%) | Historical pairwise study satisfaction | Past peer review marked `would_study_again = 1` = 100; Neutral/no history = 50; Negative review = 0. |

### 2.2 Intent Compatibility Matrix

Learners indicate an explicit session intent: `seeking_help`, `explaining_mentoring`, `reciprocal_teaching`, or `co_studying`.

$$\text{IntentScore}(u_{\text{intent}}, c_{\text{intent}}) = \begin{pmatrix}
 & \text{Seeking} & \text{Mentoring} & \text{Reciprocal} & \text{Co-study} \\
\text{Seeking} & 40 & 100 & 85 & 60 \\
\text{Mentoring} & 100 & 30 & 70 & 50 \\
\text{Reciprocal} & 85 & 70 & 95 & 75 \\
\text{Co-study} & 60 & 50 & 75 & 90
\end{pmatrix}$$

### 2.3 Anti-Monopoly Fair Candidate Rotation

To prevent high-reputation learners from being overwhelmed while ensuring cold-start learners gain exposure:
1. Candidates are ranked into eligibility tiers based on raw score $S(u, c)$.
2. Candidates with scores within 5 points of each other are grouped into a top-tier bucket.
3. A deterministic, seed-based Fisher-Yates jitter is applied within the top tier based on the requesting user's ID and current hour timestamp.
4. Highly active learners with $> 5$ open partner requests have their priority slightly attenuated, distributing requests equitably across qualified peers.

---

## 3. Adaptive Learning Recommendations

The Adaptive Learning service generates personalised study actions derived from database events:
- Recent verified quiz scores (`topic_assessments`).
- Last active study session timestamps (`study_sessions`).
- Explicitly declared weak areas and goals (`user_learning_preferences`).
- Available open collaborative rooms (`topic_rooms`).

### 3.1 Recommendation Action Types

| Action Type | Condition Trigger | Priority Score |
| :--- | :--- | :---: |
| `REVISE_WEAK_AREA` | Topic assessment quiz score $< 70\%$ | 90 |
| `PRACTICE_QUIZ` | Topic studied $> 3$ days ago with no recent quiz | 80 |
| `CONTINUE_TOPIC` | Topic marked `learning_now` with pending curriculum modules | 70 |
| `JOIN_ROOM` | Active open study room matches user's current topic | 65 |
| `PEER_HELP` | Compatible peer available who excels in user's weak topic | 60 |

### 3.2 Duplicate & Irrelevance Suppression

To eliminate recommendation spam:
1. **7-Day Cooldown**: If a recommendation target is marked `dismissed` or `followed_through` in `recommendation_tracking`, it is suppressed from future results for 7 days.
2. **Explicit Irrelevance Filter**: If a learner explicitly rates a topic recommendation as not relevant (`recommendation_explicit_feedback.is_relevant = 0`), it is permanently removed from the user's feed.

---

## 4. Focus Coach Heuristics

The Focus Coach analyzes interval records from `user_focus_intervals` to suggest optimal study pacing:

### 4.1 Pacing & Interval Analysis
- **Planned vs. Actual Ratio**:
  $$\text{Ratio} = \frac{\text{Actual Completed Duration}}{\text{Planned Duration}}$$
  - If $\text{Ratio} < 0.60$ across $> 3$ consecutive sessions: Coach recommends reducing planned interval from 50 minutes to 25 minutes (Pomodoro pacing).
  - If $\text{Ratio} > 0.95$ with zero pauses: Coach confirms sustainable study momentum.
- **Break Reminders**: If a session exceeds 60 minutes of uninterrupted study, an advisory break banner is queued.

### 4.2 Ethical Boundaries & Safeguards
- **Zero Surveillance**: The Focus Coach **never** captures webcams, audio feeds, eye gaze, keystrokes, or background browser processes.
- **No Inferred Mental State**: The system does not claim to detect "focus levels," "attention deficit," or "cognitive fatigue." All advice is strictly framed as session pacing observations.

---

## 5. AI Provider Abstraction Architecture

The application implements a provider-agnostic router (`server/services/ai/aiService.js`):

```javascript
// Dynamic Provider Resolution
class AIServiceManager {
  constructor() {
    this.ruleBasedProvider = new RuleBasedProvider();
    this.geminiProvider = new GeminiProvider();
    this.activeProvider = this.geminiProvider.isAvailable()
      ? this.geminiProvider
      : this.ruleBasedProvider;
  }
}
```

- **Default Operating Mode**: `RuleBasedProvider` (100% free, deterministic, zero network latency, zero external API keys required).
- **Optional Augmentation**: `GeminiProvider` activates only if `GEMINI_API_KEY` is supplied, injecting natural-language study advice while preserving the underlying deterministic match score.
