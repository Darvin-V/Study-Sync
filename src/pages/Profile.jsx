import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Avatar,
  Badge,
  Button,
  Input,
  Select,
  Modal,
  LearningDNAEditorModal,
} from '../components';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { usePreferences } from '../context/PreferencesContext';
import { ROUTES } from '../config/routes';

export function Profile() {
  const { t } = usePreferences();
  const { user, profile, isAuthenticated, updateProfile } = useAuth();
  const {
    learningDna,
    loadLearningDna,
    updateLearningDna,
    knowledgeProgress,
    loadKnowledgeProgress,
    knowledgeMap,
    loadKnowledgeMap,
    sessions,
    notes,
  } = useApp();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDnaModalOpen, setIsDnaModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Load real Learning DNA, Knowledge Map, and progress on mount when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadLearningDna();
      loadKnowledgeProgress();
      loadKnowledgeMap();
    }
  }, [isAuthenticated, loadLearningDna, loadKnowledgeProgress, loadKnowledgeMap]);

  // Common Study Languages for quick multi-selection
  const COMMON_STUDY_LANGUAGES = [
    'English',
    'Tamil',
    'Hindi',
    'Telugu',
    'Malayalam',
    'Kannada',
    'Bengali',
    'Marathi',
  ];

  // Form State for Editing
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [institution, setInstitution] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [studyTimes, setStudyTimes] = useState('');
  const [studyDuration, setStudyDuration] = useState(45);
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [customLanguage, setCustomLanguage] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editGender, setEditGender] = useState('Prefer not to say');

  // Open Edit Modal with current values
  const handleOpenEdit = () => {
    setDisplayName(user?.displayName || user?.name || '');
    setHeadline(profile?.headline || user?.degree || '');
    setInstitution(profile?.institution || user?.institution || '');
    setIntroduction(profile?.introduction || user?.bio || '');
    setSkillLevel(profile?.skillLevel || user?.skillLevel || 'Intermediate');
    setStudyTimes(profile?.preferredStudyTimes || user?.preferences?.schedule || '');
    setStudyDuration(profile?.preferredStudyDuration || 45);
    setEditAge(profile?.age ? String(profile.age) : '');
    setEditGender(profile?.gender || 'Prefer not to say');

    // Parse preferred languages from profile or user record
    const existingLangs = Array.isArray(profile?.preferredLanguages)
      ? profile.preferredLanguages
      : Array.isArray(user?.preferredLanguages)
      ? user.preferredLanguages
      : ['English'];

    const standardSelected = [];
    const customLangs = [];

    for (const lang of existingLangs) {
      if (!lang || typeof lang !== 'string') continue;
      const trimmed = lang.trim();
      const matched = COMMON_STUDY_LANGUAGES.find((std) => std.toLowerCase() === trimmed.toLowerCase());
      if (matched) {
        if (!standardSelected.includes(matched)) standardSelected.push(matched);
      } else {
        if (!customLangs.includes(trimmed)) customLangs.push(trimmed);
      }
    }

    setSelectedLanguages(standardSelected);
    if (customLangs.length > 0) {
      setIsOtherSelected(true);
      setCustomLanguage(customLangs.join(', '));
    } else {
      setIsOtherSelected(false);
      setCustomLanguage('');
    }

    setSaveError('');
    setSaveSuccess(false);
    setIsEditModalOpen(true);
  };

  const handleToggleLanguage = (langName) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(langName)) {
        return prev.filter((l) => l !== langName);
      } else {
        return [...prev, langName];
      }
    });
  };

  const handleToggleOther = () => {
    setIsOtherSelected((prev) => {
      const next = !prev;
      if (!next) setCustomLanguage('');
      return next;
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      // Assemble final deduplicated languages list
      const finalLanguages = [...selectedLanguages];
      if (isOtherSelected && customLanguage.trim()) {
        const extraLangs = customLanguage
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        for (const extra of extraLangs) {
          if (!finalLanguages.some((l) => l.toLowerCase() === extra.toLowerCase())) {
            finalLanguages.push(extra);
          }
        }
      }

      const res = await updateProfile({
        displayName: displayName.trim(),
        headline: headline.trim(),
        institution: institution.trim(),
        introduction: introduction.trim(),
        skillLevel,
        preferredStudyTimes: studyTimes.trim(),
        preferredStudyDuration: Number(studyDuration),
        preferredLanguages: finalLanguages,
        age: editAge ? parseInt(editAge, 10) : null,
        gender: editGender,
      });

      if (!res.success) {
        setSaveError(res.error || 'Failed to save profile');
        setIsSaving(false);
        return;
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSaveSuccess(false);
      }, 1000);
    } catch (err) {
      setSaveError(err.message || 'An error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  // Determine effective display data from authentic database records
  const effectiveName = user?.displayName || user?.name || 'Scholar';
  const effectiveInitials = effectiveName.charAt(0).toUpperCase();
  const effectiveHeadline = profile?.headline || user?.degree || 'Undergraduate Scholar';
  const effectiveInstitution = profile?.institution || user?.institution || '';
  const effectiveBio = profile?.introduction || user?.bio || '';
  const effectiveSkill = profile?.skillLevel || user?.skillLevel || 'Intermediate';
  const effectiveLanguages = profile?.preferredLanguages || user?.preferredLanguages || ['English'];
  const effectiveSchedule = profile?.preferredStudyTimes || user?.preferences?.schedule || 'Weekday evenings';
  const effectiveDuration = profile?.preferredStudyDuration
    ? `${profile.preferredStudyDuration} minutes`
    : '45 minutes';
  const effectiveCollabStyle =
    learningDna?.collaborationStyle || profile?.collaborationStyle || 'Peer discussion & problem solving';

  // Real Learning Profile topics (Merged DNA: can teach and wants help with)
  const canTeachTopics = learningDna?.willingToTeachTopics?.length
    ? learningDna.willingToTeachTopics
    : (profile?.willingToTeach?.length ? profile.willingToTeach : []);

  const wantsHelpTopics = learningDna?.wantsPeerSupportTopics?.length
    ? learningDna.wantsPeerSupportTopics
    : (profile?.wantsPeerSupport?.length ? profile.wantsPeerSupport : []);

  // Real statistics calculation (hides unavailable or empty metrics)
  const completedSessionsCount = knowledgeProgress?.studyActivity?.completedSessionsCount ?? (sessions?.length || 0);
  const notesCount = knowledgeProgress?.knowledgeExchange?.notesCreatedCount ?? (notes?.length || 0);
  const verifiedAssessmentsCount = knowledgeProgress?.verifiedAssessments?.totalAssessmentsTaken || 0;
  const passedAssessmentsCount = knowledgeProgress?.verifiedAssessments?.passedAssessmentsCount || 0;
  const peersHelpedCount = knowledgeProgress?.knowledgeExchange?.peersHelpedCount || 0;
  const totalHoursStudied = knowledgeProgress?.studyActivity?.totalHoursStudied || 0;

  // Genuine collaboration metric: verified assessments or peers helped (hide if 0)
  const showCollaborationMetric = verifiedAssessmentsCount > 0 || peersHelpedCount > 0;
  const collaborationStatValue = verifiedAssessmentsCount > 0 ? passedAssessmentsCount : peersHelpedCount;
  const collaborationStatLabel = verifiedAssessmentsCount > 0 ? 'Quizzes' : 'Helped';

  // Short, useful list of curriculum topics
  const availableTopics = knowledgeMap?.allTopics || [];
  const myTopicsList = availableTopics.slice(0, 4);

  return (
    <div className="profile-page-wrapper" id="profile-page">
      {/* Page Header with One Clear Primary Action */}
      <header id="profile-page-header" className="profile-header-bar">
        <div>
          <h1 className="profile-title">{t('profile.title', 'Academic Profile')}</h1>
          <p className="profile-subtitle">{t('profile.subtitle', 'Verified academic identity, curriculum focus, and study preferences.')}</p>
        </div>

        <div>
          {isAuthenticated ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenEdit}
              id="edit-profile-open-btn"
            >
              ✎ {t('common.edit', 'Edit Profile')}
            </Button>
          ) : (
            <Link to={ROUTES.LOGIN}>
              <Button variant="primary" size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Guest Notice */}
      {!isAuthenticated && (
        <div id="profile-guest-notice" className="profile-guest-banner">
          <span>Previewing demo student profile. Sign in to customize your study profile.</span>
          <Link to={ROUTES.LOGIN}>Sign In &rarr;</Link>
        </div>
      )}

      {/* 1. Profile Header & 3. Learning Progress */}
      <Card id="student-identity-card" className="profile-card">
        <div className="profile-identity-layout">
          <Avatar
            name={effectiveName}
            initials={effectiveInitials}
            size="lg"
            status="online"
          />
          <div className="profile-identity-info">
            <div className="profile-name-row">
              <h2 className="profile-user-name">{effectiveName}</h2>
              <Badge variant="accent">{effectiveSkill}</Badge>
              {isAuthenticated && <Badge variant="neutral">Verified Student</Badge>}
            </div>

            <p className="profile-headline-text">
              {effectiveHeadline}
              {effectiveInstitution ? ` • ${effectiveInstitution}` : ''}
            </p>

            {effectiveBio ? (
              <p className="profile-bio-text">{effectiveBio}</p>
            ) : isAuthenticated ? (
              <button
                type="button"
                onClick={handleOpenEdit}
                className="profile-bio-add-btn"
              >
                + Add a short bio
              </button>
            ) : null}
          </div>
        </div>

        {/* 3. Learning Progress (Compact Stats Row) */}
        <div className="profile-stat-ribbon">
          <div className="profile-stat-cell">
            <span className="profile-stat-value">{completedSessionsCount}</span>
            <span className="profile-stat-label">Sessions</span>
          </div>

          <div className="profile-stat-divider" />

          <div className="profile-stat-cell">
            <span className="profile-stat-value">{notesCount}</span>
            <span className="profile-stat-label">Notes</span>
          </div>

          {showCollaborationMetric && (
            <>
              <div className="profile-stat-divider" />
              <div className="profile-stat-cell">
                <span className="profile-stat-value">{collaborationStatValue}</span>
                <span className="profile-stat-label">{collaborationStatLabel}</span>
              </div>
            </>
          )}

          {totalHoursStudied > 0 && (
            <>
              <div className="profile-stat-divider" />
              <div className="profile-stat-cell">
                <span className="profile-stat-value">{totalHoursStudied}h</span>
                <span className="profile-stat-label">Hours</span>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* 2. & 6. Learning Profile (Merged Learning DNA with compact chips) */}
      <Card className="profile-card" id="learning-profile-card">
        <div className="profile-card-header">
          <div>
            <h3 className="profile-section-heading">Learning Profile</h3>
            <p className="profile-section-sub">Topics you can explain and where you welcome peer collaboration</p>
          </div>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDnaModalOpen(true)}
              id="profile-edit-dna-btn"
              style={{ fontSize: '12px' }}
            >
              ✎ Edit Topics
            </Button>
          )}
        </div>

        <div className="profile-chips-sections">
          {/* Topics Learner Can Teach / Explain */}
          <div className="profile-chip-group">
            <div className="profile-chip-label">
              <span>Can Explain & Teach</span>
              {canTeachTopics.length > 0 && <span className="profile-count-pill">{canTeachTopics.length}</span>}
            </div>
            <div className="profile-chip-list">
              {canTeachTopics.length > 0 ? (
                canTeachTopics.map((topic) => (
                  <span key={topic.id || topic.name} className="profile-chip profile-chip-teach">
                    ✓ {topic.name || topic.topicName}
                  </span>
                ))
              ) : (
                <div className="profile-empty-inline">
                  <span className="profile-empty-text">No teaching topics selected yet.</span>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => setIsDnaModalOpen(true)}
                      className="profile-inline-action"
                    >
                      + Add topics
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Topics Learner Wants Help With */}
          <div className="profile-chip-group">
            <div className="profile-chip-label">
              <span>Wants Help With</span>
              {wantsHelpTopics.length > 0 && <span className="profile-count-pill">{wantsHelpTopics.length}</span>}
            </div>
            <div className="profile-chip-list">
              {wantsHelpTopics.length > 0 ? (
                wantsHelpTopics.map((topic) => (
                  <span key={topic.id || topic.name} className="profile-chip profile-chip-help">
                    ? {topic.name || topic.topicName}
                  </span>
                ))
              ) : (
                <div className="profile-empty-inline">
                  <span className="profile-empty-text">No help topics selected yet.</span>
                  {isAuthenticated && (
                    <button
                      type="button"
                      onClick={() => setIsDnaModalOpen(true)}
                      className="profile-inline-action"
                    >
                      + Add topics
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Collaboration Rhythm (Merged from DNA) */}
          <div className="profile-style-badge-row">
            <span className="profile-style-label">Study Style:</span>
            <span className="profile-style-value">👥 {effectiveCollabStyle}</span>
          </div>
        </div>
      </Card>

      {/* 4. My Topics (Short, useful list of learning topics with progress status) */}
      <Card className="profile-card" id="my-topics-card">
        <div className="profile-card-header">
          <div>
            <h3 className="profile-section-heading">My Topics</h3>
            <p className="profile-section-sub">Coursework and active syllabus units</p>
          </div>
          {availableTopics.length > 0 && (
            <Link to={ROUTES.KNOWLEDGE_MAP} id="profile-view-all-topics-btn">
              <Button variant="ghost" size="sm" style={{ fontSize: '12px' }}>
                View all {availableTopics.length > 4 ? `(${availableTopics.length})` : ''} &rarr;
              </Button>
            </Link>
          )}
        </div>

        {myTopicsList.length > 0 ? (
          <div className="profile-topics-list">
            {myTopicsList.map((topic) => {
              const title = topic.topicName || topic.title || topic.name;
              const state = topic.state || 'in_progress';
              const badgeVariant =
                state === 'assessed' ? 'accent' : state === 'needs_review' ? 'warning' : 'neutral';
              const badgeLabel =
                state === 'assessed' ? 'Assessed' : state === 'needs_review' ? 'Needs Review' : 'In Progress';

              return (
                <div key={topic.id || title} className="profile-topic-row">
                  <div className="profile-topic-main">
                    <span className="profile-topic-subject">{topic.subject || 'Coursework'}</span>
                    <span className="profile-topic-title">{title}</span>
                  </div>
                  <Badge variant={badgeVariant}>{badgeLabel}</Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="profile-empty-box">
            <p className="profile-empty-text">No curriculum topics added yet.</p>
            <Link to={ROUTES.KNOWLEDGE_MAP}>
              <Button variant="outline" size="sm">
                + Browse Topics
              </Button>
            </Link>
          </div>
        )}
      </Card>

      {/* 5. Study Preferences (Compact section with single edit action) */}
      <Card className="profile-card" id="study-preferences-card">
        <div className="profile-card-header">
          <div>
            <h3 className="profile-section-heading">Study Preferences</h3>
            <p className="profile-section-sub">Settings for optimal collaboration rhythm</p>
          </div>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenEdit}
              id="profile-edit-preferences-btn"
              style={{ fontSize: '12px' }}
            >
              ✎ Edit
            </Button>
          )}
        </div>

        <div className="profile-preferences-grid">
          <div className="profile-pref-item">
            <span className="profile-pref-label">Preferred Schedule</span>
            <span className="profile-pref-value">{effectiveSchedule}</span>
          </div>

          <div className="profile-pref-item">
            <span className="profile-pref-label">Focus Duration</span>
            <span className="profile-pref-value">{effectiveDuration}</span>
          </div>

          <div className="profile-pref-item">
            <span className="profile-pref-label">Preferred Study Languages</span>
            <span className="profile-pref-value" id="profile-display-languages">
              {Array.isArray(effectiveLanguages) && effectiveLanguages.length > 0
                ? effectiveLanguages.join(', ')
                : 'None specified'}
            </span>
          </div>

          <div className="profile-pref-item">
            <span className="profile-pref-label">Study Style</span>
            <span className="profile-pref-value">{effectiveCollabStyle}</span>
          </div>
        </div>
      </Card>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Learner Profile"
          id="edit-profile-modal"
          footer={
            <div className="row-between" style={{ width: '100%', alignItems: 'center' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSaving}
                id="edit-profile-cancel-btn"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="edit-profile-form"
                variant="primary"
                disabled={isSaving}
                id="edit-profile-save-btn"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          }
        >
          <form id="edit-profile-form" onSubmit={handleSaveProfile} className="stack" style={{ gap: 'var(--space-4)' }}>
            {saveError && (
              <div
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-danger-subtle, #fef2f2)',
                  color: 'var(--color-danger-text, #b91c1c)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                {saveError}
              </div>
            )}

            {saveSuccess && (
              <div
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-success-bg, #f0fdf4)',
                  color: 'var(--color-success-text, #15803d)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                Profile updated successfully!
              </div>
            )}

            <Input
              id="edit-display-name-input"
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />

            <Input
              id="edit-headline-input"
              label="Academic Headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Junior (Year 3) • B.S. in Computer Science"
            />

            <Input
              id="edit-institution-input"
              label="Department / University"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="e.g. Department of Computing & Information Sciences"
            />

            <div>
              <label
                htmlFor="edit-intro-input"
                style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-secondary)', display: 'block', marginBottom: 4 }}
              >
                Short Introduction / Bio
              </label>
              <textarea
                id="edit-intro-input"
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                rows={3}
                placeholder="Share your academic interests, focus areas, or goals..."
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-subtle)',
                  backgroundColor: 'var(--color-bg-surface)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--text-sm)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </div>

            <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
              <Select
                id="edit-skill-select"
                label="Self-Reported Skill Level"
                value={skillLevel}
                onChange={(e) => setSkillLevel(e.target.value)}
                options={[
                  { value: 'Beginner', label: 'Beginner' },
                  { value: 'Intermediate', label: 'Intermediate' },
                  { value: 'Advanced', label: 'Advanced' },
                ]}
              />

              <Select
                id="edit-duration-select"
                label="Focus Sprint Duration"
                value={studyDuration}
                onChange={(e) => setStudyDuration(Number(e.target.value))}
                options={[
                  { value: 25, label: '25 min (Pomodoro)' },
                  { value: 45, label: '45 min (Standard focus)' },
                  { value: 60, label: '60 min (Deep study)' },
                  { value: 90, label: '90 min (Extended block)' },
                ]}
              />
            </div>

            <Input
              id="edit-schedule-input"
              label="Preferred Study Schedule"
              value={studyTimes}
              onChange={(e) => setStudyTimes(e.target.value)}
              placeholder="e.g. Weekday evenings & weekend mornings"
            />

            {/* Preferred Languages (Multi-selection) */}
            <div className="profile-languages-group">
              <label
                htmlFor="profile-lang-selector"
                id="edit-languages-label"
                className="profile-field-label"
              >
                Preferred Languages
              </label>
              <p className="profile-field-helper">
                Select the languages you feel comfortable using during study sessions and collaboration.
              </p>
              <div
                className="profile-languages-chip-grid"
                role="group"
                aria-labelledby="edit-languages-label"
                id="profile-lang-selector"
              >
                {COMMON_STUDY_LANGUAGES.map((lang) => {
                  const isChecked = selectedLanguages.includes(lang);
                  return (
                    <button
                      key={lang}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      id={`edit-lang-btn-${lang.toLowerCase()}`}
                      className={`profile-lang-pill ${isChecked ? 'active' : ''}`}
                      onClick={() => handleToggleLanguage(lang)}
                    >
                      <span className="profile-lang-check" aria-hidden="true">
                        {isChecked ? '✓' : '+'}
                      </span>
                      {lang}
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isOtherSelected}
                  id="edit-lang-btn-other"
                  className={`profile-lang-pill ${isOtherSelected ? 'active' : ''}`}
                  onClick={handleToggleOther}
                >
                  <span className="profile-lang-check" aria-hidden="true">
                    {isOtherSelected ? '✓' : '+'}
                  </span>
                  Other
                </button>
              </div>

              {isOtherSelected && (
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Input
                    id="edit-other-language-input"
                    label="Specify Other Language(s)"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    placeholder="e.g. French, German, Spanish"
                    helperText="Enter one or more languages (separated by comma)"
                  />
                </div>
              )}
            </div>

            <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
              <Input
                id="edit-age-input"
                label="Age (Private 🔒)"
                type="number"
                min="4"
                max="120"
                value={editAge}
                onChange={(e) => setEditAge(e.target.value)}
                helperText="Never shown publicly."
              />
              <Select
                id="edit-gender-select"
                label="Gender (Private 🔒)"
                value={editGender}
                onChange={(e) => setEditGender(e.target.value)}
                options={[
                  { value: 'Prefer not to say', label: 'Prefer not to say' },
                  { value: 'Woman', label: 'Woman' },
                  { value: 'Man', label: 'Man' },
                  { value: 'Non-binary', label: 'Non-binary' },
                  { value: 'Self-describe', label: 'Self-describe' },
                ]}
                helperText="Strictly confidential."
              />
            </div>

            {/* Quick Link to Topic Preferences */}
            <div
              style={{
                padding: 'var(--space-2-5) var(--space-3)',
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 'var(--text-xs)',
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)' }}>
                Want to manage topics you can teach or need help with?
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setIsDnaModalOpen(true);
                }}
                style={{ fontSize: '11px' }}
              >
                Edit Topics &rarr;
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Learning DNA Modal */}
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

export default Profile;
