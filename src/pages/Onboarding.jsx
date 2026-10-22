import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../config/routes';
import { Card, Button, Input, Select, Badge } from '../components';

const EDUCATION_STAGES = [
  { value: 'kindergarten', label: 'Kindergarten / Early Childhood' },
  { value: 'primary_school', label: 'Primary School (Grades 1-5)' },
  { value: 'middle_school', label: 'Middle School (Grades 6-8)' },
  { value: 'secondary_school', label: 'Secondary School (Grades 9-10)' },
  { value: 'higher_secondary', label: 'Higher Secondary / Senior Secondary (Grades 11-12)' },
  { value: 'iti_vocational', label: 'ITI / Vocational Training' },
  { value: 'polytechnic_diploma', label: 'Polytechnic / Diploma' },
  { value: 'undergraduate', label: 'Undergraduate Degree (College / University)' },
  { value: 'postgraduate', label: 'Postgraduate Degree (Master’s / Professional)' },
  { value: 'doctoral', label: 'Doctoral / Research Studies (Ph.D.)' },
  { value: 'professional_continuing', label: 'Professional / Continuing Education' },
  { value: 'independent_other', label: 'Independent Learner / Other' },
];

const PREDEFINED_GOALS = [
  'Understand school subjects & core syllabus concepts',
  'Prepare for upcoming school or university examinations',
  'Master coursework problem sets and weekly assignments',
  'Learn a new technical, trade, or vocational skill',
  'Prepare for professional certifications or competitive exams',
  'Co-study with peer partners for focus & accountability',
  'Practise explaining topics and teaching peers',
  'Explore a completely new academic or creative domain',
];

const AVAILABLE_LANGUAGES = [
  'English',
  'Tamil',
  'Hindi',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Spanish',
  'Mandarin',
  'French',
  'German',
  'Arabic',
];

export function Onboarding() {
  const { user, profile, updateProfile, logout } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const totalSteps = 5;

  // Step 1: Basic Profile
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [customGender, setCustomGender] = useState('');

  // Step 2: Educational Background
  const [educationStage, setEducationStage] = useState('undergraduate');
  const [institutionName, setInstitutionName] = useState('');
  const [fieldOrMajor, setFieldOrMajor] = useState('');
  const [currentLevelOrYear, setCurrentLevelOrYear] = useState('');
  const [boardOrStream, setBoardOrStream] = useState('');

  // Step 3: Learning Goals
  const [selectedGoals, setSelectedGoals] = useState([
    'Understand school subjects & core syllabus concepts',
  ]);
  const [customGoalText, setCustomGoalText] = useState('');

  // Step 4: Optional Learning Preferences
  const [selectedLanguages, setSelectedLanguages] = useState(['English']);
  const [preferredStudyTimes, setPreferredStudyTimes] = useState('Weekday evenings');
  const [preferredDuration, setPreferredDuration] = useState(45);
  const [collaborationStyle, setCollaborationStyle] = useState('Peer discussion & problem solving');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize with existing profile data if present
  useEffect(() => {
    if (user?.displayName && !displayName) {
      setDisplayName(user.displayName);
    }
    if (profile) {
      if (profile.age) setAge(String(profile.age));
      if (profile.gender) {
        if (['Woman', 'Man', 'Non-binary', 'Prefer not to say'].includes(profile.gender)) {
          setGender(profile.gender);
        } else {
          setGender('Self-describe');
          setCustomGender(profile.gender);
        }
      }
      if (profile.educationStage) setEducationStage(profile.educationStage);
      if (profile.institution) setInstitutionName(profile.institution);
      if (profile.educationDetails) {
        if (profile.educationDetails.fieldOrMajor) setFieldOrMajor(profile.educationDetails.fieldOrMajor);
        if (profile.educationDetails.currentLevelOrYear) setCurrentLevelOrYear(profile.educationDetails.currentLevelOrYear);
        if (profile.educationDetails.boardOrStream) setBoardOrStream(profile.educationDetails.boardOrStream);
      }
      if (profile.learningGoals && profile.learningGoals.length > 0) {
        setSelectedGoals(profile.learningGoals);
      }
      if (profile.preferredLanguages && profile.preferredLanguages.length > 0) {
        setSelectedLanguages(profile.preferredLanguages);
      }
      if (profile.preferredStudyTimes) setPreferredStudyTimes(profile.preferredStudyTimes);
      if (profile.preferredStudyDuration) setPreferredDuration(profile.preferredStudyDuration);
      if (profile.collaborationStyle) setCollaborationStyle(profile.collaborationStyle);
    }
  }, [user, profile]);

  // Validation per step
  const validateCurrentStep = () => {
    const errors = {};
    if (step === 1) {
      if (!displayName.trim() || displayName.trim().length < 2) {
        errors.displayName = 'Display name must be at least 2 characters.';
      }
      if (age !== '') {
        const parsedAge = parseInt(age, 10);
        if (isNaN(parsedAge) || parsedAge < 4 || parsedAge > 120) {
          errors.age = 'Please enter a valid age between 4 and 120.';
        }
      }
    } else if (step === 2) {
      if (!educationStage) {
        errors.educationStage = 'Please select your current educational stage.';
      }
    } else if (step === 3) {
      if (selectedGoals.length === 0 && !customGoalText.trim()) {
        errors.goals = 'Please select or add at least one learning goal.';
      }
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const toggleLanguage = (lang) => {
    if (selectedLanguages.includes(lang)) {
      if (selectedLanguages.length > 1) {
        setSelectedLanguages(selectedLanguages.filter((l) => l !== lang));
      }
    } else {
      setSelectedLanguages([...selectedLanguages, lang]);
    }
  };

  const toggleGoal = (goal) => {
    if (selectedGoals.includes(goal)) {
      setSelectedGoals(selectedGoals.filter((g) => g !== goal));
    } else {
      setSelectedGoals([...selectedGoals, goal]);
    }
  };

  const handleAddCustomGoal = (e) => {
    if (e) e.preventDefault();
    const trimmed = customGoalText.trim();
    if (trimmed && !selectedGoals.includes(trimmed)) {
      setSelectedGoals([...selectedGoals, trimmed]);
      setCustomGoalText('');
    }
  };

  // Build headline and educational context
  const buildHeadline = () => {
    const stageObj = EDUCATION_STAGES.find((s) => s.value === educationStage);
    const stageLabel = stageObj ? stageObj.label.split('(')[0].trim() : 'Learner';

    if (fieldOrMajor && currentLevelOrYear) {
      return `${currentLevelOrYear} • ${fieldOrMajor}`;
    }
    if (fieldOrMajor) {
      return `${stageLabel} • ${fieldOrMajor}`;
    }
    if (currentLevelOrYear) {
      return `${stageLabel} (${currentLevelOrYear})`;
    }
    return stageLabel;
  };

  const handleNext = async () => {
    if (!validateCurrentStep()) return;
    setErrorMsg('');

    // Intermediate persistence after basic steps
    if (step === 1) {
      setIsSaving(true);
      const effectiveGender = gender === 'Self-describe' ? customGender.trim() || 'Self-describe' : gender;
      await updateProfile({
        displayName: displayName.trim(),
        age: age ? parseInt(age, 10) : null,
        gender: effectiveGender,
        isProfileCompleted: false,
      });
      setIsSaving(false);
    } else if (step === 2) {
      setIsSaving(true);
      await updateProfile({
        headline: buildHeadline(),
        institution: institutionName.trim(),
        educationStage,
        educationDetails: {
          fieldOrMajor: fieldOrMajor.trim(),
          currentLevelOrYear: currentLevelOrYear.trim(),
          boardOrStream: boardOrStream.trim(),
        },
        isProfileCompleted: false,
      });
      setIsSaving(false);
    } else if (step === 3) {
      setIsSaving(true);
      await updateProfile({
        learningGoals: selectedGoals,
        isProfileCompleted: false,
      });
      setIsSaving(false);
    }

    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setErrorMsg('');
    setValidationErrors({});
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleCompleteOnboarding = async () => {
    setIsSaving(true);
    setErrorMsg('');

    const effectiveGender = gender === 'Self-describe' ? customGender.trim() || 'Self-describe' : gender;
    const finalHeadline = buildHeadline();

    const payload = {
      displayName: displayName.trim() || user?.displayName,
      age: age ? parseInt(age, 10) : null,
      gender: effectiveGender,
      educationStage,
      headline: finalHeadline,
      institution: institutionName.trim(),
      educationDetails: {
        fieldOrMajor: fieldOrMajor.trim(),
        currentLevelOrYear: currentLevelOrYear.trim(),
        boardOrStream: boardOrStream.trim(),
      },
      learningGoals: selectedGoals,
      preferredLanguages: selectedLanguages,
      preferredStudyTimes,
      preferredStudyDuration: Number(preferredDuration),
      collaborationStyle,
      isProfileCompleted: true,
    };

    const res = await updateProfile(payload);
    setIsSaving(false);

    if (res.success) {
      navigate(ROUTES.HOME, { replace: true });
    } else {
      setErrorMsg(res.error || 'Failed to complete profile. Please try again.');
    }
  };

  const handleFinishLater = () => {
    // Cannot skip mandatory initial steps
    if (step < 3) {
      setErrorMsg('Please complete your basic profile and educational stage first so StudySync can personalize your learning features.');
      return;
    }
    // If on step 3+, save what has been provided and complete
    handleCompleteOnboarding();
  };

  const stepTitles = [
    'Basic Profile & Privacy',
    'Educational Background',
    'Learning Goals',
    'Study Preferences',
    'Review & Confirmation',
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      id="onboarding-page-root"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {/* Top Header & Session Controls */}
        <div className="row-between" style={{ alignItems: 'center' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-accent)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: 16,
              }}
            >
              S
            </div>
            <div>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                StudySync AI
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 6 }}>
                &bull; Learner Setup
              </span>
            </div>
          </div>

          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <button
              type="button"
              onClick={handleFinishLater}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              id="onboarding-finish-later-btn"
            >
              Finish Later
            </button>
            <span style={{ color: 'var(--color-border-subtle)' }}>|</span>
            <button
              type="button"
              onClick={logout}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
              id="onboarding-sign-out-btn"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Main Card */}
        <Card
          id="onboarding-card"
          style={{
            padding: 'clamp(16px, 4vw, 24px)',
            boxShadow: 'var(--shadow-lg, 0 10px 25px -5px rgba(0, 0, 0, 0.1))',
            borderRadius: 'var(--radius-xl, 16px)',
          }}
          className="stack"
        >
          {/* Progress Indicator */}
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <div className="row-between" style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                Step {step} of {totalSteps}: {stepTitles[step - 1]}
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {Math.round((step / totalSteps) * 100)}%
              </span>
            </div>
            <div
              style={{
                height: 6,
                backgroundColor: 'var(--color-bg-subtle)',
                borderRadius: 'var(--radius-full)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${(step / totalSteps) * 100}%`,
                  backgroundColor: 'var(--color-accent)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: 'var(--space-3)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-xs)',
              }}
              id="onboarding-error-alert"
            >
              {errorMsg}
            </div>
          )}

          {/* STEP 1: Basic Profile & Privacy */}
          {step === 1 && (
            <div className="stack" style={{ gap: 'var(--space-4)' }} id="onboarding-step-1">
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  Welcome to StudySync AI
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Let's personalize your collaborative learning space. Please tell us what to call you.
                </p>
              </div>

              {/* Privacy Shield Banner */}
              <div
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  gap: 'var(--space-3)',
                  alignItems: 'flex-start',
                }}
                id="onboarding-privacy-banner"
              >
                <span style={{ fontSize: 18 }}>🔒</span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                  <strong style={{ color: 'var(--color-text-primary)' }}>Private by Default:</strong> Age and gender are strictly confidential and never displayed on public cards, study room participant lists, or search results.
                </div>
              </div>

              <Input
                label="Full Name or Preferred Display Name"
                id="onboarding-name-input"
                required
                placeholder="e.g. Maya Chen or Alex"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (validationErrors.displayName) {
                    setValidationErrors((prev) => ({ ...prev, displayName: null }));
                  }
                }}
                helperText="How peers will address you in study sessions."
              />
              {validationErrors.displayName && (
                <span style={{ color: '#ef4444', fontSize: 'var(--text-xs)', marginTop: -8 }}>
                  {validationErrors.displayName}
                </span>
              )}

              <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <Input
                    label="Age"
                    id="onboarding-age-input"
                    type="number"
                    min="4"
                    max="120"
                    placeholder="e.g. 16 or 21"
                    value={age}
                    onChange={(e) => {
                      setAge(e.target.value);
                      if (validationErrors.age) {
                        setValidationErrors((prev) => ({ ...prev, age: null }));
                      }
                    }}
                    helperText="Enables age-appropriate safety safeguards (strictly private)."
                  />
                  {validationErrors.age && (
                    <span style={{ color: '#ef4444', fontSize: 'var(--text-xs)', marginTop: -8 }}>
                      {validationErrors.age}
                    </span>
                  )}
                </div>

                <div>
                  <Select
                    label="Gender (Optional)"
                    id="onboarding-gender-select"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    options={[
                      { value: 'Prefer not to say', label: 'Prefer not to say' },
                      { value: 'Woman', label: 'Woman' },
                      { value: 'Man', label: 'Man' },
                      { value: 'Non-binary', label: 'Non-binary' },
                      { value: 'Self-describe', label: 'Self-describe' },
                    ]}
                    helperText="Completely optional and confidential."
                  />
                </div>
              </div>

              {gender === 'Self-describe' && (
                <Input
                  label="Self-described Gender Identity"
                  id="onboarding-custom-gender-input"
                  placeholder="How do you describe your gender?"
                  value={customGender}
                  onChange={(e) => setCustomGender(e.target.value)}
                />
              )}
            </div>
          )}

          {/* STEP 2: Educational Background */}
          {step === 2 && (
            <div className="stack" style={{ gap: 'var(--space-4)' }} id="onboarding-step-2">
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  Educational Background
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  StudySync supports learners from kindergarten to postgraduate, vocational, and lifelong learning.
                </p>
              </div>

              <Select
                label="Current Educational Stage"
                id="onboarding-stage-select"
                required
                value={educationStage}
                onChange={(e) => {
                  setEducationStage(e.target.value);
                  setFieldOrMajor('');
                  setCurrentLevelOrYear('');
                }}
                options={EDUCATION_STAGES}
                helperText="Select the stage that best reflects your current study focus."
              />

              {/* Dynamic Stage-Specific Fields */}
              {['kindergarten', 'primary_school', 'middle_school', 'secondary_school'].includes(educationStage) && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <Input
                    label="School Name (Optional)"
                    id="onboarding-school-name"
                    placeholder="e.g. Hilltop Public School"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                  <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                    <Input
                      label="Grade / Class"
                      id="onboarding-school-grade"
                      placeholder="e.g. Grade 5, Class 8, Grade 10"
                      value={currentLevelOrYear}
                      onChange={(e) => setCurrentLevelOrYear(e.target.value)}
                    />
                    <Input
                      label="Educational Board (Optional)"
                      id="onboarding-school-board"
                      placeholder="e.g. CBSE, ICSE, State Board, IB"
                      value={boardOrStream}
                      onChange={(e) => setBoardOrStream(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {educationStage === 'higher_secondary' && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <Input
                    label="Institution / Junior College Name"
                    id="onboarding-hs-institution"
                    placeholder="e.g. St. Xavier's Junior College"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                  <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                    <Input
                      label="Grade / Year"
                      id="onboarding-hs-grade"
                      placeholder="e.g. Grade 11 or Grade 12"
                      value={currentLevelOrYear}
                      onChange={(e) => setCurrentLevelOrYear(e.target.value)}
                    />
                    <Input
                      label="Stream / Focus"
                      id="onboarding-hs-stream"
                      placeholder="e.g. Science (PCM), Commerce, Arts"
                      value={boardOrStream}
                      onChange={(e) => setBoardOrStream(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {educationStage === 'iti_vocational' && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <Input
                    label="Training Institute / Center"
                    id="onboarding-voc-institution"
                    placeholder="e.g. Government ITI Center"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                  <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                    <Input
                      label="Trade / Technical Program"
                      id="onboarding-voc-trade"
                      placeholder="e.g. Electrician, Welding, Fitter, Automotive"
                      value={fieldOrMajor}
                      onChange={(e) => setFieldOrMajor(e.target.value)}
                    />
                    <Input
                      label="Current Stage"
                      id="onboarding-voc-stage"
                      placeholder="e.g. Year 1, Final Year, Apprentice"
                      value={currentLevelOrYear}
                      onChange={(e) => setCurrentLevelOrYear(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {educationStage === 'polytechnic_diploma' && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <Input
                    label="Polytechnic Institution"
                    id="onboarding-poly-institution"
                    placeholder="e.g. State Polytechnic College"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                  <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                    <Input
                      label="Diploma Course / Branch"
                      id="onboarding-poly-branch"
                      placeholder="e.g. Electrical Engineering, Mechanical, Civil"
                      value={fieldOrMajor}
                      onChange={(e) => setFieldOrMajor(e.target.value)}
                    />
                    <Input
                      label="Current Year / Semester"
                      id="onboarding-poly-year"
                      placeholder="e.g. 2nd Year / 3rd Semester"
                      value={currentLevelOrYear}
                      onChange={(e) => setCurrentLevelOrYear(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {['undergraduate', 'postgraduate'].includes(educationStage) && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <Input
                    label="College / University Name"
                    id="onboarding-ug-institution"
                    placeholder="e.g. University of Madras or City College"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                  <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                    <Input
                      label="Degree & Major / Specialization"
                      id="onboarding-ug-major"
                      placeholder="e.g. B.A. Economics, B.Sc. Mathematics, B.Tech CSE"
                      value={fieldOrMajor}
                      onChange={(e) => setFieldOrMajor(e.target.value)}
                    />
                    <Input
                      label="Current Year / Semester"
                      id="onboarding-ug-year"
                      placeholder="e.g. Year 2, Semester 4, Final Year"
                      value={currentLevelOrYear}
                      onChange={(e) => setCurrentLevelOrYear(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {educationStage === 'doctoral' && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <Input
                    label="University / Research Institute"
                    id="onboarding-doc-institution"
                    placeholder="e.g. Indian Institute of Science"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                  <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                    <Input
                      label="Research Field / Topic"
                      id="onboarding-doc-field"
                      placeholder="e.g. Organic Chemistry, Macroeconomics, AI"
                      value={fieldOrMajor}
                      onChange={(e) => setFieldOrMajor(e.target.value)}
                    />
                    <Input
                      label="Research Stage"
                      id="onboarding-doc-stage"
                      placeholder="e.g. Coursework, Proposal, Thesis Writing"
                      value={currentLevelOrYear}
                      onChange={(e) => setCurrentLevelOrYear(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {['professional_continuing', 'independent_other'].includes(educationStage) && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <Input
                    label="Learning Goal or Educational Context"
                    id="onboarding-indep-focus"
                    placeholder="e.g. Self-taught web development, CFA exam, Data science"
                    value={fieldOrMajor}
                    onChange={(e) => setFieldOrMajor(e.target.value)}
                  />
                  <Input
                    label="Organization / Community (Optional)"
                    id="onboarding-indep-org"
                    placeholder="e.g. Freelance, Workplace, Online learning cohort"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Learning Goals */}
          {step === 3 && (
            <div className="stack" style={{ gap: 'var(--space-4)' }} id="onboarding-step-3">
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  What do you want to accomplish?
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Select your primary study objectives or enter your own custom goals.
                </p>
              </div>

              {validationErrors.goals && (
                <span style={{ color: '#ef4444', fontSize: 'var(--text-xs)' }}>
                  {validationErrors.goals}
                </span>
              )}

              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {PREDEFINED_GOALS.map((goal, idx) => {
                  const isSelected = selectedGoals.includes(goal);
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleGoal(goal)}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected
                          ? '1px solid var(--color-accent)'
                          : '1px solid var(--color-border-default)',
                        backgroundColor: isSelected
                          ? 'var(--color-accent-subtle, rgba(59, 130, 246, 0.08))'
                          : 'var(--color-bg-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                        {goal}
                      </span>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? 'none' : '1px solid var(--color-border-subtle)',
                          backgroundColor: isSelected ? 'var(--color-accent)' : 'transparent',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 'bold',
                        }}
                      >
                        {isSelected ? '✓' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddCustomGoal} className="row" style={{ gap: 'var(--space-2)' }}>
                <Input
                  label="Add Custom Goal"
                  id="onboarding-custom-goal-input"
                  placeholder="e.g. Master Class 10 Trigonometry before midterm"
                  value={customGoalText}
                  onChange={(e) => setCustomGoalText(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button
                  variant="outline"
                  type="submit"
                  size="md"
                  style={{ alignSelf: 'flex-end', height: 42 }}
                  disabled={!customGoalText.trim()}
                >
                  + Add
                </Button>
              </form>
            </div>
          )}

          {/* STEP 4: Optional Learning Preferences */}
          {step === 4 && (
            <div className="stack" style={{ gap: 'var(--space-4)' }} id="onboarding-step-4">
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  Study Preferences
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Customize your schedule, languages, and study pace. These can be adjusted anytime in Settings.
                </p>
              </div>

              {/* Language selection */}
              <div>
                <label className="form-label">Languages you can study in:</label>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {AVAILABLE_LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          fontSize: 'var(--text-xs)',
                          border: isSelected
                            ? '1px solid var(--color-accent)'
                            : '1px solid var(--color-border-default)',
                          backgroundColor: isSelected ? 'var(--color-accent)' : 'var(--color-bg-subtle)',
                          color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                          cursor: 'pointer',
                          fontWeight: isSelected ? 'bold' : 'normal',
                        }}
                      >
                        {isSelected ? `✓ ${lang}` : lang}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="dashboard-grid" style={{ gap: 'var(--space-3)', gridTemplateColumns: '1fr 1fr' }}>
                <Select
                  label="Preferred Study Hours"
                  id="onboarding-times-select"
                  value={preferredStudyTimes}
                  onChange={(e) => setPreferredStudyTimes(e.target.value)}
                  options={[
                    { value: 'Weekday evenings', label: 'Weekday evenings' },
                    { value: 'Weekday mornings', label: 'Weekday mornings' },
                    { value: 'Afternoons', label: 'Afternoons' },
                    { value: 'Late nights', label: 'Late nights' },
                    { value: 'Weekends', label: 'Weekends' },
                    { value: 'Flexible availability', label: 'Flexible / Varied' },
                  ]}
                />

                <Select
                  label="Preferred Focus Block Duration"
                  id="onboarding-duration-select"
                  value={String(preferredDuration)}
                  onChange={(e) => setPreferredDuration(Number(e.target.value))}
                  options={[
                    { value: '25', label: '25 minutes (Pomodoro)' },
                    { value: '30', label: '30 minutes (Quick review)' },
                    { value: '45', label: '45 minutes (Standard focus)' },
                    { value: '60', label: '60 minutes (Problem sprint)' },
                    { value: '90', label: '90 minutes (Deep study)' },
                  ]}
                />
              </div>

              <Select
                label="Collaboration Preference"
                id="onboarding-collab-select"
                value={collaborationStyle}
                onChange={(e) => setCollaborationStyle(e.target.value)}
                options={[
                  { value: 'Peer discussion & problem solving', label: 'Peer discussion & interactive problem solving' },
                  { value: 'Silent co-studying with focus accountability', label: 'Silent co-studying with focus accountability' },
                  { value: 'Concept exchange & peer teaching', label: 'Concept exchange & peer teaching' },
                  { value: 'Targeted doubt resolution', label: 'Targeted doubt resolution' },
                ]}
              />
            </div>
          )}

          {/* STEP 5: Review and Complete */}
          {step === 5 && (
            <div className="stack" style={{ gap: 'var(--space-4)' }} id="onboarding-step-5">
              <div>
                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                  Ready to Start Learning
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  Here is a summary of your learner profile and privacy safeguards.
                </p>
              </div>

              <div
                style={{
                  padding: 'var(--space-4)',
                  backgroundColor: 'var(--color-bg-subtle)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-border-subtle)',
                }}
                className="stack"
              >
                <div className="row-between">
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Learner Name:</span>
                  <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{displayName}</strong>
                </div>

                <div className="row-between">
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Age &amp; Gender:</span>
                  <div className="row" style={{ gap: 6 }}>
                    <Badge variant="neutral">{age ? `${age} yrs` : 'Not specified'}</Badge>
                    <Badge variant="neutral">{gender}</Badge>
                    <Badge variant="accent">Private 🔒</Badge>
                  </div>
                </div>

                <div className="row-between">
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Educational Stage:</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', textAlign: 'right' }}>
                    {EDUCATION_STAGES.find((s) => s.value === educationStage)?.label || educationStage}
                  </span>
                </div>

                {institutionName && (
                  <div className="row-between">
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Institution:</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{institutionName}</span>
                  </div>
                )}

                {buildHeadline() && (
                  <div className="row-between">
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Academic Headline:</span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', fontWeight: 600 }}>{buildHeadline()}</span>
                  </div>
                )}

                <div className="row-between">
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>Languages:</span>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{selectedLanguages.join(', ')}</span>
                </div>

                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-text-muted)', marginBottom: 6 }}>
                    Active Learning Goals ({selectedGoals.length}):
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    {selectedGoals.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div
            className="row-between"
            style={{
              borderTop: '1px solid var(--color-border-subtle)',
              paddingTop: 'var(--space-4)',
              marginTop: 'var(--space-2)',
              flexWrap: 'wrap',
              gap: 'var(--space-3)',
            }}
          >
            {step > 1 ? (
              <Button
                variant="outline"
                size="md"
                onClick={handleBack}
                id="onboarding-back-btn"
                disabled={isSaving}
              >
                &larr; Back
              </Button>
            ) : (
              <div />
            )}

            {step < totalSteps ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleNext}
                id="onboarding-continue-btn"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Continue \u2192'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleCompleteOnboarding}
                id="onboarding-complete-btn"
                disabled={isSaving}
                style={{ whiteSpace: 'normal', height: 'auto', minHeight: 42, padding: '10px 16px', textAlign: 'center' }}
              >
                {isSaving ? 'Completing Setup...' : 'Complete Setup & Enter StudySync \u2713'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Onboarding;
