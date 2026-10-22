import React, { useState, useEffect } from 'react';
import {
  Section,
  Card,
  Button,
  Badge,
  KnowledgeMap,
  TransparentProgressOverview,
  TopicPrerequisitePathways,
  LearningDNAEditorModal,
  AdaptiveLearningRecommendationsCard,
} from '../components';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';

export function KnowledgeMapPage() {
  const { isAuthenticated } = useAuth();
  const {
    knowledgeMap,
    isKnowledgeMapLoading,
    knowledgeMapError,
    loadKnowledgeMap,
    knowledgeProgress,
    isProgressLoading,
    loadKnowledgeProgress,
    learningPaths,
    loadLearningPaths,
    learningDna,
    loadLearningDna,
    updateLearningDna,
    submitTopicAssessment,
  } = useApp();

  const [isDnaModalOpen, setIsDnaModalOpen] = useState(false);
  const [activeView, setActiveView] = useState('map'); // 'map' | 'paths' | 'progress'

  useEffect(() => {
    loadKnowledgeMap();
    loadKnowledgeProgress();
    loadLearningPaths();
    loadLearningDna();
  }, [loadKnowledgeMap, loadKnowledgeProgress, loadLearningPaths, loadLearningDna]);

  // Combine curriculum topics for DNA editor
  const availableTopics = knowledgeMap?.allTopics || [];

  return (
    <div className="stack" style={{ gap: 'var(--space-6)' }} id="knowledge-map-page">
      {/* 1. Page Header */}
      <header id="knowledge-map-header" className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
            Knowledge Map & Learning DNA
          </h1>
          <p style={{ fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Explore your real curriculum progress, verified assessment results, and structured topic pathways.
          </p>
        </div>

        <div className="row" style={{ gap: 'var(--space-2)' }}>
          {isAuthenticated ? (
            <Button
              variant="secondary"
              onClick={() => setIsDnaModalOpen(true)}
              id="edit-learning-dna-btn"
            >
              Edit Learning DNA
            </Button>
          ) : (
            <Badge variant="neutral">Sign in to customize your DNA</Badge>
          )}
        </div>
      </header>

      {/* 2. Learning DNA Summary Bar */}
      {learningDna && (
        <Card
          id="learning-dna-summary-bar"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            backgroundColor: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div className="row-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <div className="row" style={{ gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-bold)', color: 'var(--color-text-primary)' }}>
                Your Learning DNA:
              </span>
              <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <Badge variant="accent">
                  🤝 {learningDna.collaborationStyle || 'Peer discussion'}
                </Badge>
                <Badge variant="neutral">
                  ⏱️ {learningDna.preferredStudyTimes || 'Weekday evenings'}
                </Badge>
                {learningDna.stats?.willingToTeachCount > 0 && (
                  <Badge variant="accent">
                    🎓 Willing to teach ({learningDna.stats.willingToTeachCount})
                  </Badge>
                )}
                {learningDna.stats?.wantsPeerSupportCount > 0 && (
                  <Badge variant="neutral">
                    🙋 Needs peer support ({learningDna.stats.wantsPeerSupportCount})
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsDnaModalOpen(true)}
            >
              Update Preferences
            </Button>
          </div>
        </Card>
      )}

      {/* 3. Navigation View Switcher */}
      <div className="row" style={{ gap: 'var(--space-2)', borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveView('map')}
          id="tab-view-map"
          style={{
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: activeView === 'map' ? 'var(--font-bold)' : 'var(--font-medium)',
            backgroundColor: activeView === 'map' ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
            color: activeView === 'map' ? '#ffffff' : 'var(--color-text-secondary)',
            border: `1px solid ${activeView === 'map' ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🗺️ Topic Map & Statuses
        </button>

        <button
          type="button"
          onClick={() => setActiveView('paths')}
          id="tab-view-paths"
          style={{
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: activeView === 'paths' ? 'var(--font-bold)' : 'var(--font-medium)',
            backgroundColor: activeView === 'paths' ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
            color: activeView === 'paths' ? '#ffffff' : 'var(--color-text-secondary)',
            border: `1px solid ${activeView === 'paths' ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          ⛓️ Prerequisite Pathways
        </button>

        <button
          type="button"
          onClick={() => setActiveView('progress')}
          id="tab-view-progress"
          style={{
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: activeView === 'progress' ? 'var(--font-bold)' : 'var(--font-medium)',
            backgroundColor: activeView === 'progress' ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
            color: activeView === 'progress' ? '#ffffff' : 'var(--color-text-secondary)',
            border: `1px solid ${activeView === 'progress' ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          📊 Transparent Progress Signals
        </button>

        <button
          type="button"
          onClick={() => setActiveView('recs')}
          id="tab-view-recs"
          style={{
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: activeView === 'recs' ? 'var(--font-bold)' : 'var(--font-medium)',
            backgroundColor: activeView === 'recs' ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
            color: activeView === 'recs' ? '#ffffff' : 'var(--color-text-secondary)',
            border: `1px solid ${activeView === 'recs' ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          🎯 Adaptive Pathway
        </button>
      </div>

      {/* 4. Active Tab Content */}
      {activeView === 'recs' && (
        <AdaptiveLearningRecommendationsCard />
      )}

      {activeView === 'map' && (
        <div className="stack" style={{ gap: 'var(--space-6)' }}>
          <AdaptiveLearningRecommendationsCard />
          <KnowledgeMap
            knowledgeMapData={knowledgeMap}
            isLoading={isKnowledgeMapLoading}
            error={knowledgeMapError}
            onRefresh={loadKnowledgeMap}
            onSubmitAssessment={submitTopicAssessment}
          />
        </div>
      )}

      {activeView === 'paths' && (
        <TopicPrerequisitePathways
          pathways={learningPaths?.pathways}
          onSelectTopic={(topicId) => {
            setActiveView('map');
          }}
        />
      )}

      {activeView === 'progress' && (
        <TransparentProgressOverview
          progress={knowledgeProgress}
        />
      )}

      {/* 5. Learning DNA Editor Modal */}
      {isDnaModalOpen && (
        <LearningDNAEditorModal
          isOpen={isDnaModalOpen}
          onClose={() => setIsDnaModalOpen(false)}
          learningDna={learningDna}
          availableTopics={availableTopics}
          onSave={updateLearningDna}
        />
      )}
    </div>
  );
}

export default KnowledgeMapPage;
