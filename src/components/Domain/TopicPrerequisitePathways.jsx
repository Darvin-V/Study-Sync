import React from 'react';
import { Card, Badge, Button } from '../UI';

/**
 * StudySync AI — Topic Prerequisite Pathways (Phase 10)
 * 
 * Renders explicit curriculum prerequisite relationships (e.g. SQL Fundamentals -> SQL Joins -> DBMS Normalisation).
 * Distinguishes:
 * - Completed / Assessed steps
 * - Learning Now steps
 * - Ready to Learn steps (prerequisites met)
 * - Prerequisite Pending steps (must complete earlier foundation first)
 */
export function TopicPrerequisitePathways({ pathways, onSelectTopic, className = '', id = 'prerequisite-pathways' }) {
  if (!pathways || Object.keys(pathways).length === 0) {
    return (
      <Card id={id} className={`stack ${className}`} style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
          No prerequisite pathways configured for your enrolled subjects.
        </p>
      </Card>
    );
  }

  const getStepBadge = (status) => {
    switch (status) {
      case 'completed':
        return <Badge variant="accent">✓ Completed</Badge>;
      case 'learning_now':
        return <Badge variant="primary">● In Progress</Badge>;
      case 'ready_to_learn':
        return <Badge variant="accent">Ready to Learn</Badge>;
      case 'prerequisite_pending':
      default:
        return <Badge variant="neutral">Prerequisite Pending</Badge>;
    }
  };

  return (
    <div id={id} className={`stack ${className}`} style={{ gap: 'var(--space-4)' }}>
      <div className="row-between" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div>
          <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            Curriculum Learning Pathways
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
            Explicit prerequisite sequences grounded in standard syllabus structures.
          </p>
        </div>
      </div>

      <div className="stack" style={{ gap: 'var(--space-3)' }}>
        {Object.entries(pathways).map(([subjectName, steps]) => (
          <Card
            key={subjectName}
            id={`pathway-${subjectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            className="stack"
            style={{
              gap: 'var(--space-3)',
              padding: 'var(--space-4)',
              backgroundColor: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div className="row-between" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                {subjectName}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {steps.length} prerequisite rule{steps.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              {steps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className="row-between"
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-bg-subtle)',
                    border: '1px solid var(--color-border-subtle)',
                    flexWrap: 'wrap',
                    gap: 'var(--space-3)',
                  }}
                >
                  <div className="row" style={{ alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', flex: 1, minWidth: 'min(200px, 100%)' }}>
                    {/* Source Prerequisite */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Prerequisite</span>
                      <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                        {step.prerequisite.name}
                      </strong>
                    </div>

                    <span style={{ color: 'var(--color-accent)', fontWeight: 'var(--font-bold)', margin: '0 4px' }}>
                      &rarr;
                    </span>

                    {/* Target Topic */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Target Topic</span>
                      <strong style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-primary)' }}>
                        {step.topic.name}
                      </strong>
                    </div>
                  </div>

                  <div className="row" style={{ alignItems: 'center', gap: 'var(--space-3)' }}>
                    {getStepBadge(step.stepStatus)}

                    {onSelectTopic && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onSelectTopic(step.topic.id)}
                      >
                        View Node
                      </Button>
                    )}
                  </div>

                  {step.reason && (
                    <div style={{ width: '100%', fontSize: '11px', color: 'var(--color-text-muted)', borderTop: '1px dashed var(--color-border-subtle)', paddingTop: 6, marginTop: 2 }}>
                      💡 <em>{step.reason}</em>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default TopicPrerequisitePathways;
