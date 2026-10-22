import React, { useState } from 'react';
import { Modal, Button, Badge } from '../UI';

/**
 * Curated practice quiz bank for authentic curriculum verification
 */
const PRACTICE_QUESTIONS = {
  'topic-dbms': [
    {
      q: 'Which normal form eliminates partial functional dependencies on a composite primary key?',
      options: ['1NF', '2NF', '3NF', 'BCNF'],
      answerIndex: 1,
      explanation: 'Second Normal Form (2NF) requires 1NF and no non-prime attribute to be partially dependent on any candidate key.',
    },
    {
      q: 'For a relational decomposition to be lossless-join, what condition must hold for R1 ∩ R2?',
      options: [
        'R1 ∩ R2 must contain all foreign keys',
        'R1 ∩ R2 must be a superkey of R1 or R2',
        'R1 ∩ R2 must be empty',
        'R1 ∩ R2 must only have numeric types',
      ],
      answerIndex: 1,
      explanation: 'A decomposition into R1 and R2 is lossless if and only if the common attributes (R1 ∩ R2) functionally determine R1 or R2.',
    },
    {
      q: 'What distinguishes Boyce-Codd Normal Form (BCNF) from 3NF?',
      options: [
        'BCNF strictly requires the left-hand side X of every non-trivial FD X → Y to be a superkey',
        'BCNF allows transitive dependencies',
        'BCNF applies only to non-relational document stores',
        'BCNF requires all columns to be nullable',
      ],
      answerIndex: 0,
      explanation: 'In BCNF, for every non-trivial functional dependency X → Y, X must strictly be a superkey. 3NF allows Y to be a prime attribute even if X is not a superkey.',
    },
  ],
  'topic-dp': [
    {
      q: 'What two properties must a problem have to be solvable using Dynamic Programming?',
      options: [
        'Optimal substructure and overlapping subproblems',
        'Greedy choice property and disjoint subproblems',
        'NP-hardness and divide-and-conquer tree',
        'Polynomial verification and randomized branching',
      ],
      answerIndex: 0,
      explanation: 'Dynamic Programming requires that optimal solutions to subproblems form an optimal overall solution (optimal substructure) and that the same subproblems are solved repeatedly (overlapping subproblems).',
    },
    {
      q: 'What is the key difference between Memoization and Tabulation?',
      options: [
        'Memoization is top-down with recursion; Tabulation is bottom-up iterative',
        'Memoization is O(N^3) while Tabulation is always O(1)',
        'Memoization does not use memory storage',
        'Tabulation requires floating point matrices',
      ],
      answerIndex: 0,
      explanation: 'Memoization solves the problem top-down caching recursive calls on demand, while Tabulation iteratively fills an array from base cases upward.',
    },
    {
      q: 'What is the time complexity to find the Longest Common Subsequence (LCS) of two strings of lengths M and N using DP?',
      options: ['O(M + N)', 'O(M * N)', 'O(2^(M+N))', 'O(log(M * N))'],
      answerIndex: 1,
      explanation: 'Standard 2D table LCS requires computing M * N cell entries, each in O(1) time, yielding O(M * N) time complexity.',
    },
  ],
  'topic-os': [
    {
      q: 'Which of the following is NOT one of the Coffman conditions required for a deadlock?',
      options: [
        'Mutual Exclusion',
        'Hold and Wait',
        'Preemption allowed by kernel',
        'Circular Wait',
      ],
      answerIndex: 2,
      explanation: 'Deadlock requires NO preemption; if the kernel can preempt resources, deadlocks can be broken.',
    },
    {
      q: 'What does the Banker’s Algorithm verify before granting a resource allocation request?',
      options: [
        'Whether granting the request leaves the system in a safe state',
        'Whether the CPU cache has zero misses',
        'Whether all threads are running in kernel space',
        'Whether the swap partition is at least 50% free',
      ],
      answerIndex: 0,
      explanation: 'Banker’s algorithm checks safety by finding at least one sequence of process completions that avoids deadlock.',
    },
  ],
  default: [
    {
      q: 'Why are topic prerequisites important in structured curriculum progression?',
      options: [
        'They ensure foundational concepts are understood before complex topics are tackled',
        'They prevent users from collaborating',
        'They are purely decorative',
        'They increase database latency',
      ],
      answerIndex: 0,
      explanation: 'Prerequisites sequence concepts so foundational knowledge supports higher-level learning.',
    },
    {
      q: 'What is the difference between attendance time and verified mastery in StudySync AI?',
      options: [
        'Attendance tracks participation time; assessments measure actual understanding',
        'Attendance proves you have 100% mastery',
        'Assessments are always fabricated by AI',
        'There is no difference',
      ],
      answerIndex: 0,
      explanation: 'StudySync AI strictly separates time spent from verified comprehension to provide honest metrics.',
    },
  ],
};

export function PracticeAssessmentModal({
  isOpen,
  onClose,
  topic,
  onSubmitAssessment,
}) {
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (!isOpen || !topic) return null;

  const questions = PRACTICE_QUESTIONS[topic.id] || PRACTICE_QUESTIONS.default;

  const handleSelectOption = (qIdx, optIdx) => {
    if (result) return; // Prevent changing after submit
    setSelectedAnswers((prev) => ({
      ...prev,
      [qIdx]: optIdx,
    }));
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.answerIndex) {
        correctCount++;
      }
    });

    const scorePercentage = Math.round((correctCount / questions.length) * 100);
    const passed = scorePercentage >= 70;

    setIsSubmitting(true);
    try {
      const recorded = await onSubmitAssessment({
        topicId: topic.id,
        scorePercentage,
        assessmentType: 'practice_quiz',
        notes: `Completed ${questions.length}-question practice quiz for ${topic.topicName}.`,
      });

      setResult({
        scorePercentage,
        passed,
        correctCount,
        totalCount: questions.length,
        recorded,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSelectedAnswers({});
    setResult(null);
    onClose();
  };

  const allAnswered = Object.keys(selectedAnswers).length === questions.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleResetAndClose}
      title={`Practice Assessment: ${topic.topicName}`}
      size="md"
    >
      <div className="stack" style={{ gap: 'var(--space-4)' }}>
        <div className="row-between" style={{ alignItems: 'center', backgroundColor: 'var(--color-bg-subtle)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Subject</span>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)' }}>{topic.subject}</div>
          </div>
          <Badge variant="accent">3-5 Questions • Passing Score: 70%</Badge>
        </div>

        {/* Results Screen */}
        {result ? (
          <div className="stack" style={{ gap: 'var(--space-4)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{ fontSize: '48px' }}>
              {result.passed ? '🎉' : '📖'}
            </div>

            <div>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-bold)', color: result.passed ? 'var(--color-accent)' : 'var(--color-warning)' }}>
                {result.passed ? 'Assessment Passed!' : 'Practice Recommended'}
              </h3>
              <p style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-extrabold)', margin: 'var(--space-2) 0' }}>
                {result.scorePercentage}%
              </p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                You answered {result.correctCount} of {result.totalCount} questions correctly.
              </p>
            </div>

            <div
              style={{
                backgroundColor: result.passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${result.passed ? 'var(--color-accent)' : 'var(--color-warning)'}`,
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-text-secondary)',
                textAlign: 'left',
              }}
            >
              <strong>Status Updated:</strong> {result.passed
                ? 'Your topic state has been updated to "Assessed" with a verified score record. Great job!'
                : 'Your topic state has been set to "Needs Review". Connect with peer tutors to clarify key concepts.'}
            </div>

            {/* Answer Explanations */}
            <div className="stack" style={{ gap: 'var(--space-3)', textAlign: 'left', marginTop: 'var(--space-3)' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)' }}>Review & Explanations:</h4>
              {questions.map((q, qIdx) => {
                const userAns = selectedAnswers[qIdx];
                const isCorrect = userAns === q.answerIndex;
                return (
                  <div
                    key={qIdx}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: isCorrect ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                      border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    <p style={{ fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                      {qIdx + 1}. {q.q}
                    </p>
                    <p style={{ color: isCorrect ? 'var(--color-accent)' : 'var(--color-danger)', marginTop: 4 }}>
                      {isCorrect ? '✓ Correct' : `✗ Incorrect (Selected: "${q.options[userAns] || 'None'}")`}
                    </p>
                    <p style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>
                      <em>{q.explanation}</em>
                    </p>
                  </div>
                );
              })}
            </div>

            <Button variant="primary" onClick={handleResetAndClose} style={{ marginTop: 'var(--space-2)' }}>
              Done & Return to Map
            </Button>
          </div>
        ) : (
          /* Quiz Question Flow */
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Answer each question below. Submitting will record your verified score and update your Knowledge Map status.
            </p>

            {questions.map((q, qIdx) => (
              <div
                key={qIdx}
                className="stack"
                style={{
                  gap: 'var(--space-2)',
                  padding: 'var(--space-3)',
                  backgroundColor: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-semibold)', color: 'var(--color-text-primary)' }}>
                  {qIdx + 1}. {q.q}
                </div>

                <div className="stack" style={{ gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                  {q.options.map((opt, optIdx) => {
                    const isSelected = selectedAnswers[qIdx] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(qIdx, optIdx)}
                        style={{
                          textAlign: 'left',
                          padding: 'var(--space-2) var(--space-3)',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-default)'}`,
                          backgroundColor: isSelected ? 'var(--color-accent-subtle)' : 'var(--color-bg-subtle)',
                          color: isSelected ? 'var(--color-accent)' : 'var(--color-text-primary)',
                          fontSize: 'var(--text-xs)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ fontWeight: 'var(--font-bold)', marginRight: 6 }}>
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="row-between" style={{ marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={handleResetAndClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!allAnswered || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Evaluating...' : 'Submit Assessment'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default PracticeAssessmentModal;
