/**
 * StudySync AI — Request Validation & Response Helpers
 * 
 * Provides lightweight schema validation for endpoints without heavy dependencies.
 */

export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegisterInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const { displayName, email, password, confirmPassword } = body;

  if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
    errors.push('Display name is required');
  } else if (displayName.trim().length < 2 || displayName.trim().length > 50) {
    errors.push('Display name must be between 2 and 50 characters');
  } else {
    sanitized.displayName = displayName.trim();
  }

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email is required');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Please enter a valid email address');
  } else if (email.trim().length > 100) {
    errors.push('Email address is too long');
  } else {
    sanitized.email = email.trim().toLowerCase();
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
  } else if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else if (password.length > 128) {
    errors.push('Password must be 128 characters or fewer');
  } else {
    sanitized.password = password;
  }

  if (!confirmPassword || typeof confirmPassword !== 'string') {
    errors.push('Please confirm your password');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (errors.length > 0) {
    throw new ValidationError('Registration validation failed', errors);
  }

  return sanitized;
}

export function validateLoginInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const { email, password } = body;

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email is required');
  } else {
    sanitized.email = email.trim().toLowerCase();
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required');
  } else {
    sanitized.password = password;
  }

  if (errors.length > 0) {
    throw new ValidationError('Sign-in validation failed', errors);
  }

  return sanitized;
}

export function validateProfileUpdate(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.displayName !== undefined) {
    if (typeof body.displayName !== 'string' || body.displayName.trim().length < 2) {
      errors.push('Display name must be at least 2 characters');
    } else {
      sanitized.displayName = body.displayName.trim();
    }
  }

  if (body.username !== undefined) {
    if (typeof body.username !== 'string') {
      errors.push('Username must be text');
    } else {
      const cleanUser = body.username.trim().replace(/^@/, '');
      if (cleanUser.length < 3 || cleanUser.length > 30) {
        errors.push('Username must be between 3 and 30 characters');
      } else if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
        errors.push('Username can only contain letters, numbers, and underscores');
      } else {
        sanitized.username = cleanUser.toLowerCase();
      }
    }
  }

  if (body.country !== undefined) {
    if (body.country === null || body.country === '') {
      sanitized.country = null;
    } else if (typeof body.country === 'string') {
      sanitized.country = body.country.trim().slice(0, 100);
    } else {
      errors.push('Country must be text');
    }
  }

  if (body.state !== undefined) {
    if (body.state === null || body.state === '') {
      sanitized.state = null;
    } else if (typeof body.state === 'string') {
      sanitized.state = body.state.trim().slice(0, 100);
    } else {
      errors.push('State must be text');
    }
  }

  if (body.city !== undefined) {
    if (body.city === null || body.city === '') {
      sanitized.city = null;
    } else if (typeof body.city === 'string') {
      sanitized.city = body.city.trim().slice(0, 100);
    } else {
      errors.push('City must be text');
    }
  }

  if (body.headline !== undefined) {
    if (typeof body.headline !== 'string') {
      errors.push('Headline must be text');
    } else {
      sanitized.headline = body.headline.trim();
    }
  }

  if (body.institution !== undefined) {
    if (typeof body.institution !== 'string') {
      errors.push('Institution must be text');
    } else {
      sanitized.institution = body.institution.trim();
    }
  }

  if (body.introduction !== undefined) {
    if (typeof body.introduction !== 'string') {
      errors.push('Introduction must be text');
    } else if (body.introduction.length > 1000) {
      errors.push('Introduction cannot exceed 1000 characters');
    } else {
      sanitized.introduction = body.introduction.trim();
    }
  }

  const rawSkillLevel = body.skillLevel !== undefined ? body.skillLevel : body.skill_level;
  if (rawSkillLevel !== undefined) {
    const validLevels = ['beginner', 'intermediate', 'advanced'];
    if (typeof rawSkillLevel !== 'string' || !validLevels.includes(rawSkillLevel.toLowerCase().trim())) {
      errors.push('Skill level must be one of: Beginner, Intermediate, Advanced');
    } else {
      sanitized.skillLevel = rawSkillLevel.trim();
    }
  }

  const rawPreferredLanguages = body.preferredLanguages !== undefined ? body.preferredLanguages : body.preferred_languages;
  if (rawPreferredLanguages !== undefined) {
    if (typeof rawPreferredLanguages === 'string') {
      const split = rawPreferredLanguages
        .split(',')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      sanitized.preferredLanguages = split;
    } else if (!Array.isArray(rawPreferredLanguages)) {
      errors.push('Preferred languages must be an array of strings or a comma-separated string');
    } else {
      const hasInvalid = rawPreferredLanguages.some((l) => typeof l !== 'string' || l.trim().length === 0);
      if (hasInvalid) {
        errors.push('Each preferred language must be a non-empty string');
      } else {
        const seen = new Set();
        const cleaned = [];
        for (const l of rawPreferredLanguages) {
          const trimmed = l.trim();
          const lower = trimmed.toLowerCase();
          if (!seen.has(lower)) {
            seen.add(lower);
            cleaned.push(trimmed);
          }
        }
        sanitized.preferredLanguages = cleaned;
      }
    }
  }

  const rawStudyTimes = body.preferredStudyTimes !== undefined ? body.preferredStudyTimes : body.preferred_study_times;
  if (rawStudyTimes !== undefined) {
    if (typeof rawStudyTimes !== 'string') {
      errors.push('Preferred study times must be text');
    } else {
      sanitized.preferredStudyTimes = rawStudyTimes.trim();
    }
  }

  const rawDuration = body.preferredStudyDuration !== undefined ? body.preferredStudyDuration : body.preferred_study_duration;
  if (rawDuration !== undefined) {
    const dur = parseInt(rawDuration, 10);
    if (!Number.isInteger(dur) || dur < 10 || dur > 360) {
      errors.push('Preferred study duration must be between 10 and 360 minutes');
    } else {
      sanitized.preferredStudyDuration = dur;
    }
  }

  if (body.subjects !== undefined) {
    if (!Array.isArray(body.subjects)) {
      errors.push('Subjects must be an array of subject names');
    } else {
      sanitized.subjects = body.subjects
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim());
    }
  }

  if (body.age !== undefined) {
    if (body.age === null || body.age === '') {
      sanitized.age = null;
    } else {
      const parsedAge = parseInt(body.age, 10);
      if (!Number.isInteger(parsedAge) || parsedAge < 4 || parsedAge > 120) {
        errors.push('Age must be an integer between 4 and 120 years');
      } else {
        sanitized.age = parsedAge;
      }
    }
  }

  if (body.gender !== undefined) {
    if (body.gender === null || body.gender === '') {
      sanitized.gender = 'Prefer not to say';
    } else if (typeof body.gender === 'string') {
      sanitized.gender = body.gender.trim();
    } else {
      errors.push('Gender must be text');
    }
  }

  const rawEducationStage = body.educationStage !== undefined ? body.educationStage : body.education_stage;
  if (rawEducationStage !== undefined) {
    if (typeof rawEducationStage === 'string') {
      sanitized.educationStage = rawEducationStage.trim();
    } else if (rawEducationStage === null) {
      sanitized.educationStage = null;
    }
  }

  const rawEducationDetails = body.educationDetails !== undefined ? body.educationDetails : body.education_details;
  if (rawEducationDetails !== undefined) {
    if (typeof rawEducationDetails === 'object' && rawEducationDetails !== null) {
      sanitized.educationDetails = rawEducationDetails;
    } else if (typeof rawEducationDetails === 'string') {
      try {
        sanitized.educationDetails = JSON.parse(rawEducationDetails);
      } catch {
        sanitized.educationDetails = { notes: rawEducationDetails };
      }
    } else if (rawEducationDetails === null) {
      sanitized.educationDetails = null;
    }
  }

  const rawLearningGoals = body.learningGoals !== undefined ? body.learningGoals : body.learning_goals;
  if (rawLearningGoals !== undefined) {
    if (Array.isArray(rawLearningGoals)) {
      sanitized.learningGoals = rawLearningGoals
        .filter((g) => typeof g === 'string' && g.trim().length > 0)
        .map((g) => g.trim());
    } else if (typeof rawLearningGoals === 'string' && rawLearningGoals.trim().length > 0) {
      sanitized.learningGoals = [rawLearningGoals.trim()];
    }
  }

  const rawCompleted = body.isProfileCompleted !== undefined ? body.isProfileCompleted : body.is_profile_completed;
  if (rawCompleted !== undefined) {
    sanitized.isProfileCompleted = Boolean(rawCompleted);
  }

  if (errors.length > 0) {
    throw new ValidationError('Profile update validation failed', errors);
  }

  return sanitized;
}

export function validatePreferencesUpdate(body = {}) {
  const errors = [];
  const sanitized = {};

  if (!body.preferences || !Array.isArray(body.preferences)) {
    errors.push('Preferences array is required');
  } else {
    sanitized.preferences = body.preferences.map((item, index) => {
      if (!item.topic_id || typeof item.topic_id !== 'string') {
        errors.push(`Preference at index ${index} must include a valid topic_id`);
      }
      return {
        topic_id: item.topic_id ? item.topic_id.trim() : '',
        learning_goal: typeof item.learning_goal === 'string' ? item.learning_goal.trim() : '',
        skill_level: typeof item.skill_level === 'string' ? item.skill_level.trim() : 'Intermediate',
        preferred_study_duration: Number.isInteger(item.preferred_study_duration) ? item.preferred_study_duration : 45,
        is_learning_now: Boolean(item.is_learning_now),
        is_strength: Boolean(item.is_strength),
        is_improving: Boolean(item.is_improving),
      };
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Preferences update validation failed', errors);
  }

  return sanitized;
}

export function validateTopicQuery(query) {
  const errors = [];
  const sanitized = {};

  if (query.subject !== undefined) {
    if (typeof query.subject !== 'string' || query.subject.trim().length === 0) {
      errors.push('Query parameter "subject" must be a non-empty string');
    } else if (query.subject.length > 100) {
      errors.push('Query parameter "subject" must be 100 characters or fewer');
    } else {
      sanitized.subject = query.subject.trim();
    }
  }

  if (query.difficulty !== undefined) {
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (typeof query.difficulty !== 'string' || !validDifficulties.includes(query.difficulty.toLowerCase().trim())) {
      errors.push('Query parameter "difficulty" must be one of: Beginner, Intermediate, Advanced');
    } else {
      sanitized.difficulty = query.difficulty.trim();
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid topic query parameters', errors);
  }

  return sanitized;
}

export function validateRoomQuery(query = {}) {
  const errors = [];
  const sanitized = {};

  if (query.q !== undefined || query.search !== undefined) {
    const rawSearch = query.q !== undefined ? query.q : query.search;
    if (typeof rawSearch !== 'string') {
      errors.push('Search parameter must be text');
    } else {
      sanitized.search = rawSearch.trim();
    }
  }

  if (query.subject !== undefined) {
    if (typeof query.subject !== 'string' || query.subject.trim().length === 0) {
      errors.push('Query parameter "subject" must be a non-empty string');
    } else {
      sanitized.subject = query.subject.trim();
    }
  }

  if (query.topic !== undefined) {
    if (typeof query.topic !== 'string' || query.topic.trim().length === 0) {
      errors.push('Query parameter "topic" must be a non-empty string');
    } else {
      sanitized.topic = query.topic.trim();
    }
  }

  if (query.difficulty !== undefined) {
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (typeof query.difficulty !== 'string' || !validDifficulties.includes(query.difficulty.toLowerCase().trim())) {
      errors.push('Query parameter "difficulty" must be one of: Beginner, Intermediate, Advanced');
    } else {
      sanitized.difficulty = query.difficulty.trim();
    }
  }

  if (query.room_type !== undefined) {
    if (typeof query.room_type !== 'string' || query.room_type.trim().length === 0) {
      errors.push('Query parameter "room_type" must be a non-empty string');
    } else {
      sanitized.room_type = query.room_type.trim();
    }
  }

  if (query.language !== undefined) {
    if (typeof query.language !== 'string' || query.language.trim().length === 0) {
      errors.push('Query parameter "language" must be a non-empty string');
    } else {
      sanitized.language = query.language.trim();
    }
  }

  if (query.status !== undefined) {
    const validStatuses = ['active', 'archived', 'all'];
    if (typeof query.status !== 'string' || !validStatuses.includes(query.status.toLowerCase().trim())) {
      errors.push('Query parameter "status" must be one of: active, archived, all');
    } else {
      sanitized.status = query.status.toLowerCase().trim();
    }
  }

  if (query.page !== undefined) {
    const p = parseInt(query.page, 10);
    if (!Number.isInteger(p) || p < 1) {
      errors.push('Query parameter "page" must be a positive integer');
    } else {
      sanitized.page = p;
    }
  } else {
    sanitized.page = 1;
  }

  if (query.limit !== undefined) {
    const l = parseInt(query.limit, 10);
    if (!Number.isInteger(l) || l < 1 || l > 100) {
      errors.push('Query parameter "limit" must be an integer between 1 and 100');
    } else {
      sanitized.limit = l;
    }
  } else {
    sanitized.limit = 50;
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid room query parameters', errors);
  }

  return sanitized;
}

export function validateCreateRoomInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const rawName = body.room_name || body.roomName || body.name || body.title;
  if (!rawName || typeof rawName !== 'string' || rawName.trim().length === 0) {
    errors.push('Room name is required');
  } else if (rawName.trim().length < 3 || rawName.trim().length > 100) {
    errors.push('Room name must be between 3 and 100 characters');
  } else {
    sanitized.room_name = rawName.trim();
  }

  if (!body.subject || typeof body.subject !== 'string' || body.subject.trim().length === 0) {
    errors.push('Subject is required');
  } else if (body.subject.trim().length < 2 || body.subject.trim().length > 100) {
    errors.push('Subject must be between 2 and 100 characters');
  } else {
    sanitized.subject = body.subject.trim();
  }

  if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length === 0) {
    errors.push('Topic is required');
  } else if (body.topic.trim().length < 2 || body.topic.trim().length > 100) {
    errors.push('Topic must be between 2 and 100 characters');
  } else {
    sanitized.topic = body.topic.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('Description must be text');
    } else if (body.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    } else {
      sanitized.description = body.description.trim();
    }
  } else {
    sanitized.description = '';
  }

  const rawRoomType = body.room_type || body.roomType;
  const validRoomTypes = [
    'Learn Together',
    'Revision',
    'Doubt Solving',
    'Peer Teaching',
    'Exam Revision',
  ];
  if (rawRoomType !== undefined) {
    const matchedType = validRoomTypes.find(
      (t) => t.toLowerCase() === String(rawRoomType).toLowerCase().trim()
    );
    if (!matchedType) {
      errors.push(`Room type must be one of: ${validRoomTypes.join(', ')}`);
    } else {
      sanitized.room_type = matchedType;
    }
  } else {
    sanitized.room_type = 'Learn Together';
  }

  if (body.difficulty !== undefined) {
    const validDifficulties = ['Beginner', 'Intermediate', 'Advanced'];
    const matchedDiff = validDifficulties.find(
      (d) => d.toLowerCase() === String(body.difficulty).toLowerCase().trim()
    );
    if (!matchedDiff) {
      errors.push('Difficulty must be one of: Beginner, Intermediate, Advanced');
    } else {
      sanitized.difficulty = matchedDiff;
    }
  } else {
    sanitized.difficulty = 'Intermediate';
  }

  const rawLanguages = body.preferred_languages || body.languages || body.language;
  if (rawLanguages !== undefined) {
    if (Array.isArray(rawLanguages)) {
      const cleaned = rawLanguages
        .filter((l) => typeof l === 'string' && l.trim().length > 0)
        .map((l) => l.trim());
      sanitized.preferred_languages = cleaned.length > 0 ? cleaned : ['English'];
    } else if (typeof rawLanguages === 'string' && rawLanguages.trim().length > 0) {
      sanitized.preferred_languages = [rawLanguages.trim()];
    } else {
      sanitized.preferred_languages = ['English'];
    }
  } else {
    sanitized.preferred_languages = ['English'];
  }

  const rawCapacity = body.max_capacity !== undefined ? body.max_capacity : body.maxParticipants;
  if (rawCapacity !== undefined) {
    const cap = parseInt(rawCapacity, 10);
    if (!Number.isInteger(cap) || cap < 2 || cap > 50) {
      errors.push('Max capacity must be an integer between 2 and 50');
    } else {
      sanitized.max_capacity = cap;
    }
  } else {
    sanitized.max_capacity = 8;
  }

  if (body.status !== undefined) {
    const validStatuses = ['active', 'private', 'archived'];
    if (typeof body.status === 'string' && validStatuses.includes(body.status.toLowerCase().trim())) {
      sanitized.status = body.status.toLowerCase().trim();
    }
  }

  const rawEducationStage = body.education_stage || body.educationStage;
  if (rawEducationStage !== undefined && typeof rawEducationStage === 'string' && rawEducationStage.trim().length > 0) {
    sanitized.education_stage = rawEducationStage.trim();
  }

  if (errors.length > 0) {
    throw new ValidationError('Create room validation failed', errors);
  }

  return sanitized;
}

export function validateUpdateRoomInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const rawName = body.room_name || body.name || body.title;
  if (rawName !== undefined) {
    if (typeof rawName !== 'string' || rawName.trim().length < 3 || rawName.trim().length > 100) {
      errors.push('Room name must be between 3 and 100 characters');
    } else {
      sanitized.room_name = rawName.trim();
    }
  }

  if (body.subject !== undefined) {
    if (typeof body.subject !== 'string' || body.subject.trim().length < 2 || body.subject.trim().length > 100) {
      errors.push('Subject must be between 2 and 100 characters');
    } else {
      sanitized.subject = body.subject.trim();
    }
  }

  if (body.topic !== undefined) {
    if (typeof body.topic !== 'string' || body.topic.trim().length < 2 || body.topic.trim().length > 100) {
      errors.push('Topic must be between 2 and 100 characters');
    } else {
      sanitized.topic = body.topic.trim();
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('Description must be text');
    } else if (body.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    } else {
      sanitized.description = body.description.trim();
    }
  }

  const rawRoomType = body.room_type || body.roomType;
  if (rawRoomType !== undefined) {
    const validRoomTypes = [
      'Learn Together',
      'Revision',
      'Doubt Solving',
      'Peer Teaching',
      'Exam Revision',
    ];
    const matchedType = validRoomTypes.find(
      (t) => t.toLowerCase() === String(rawRoomType).toLowerCase().trim()
    );
    if (!matchedType) {
      errors.push(`Room type must be one of: ${validRoomTypes.join(', ')}`);
    } else {
      sanitized.room_type = matchedType;
    }
  }

  if (body.difficulty !== undefined) {
    const validDifficulties = ['Beginner', 'Intermediate', 'Advanced'];
    const matchedDiff = validDifficulties.find(
      (d) => d.toLowerCase() === String(body.difficulty).toLowerCase().trim()
    );
    if (!matchedDiff) {
      errors.push('Difficulty must be one of: Beginner, Intermediate, Advanced');
    } else {
      sanitized.difficulty = matchedDiff;
    }
  }

  const rawLanguages = body.preferred_languages || body.languages || body.language;
  if (rawLanguages !== undefined) {
    if (Array.isArray(rawLanguages)) {
      const cleaned = rawLanguages
        .filter((l) => typeof l === 'string' && l.trim().length > 0)
        .map((l) => l.trim());
      sanitized.preferred_languages = cleaned;
    } else if (typeof rawLanguages === 'string' && rawLanguages.trim().length > 0) {
      sanitized.preferred_languages = [rawLanguages.trim()];
    }
  }

  const rawCapacity = body.max_capacity !== undefined ? body.max_capacity : body.maxParticipants;
  if (rawCapacity !== undefined) {
    const cap = parseInt(rawCapacity, 10);
    if (!Number.isInteger(cap) || cap < 2 || cap > 50) {
      errors.push('Max capacity must be an integer between 2 and 50');
    } else {
      sanitized.max_capacity = cap;
    }
  }

  if (body.status !== undefined) {
    const validStatuses = ['active', 'archived'];
    if (typeof body.status !== 'string' || !validStatuses.includes(body.status.toLowerCase().trim())) {
      errors.push('Status must be either "active" or "archived"');
    } else {
      sanitized.status = body.status.toLowerCase().trim();
    }
  }

  if (Object.keys(sanitized).length === 0) {
    errors.push('At least one room property must be specified to update');
  }

  if (errors.length > 0) {
    throw new ValidationError('Update room validation failed', errors);
  }

  return sanitized;
}

export function validateSessionQuery(query = {}) {
  const errors = [];
  const filters = {};

  if (query.roomId || query.room_id) {
    filters.roomId = String(query.roomId || query.room_id).trim();
  }

  if (query.status) {
    const raw = String(query.status).toLowerCase().trim();
    const valid = ['scheduled', 'upcoming', 'active', 'completed', 'cancelled'];
    if (!valid.includes(raw)) {
      errors.push(`Status must be one of: ${valid.join(', ')}`);
    } else {
      filters.status = raw === 'upcoming' ? 'scheduled' : raw;
    }
  }

  if (query.topic) {
    filters.topic = String(query.topic).trim();
  }

  if (query.search || query.q) {
    filters.search = String(query.search || query.q).trim();
  }

  const page = query.page !== undefined ? parseInt(query.page, 10) : 1;
  if (isNaN(page) || page < 1) {
    errors.push('Page must be a positive integer');
  } else {
    filters.page = page;
  }

  const limit = query.limit !== undefined ? parseInt(query.limit, 10) : 20;
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push('Limit must be an integer between 1 and 100');
  } else {
    filters.limit = limit;
  }

  if (errors.length > 0) {
    throw new ValidationError('Invalid session query parameters', errors);
  }

  return filters;
}

export function validateCreateSessionInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const topic = body.topic || body.topic_name;
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    errors.push('Session topic is required');
  } else if (topic.trim().length < 2 || topic.trim().length > 100) {
    errors.push('Topic must be between 2 and 100 characters');
  } else {
    sanitized.topic = topic.trim();
  }

  if (body.subject && typeof body.subject === 'string') {
    sanitized.subject = body.subject.trim();
  } else {
    sanitized.subject = 'General Computer Science';
  }

  if (body.roomId || body.room_id) {
    sanitized.room_id = String(body.roomId || body.room_id).trim();
  } else {
    sanitized.room_id = null;
  }

  if (body.title && typeof body.title === 'string') {
    sanitized.title = body.title.trim();
  } else {
    sanitized.title = `${sanitized.topic} Study Block`;
  }

  if (body.description && typeof body.description === 'string') {
    sanitized.description = body.description.trim();
  } else {
    sanitized.description = '';
  }

  const rawDuration = body.plannedDuration !== undefined ? body.plannedDuration : (body.planned_duration !== undefined ? body.planned_duration : 45);
  const duration = parseInt(rawDuration, 10);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
    errors.push('Planned duration must be an integer between 5 and 480 minutes');
  } else {
    sanitized.planned_duration = duration;
  }

  const startNow = body.startNow === true || body.start_now === true || body.status === 'active';
  sanitized.status = startNow ? 'active' : (body.status ? String(body.status).toLowerCase().trim() : 'scheduled');
  if (sanitized.status === 'upcoming') sanitized.status = 'scheduled';

  const validStatuses = ['scheduled', 'active'];
  if (!validStatuses.includes(sanitized.status)) {
    errors.push('Initial session status must be "scheduled" or "active"');
  }

  if (body.scheduledStartAt || body.scheduled_start_at) {
    sanitized.scheduled_start_at = new Date(body.scheduledStartAt || body.scheduled_start_at).toISOString();
  } else {
    sanitized.scheduled_start_at = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Create study session validation failed', errors);
  }

  return sanitized;
}

export function validateSessionFeedbackInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.rating !== undefined) {
    if (typeof body.rating !== 'string' || body.rating.trim().length === 0) {
      errors.push('Rating must be a valid text string');
    } else {
      sanitized.rating = body.rating.trim();
    }
  }

  if (body.reflection !== undefined) {
    if (typeof body.reflection !== 'string') {
      errors.push('Reflection must be a text string');
    } else if (body.reflection.length > 2000) {
      errors.push('Reflection cannot exceed 2000 characters');
    } else {
      sanitized.reflection = body.reflection.trim();
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Session feedback validation failed', errors);
  }

  return sanitized;
}

export function validateRecordFocusInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const rawMins = body.focusMinutes !== undefined ? body.focusMinutes : body.recorded_study_minutes;
  if (rawMins !== undefined) {
    const mins = parseInt(rawMins, 10);
    if (!Number.isInteger(mins) || mins < 0 || mins > 1440) {
      errors.push('Focus minutes must be a positive integer up to 1440');
    } else {
      sanitized.recorded_study_minutes = mins;
    }
  }

  if (body.status !== undefined) {
    if (typeof body.status !== 'string') {
      errors.push('Status must be a string');
    } else {
      sanitized.status = body.status.trim();
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Focus record validation failed', errors);
  }

  return sanitized;
}

const VALID_VISIBILITIES = ['private', 'room_shared', 'session_shared', 'public'];

function isValidHttpUrl(string) {
  if (!string || typeof string !== 'string') return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateCreateNoteInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    errors.push('Note title is required');
  } else if (body.title.trim().length < 2 || body.title.trim().length > 150) {
    errors.push('Note title must be between 2 and 150 characters');
  } else {
    sanitized.title = body.title.trim();
  }

  if (body.content !== undefined) {
    if (typeof body.content !== 'string') {
      errors.push('Note content must be a text string');
    } else if (body.content.length > 25000) {
      errors.push('Note content cannot exceed 25,000 characters');
    } else {
      sanitized.content = body.content;
    }
  } else {
    sanitized.content = '';
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('Note description must be a string');
    } else if (body.description.length > 2000) {
      errors.push('Note description cannot exceed 2,000 characters');
    } else {
      sanitized.description = body.description.trim();
    }
  } else if (sanitized.content) {
    sanitized.description = sanitized.content.slice(0, 160).replace(/[#*`]/g, '').trim();
  } else {
    sanitized.description = '';
  }

  if (!body.subject || typeof body.subject !== 'string' || body.subject.trim().length === 0) {
    errors.push('Subject is required');
  } else {
    sanitized.subject = body.subject.trim();
  }

  if (!body.topic || typeof body.topic !== 'string' || body.topic.trim().length === 0) {
    errors.push('Topic is required');
  } else {
    sanitized.topic = body.topic.trim();
  }

  const rawType = body.type || body.resource_type;
  if (rawType && typeof rawType === 'string') {
    sanitized.resource_type = rawType.trim();
  } else {
    sanitized.resource_type = 'Note';
  }

  if (body.visibility !== undefined) {
    if (!VALID_VISIBILITIES.includes(body.visibility)) {
      errors.push(`Visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`);
    } else {
      sanitized.visibility = body.visibility;
    }
  } else {
    sanitized.visibility = 'public';
  }

  const rawRoom = body.room_id || body.relatedRoomId || body.roomId;
  if (rawRoom && typeof rawRoom === 'string' && rawRoom.trim().length > 0) {
    sanitized.room_id = rawRoom.trim();
  } else {
    sanitized.room_id = null;
  }

  const rawSession = body.session_id || body.relatedSessionId || body.sessionId;
  if (rawSession && typeof rawSession === 'string' && rawSession.trim().length > 0) {
    sanitized.session_id = rawSession.trim();
  } else {
    sanitized.session_id = null;
  }

  const rawRef = body.resource_reference || body.url;
  if (rawRef && typeof rawRef === 'string' && rawRef.trim().length > 0) {
    const trimmed = rawRef.trim();
    if (!isValidHttpUrl(trimmed) && !trimmed.startsWith('/')) {
      errors.push('Resource reference must be a valid http/https URL or local path');
    } else {
      sanitized.resource_reference = trimmed;
    }
  } else {
    sanitized.resource_reference = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Note validation failed', errors);
  }

  return sanitized;
}

export function validateUpdateNoteInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      errors.push('Note title cannot be empty');
    } else if (body.title.trim().length < 2 || body.title.trim().length > 150) {
      errors.push('Note title must be between 2 and 150 characters');
    } else {
      sanitized.title = body.title.trim();
    }
  }

  if (body.content !== undefined) {
    if (typeof body.content !== 'string') {
      errors.push('Note content must be a text string');
    } else if (body.content.length > 25000) {
      errors.push('Note content cannot exceed 25,000 characters');
    } else {
      sanitized.content = body.content;
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('Note description must be a string');
    } else if (body.description.length > 2000) {
      errors.push('Note description cannot exceed 2,000 characters');
    } else {
      sanitized.description = body.description.trim();
    }
  }

  if (body.subject !== undefined) {
    if (typeof body.subject !== 'string' || body.subject.trim().length === 0) {
      errors.push('Subject cannot be empty');
    } else {
      sanitized.subject = body.subject.trim();
    }
  }

  if (body.topic !== undefined) {
    if (typeof body.topic !== 'string' || body.topic.trim().length === 0) {
      errors.push('Topic cannot be empty');
    } else {
      sanitized.topic = body.topic.trim();
    }
  }

  const rawType = body.type || body.resource_type;
  if (rawType !== undefined) {
    if (typeof rawType !== 'string' || rawType.trim().length === 0) {
      errors.push('Resource type cannot be empty');
    } else {
      sanitized.resource_type = rawType.trim();
    }
  }

  if (body.visibility !== undefined) {
    if (!VALID_VISIBILITIES.includes(body.visibility)) {
      errors.push(`Visibility must be one of: ${VALID_VISIBILITIES.join(', ')}`);
    } else {
      sanitized.visibility = body.visibility;
    }
  }

  const rawRoom = body.room_id !== undefined ? body.room_id : (body.relatedRoomId !== undefined ? body.relatedRoomId : body.roomId);
  if (rawRoom !== undefined) {
    sanitized.room_id = rawRoom ? String(rawRoom).trim() : null;
  }

  const rawSession = body.session_id !== undefined ? body.session_id : (body.relatedSessionId !== undefined ? body.relatedSessionId : body.sessionId);
  if (rawSession !== undefined) {
    sanitized.session_id = rawSession ? String(rawSession).trim() : null;
  }

  const rawRef = body.resource_reference !== undefined ? body.resource_reference : body.url;
  if (rawRef !== undefined) {
    if (rawRef && typeof rawRef === 'string' && rawRef.trim().length > 0) {
      const trimmed = rawRef.trim();
      if (!isValidHttpUrl(trimmed) && !trimmed.startsWith('/')) {
        errors.push('Resource reference must be a valid http/https URL');
      } else {
        sanitized.resource_reference = trimmed;
      }
    } else {
      sanitized.resource_reference = null;
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Note update validation failed', errors);
  }

  return sanitized;
}

export function validateNoteQuery(query = {}) {
  const sanitized = {};

  if (query.search && typeof query.search === 'string') {
    sanitized.search = query.search.trim().slice(0, 100);
  }
  if (query.subject && typeof query.subject === 'string' && query.subject !== 'all') {
    sanitized.subject = query.subject.trim();
  }
  if (query.topic && typeof query.topic === 'string' && query.topic !== 'all') {
    sanitized.topic = query.topic.trim();
  }
  if (query.type && typeof query.type === 'string' && query.type !== 'all') {
    sanitized.type = query.type.trim();
  }
  const rawRoom = query.room_id || query.roomId;
  if (rawRoom && typeof rawRoom === 'string') {
    sanitized.roomId = rawRoom.trim();
  }
  const rawSession = query.session_id || query.sessionId;
  if (rawSession && typeof rawSession === 'string') {
    sanitized.sessionId = rawSession.trim();
  }
  if (query.visibility && typeof query.visibility === 'string') {
    sanitized.visibility = query.visibility.trim();
  }
  if (query.authorId && typeof query.authorId === 'string') {
    sanitized.authorId = query.authorId.trim();
  }

  const page = parseInt(query.page, 10);
  sanitized.page = Number.isInteger(page) && page > 0 ? page : 1;

  const limit = parseInt(query.limit, 10);
  sanitized.limit = Number.isInteger(limit) && limit > 0 && limit <= 100 ? limit : 50;

  return sanitized;
}

export function validateCreateResourceInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
    errors.push('Resource title is required');
  } else if (body.title.trim().length < 2 || body.title.trim().length > 150) {
    errors.push('Resource title must be between 2 and 150 characters');
  } else {
    sanitized.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string') {
      errors.push('Description must be a text string');
    } else if (body.description.length > 2000) {
      errors.push('Description cannot exceed 2000 characters');
    } else {
      sanitized.description = body.description.trim();
    }
  } else {
    sanitized.description = '';
  }

  const rawUrl = body.url || body.resource_reference;
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim().length > 0) {
    const trimmed = rawUrl.trim();
    if (!isValidHttpUrl(trimmed) && !trimmed.startsWith('/')) {
      errors.push('URL must be a valid http or https address');
    } else {
      sanitized.resource_reference = trimmed;
    }
  } else {
    sanitized.resource_reference = null;
  }

  const rawType = body.type || body.resource_type;
  if (rawType && typeof rawType === 'string' && rawType.trim().length > 0) {
    sanitized.resource_type = rawType.trim();
  } else {
    sanitized.resource_type = 'Resource';
  }

  if (body.topic && typeof body.topic === 'string') {
    sanitized.topic = body.topic.trim();
  } else {
    sanitized.topic = '';
  }

  if (body.subject && typeof body.subject === 'string') {
    sanitized.subject = body.subject.trim();
  } else {
    sanitized.subject = '';
  }

  if (errors.length > 0) {
    throw new ValidationError('Resource validation failed', errors);
  }

  return sanitized;
}

export function validateCreateQuestionInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const rawContent = body.question_content || body.question;
  if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    errors.push('Question content is required');
  } else if (rawContent.trim().length < 3) {
    errors.push('Question must be at least 3 characters long');
  } else if (rawContent.trim().length > 2000) {
    errors.push('Question cannot exceed 2000 characters');
  } else {
    sanitized.question_content = rawContent.trim();
  }

  if (body.topic && typeof body.topic === 'string') {
    sanitized.topic = body.topic.trim().slice(0, 100);
  } else {
    sanitized.topic = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Question validation failed', errors);
  }

  return sanitized;
}

export function validateCreateReplyInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const rawText = body.response_content || body.text || body.content;
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    errors.push('Reply text is required');
  } else if (rawText.trim().length < 2) {
    errors.push('Reply must be at least 2 characters long');
  } else if (rawText.trim().length > 2000) {
    errors.push('Reply cannot exceed 2000 characters');
  } else {
    sanitized.response_content = rawText.trim();
  }

  if (errors.length > 0) {
    throw new ValidationError('Reply validation failed', errors);
  }

  return sanitized;
}

export function validateMatchCriteriaInput(query = {}) {
  const sanitized = {};

  if (query.q && typeof query.q === 'string') {
    sanitized.q = query.q.trim().slice(0, 150);
  }

  if (query.subject && typeof query.subject === 'string') {
    sanitized.subject = query.subject.trim().slice(0, 100);
  }

  if (query.topic && typeof query.topic === 'string') {
    sanitized.topic = query.topic.trim().slice(0, 120);
  }

  if (query.educationStage && typeof query.educationStage === 'string') {
    sanitized.educationStage = query.educationStage.trim().slice(0, 100);
  }

  if (query.fieldOfStudy && typeof query.fieldOfStudy === 'string') {
    sanitized.fieldOfStudy = query.fieldOfStudy.trim().slice(0, 100);
  } else if (query.major && typeof query.major === 'string') {
    sanitized.fieldOfStudy = query.major.trim().slice(0, 100);
  }

  if (query.institution && typeof query.institution === 'string') {
    sanitized.institution = query.institution.trim().slice(0, 100);
  }

  if (query.country && typeof query.country === 'string') {
    sanitized.country = query.country.trim().slice(0, 100);
  }

  if (query.state && typeof query.state === 'string') {
    sanitized.state = query.state.trim().slice(0, 100);
  }

  if (query.city && typeof query.city === 'string') {
    sanitized.city = query.city.trim().slice(0, 100);
  }

  if (query.sort && typeof query.sort === 'string') {
    const rawSort = query.sort.trim().toLowerCase();
    if (['best_match', 'recently_active', 'name_asc'].includes(rawSort)) {
      sanitized.sort = rawSort;
    }
  }

  if (query.page !== undefined) {
    const parsedPage = parseInt(query.page, 10);
    if (!Number.isNaN(parsedPage) && parsedPage > 0) {
      sanitized.page = parsedPage;
    }
  }

  if (query.skillLevel && typeof query.skillLevel === 'string') {
    sanitized.skillLevel = query.skillLevel.trim();
  }

  if (query.learningGoal && typeof query.learningGoal === 'string') {
    sanitized.learningGoal = query.learningGoal.trim().slice(0, 150);
  }

  // Phase 13: Current Session Intent & Desired Outcome
  if (query.intent && typeof query.intent === 'string') {
    const rawIntent = query.intent.trim().toLowerCase();
    const validIntents = [
      'learn_together',
      'find_explainer',
      'help_others',
      'exam_revision',
      'solve_doubt',
      'practice_explaining',
      // Aliases
      'need_help',
      'can_explain',
    ];
    if (validIntents.includes(rawIntent)) {
      if (rawIntent === 'need_help') sanitized.intent = 'find_explainer';
      else if (rawIntent === 'can_explain') sanitized.intent = 'help_others';
      else sanitized.intent = rawIntent;
    }
  }

  // Phase 13: Skill balance preference (similar, complementary, any)
  if (query.skillPreference && typeof query.skillPreference === 'string') {
    const rawPref = query.skillPreference.trim().toLowerCase();
    if (['similar', 'complementary', 'any'].includes(rawPref)) {
      sanitized.skillPreference = rawPref;
    }
  }

  // Phase 13: Self-reported session confidence
  if (query.confidence && typeof query.confidence === 'string') {
    const rawConf = query.confidence.trim().toLowerCase();
    if (['confident', 'needs_improvement', 'neutral'].includes(rawConf)) {
      sanitized.confidence = rawConf;
    }
  } else if (query.selfReportedConfidence && typeof query.selfReportedConfidence === 'string') {
    const rawConf = query.selfReportedConfidence.trim().toLowerCase();
    if (['confident', 'needs_improvement', 'neutral'].includes(rawConf)) {
      sanitized.confidence = rawConf;
    }
  }

  if (query.desiredOutcome && typeof query.desiredOutcome === 'string') {
    sanitized.desiredOutcome = query.desiredOutcome.trim().slice(0, 150);
    if (!sanitized.learningGoal) sanitized.learningGoal = sanitized.desiredOutcome;
  }

  if (query.collaborationStyle && typeof query.collaborationStyle === 'string') {
    sanitized.collaborationStyle = query.collaborationStyle.trim().slice(0, 100);
  }

  if (query.language && typeof query.language === 'string') {
    sanitized.language = query.language.trim().slice(0, 50);
  }

  if (query.preferredTime && typeof query.preferredTime === 'string') {
    sanitized.preferredTime = query.preferredTime.trim().slice(0, 100);
  }

  if (query.filterSchedule && typeof query.filterSchedule === 'string') {
    sanitized.filterSchedule = query.filterSchedule.trim().slice(0, 100);
  }

  if (query.schedule && typeof query.schedule === 'string') {
    sanitized.schedule = query.schedule.trim().slice(0, 100);
  }

  if (query.duration !== undefined) {
    const dur = parseInt(query.duration, 10);
    if (!Number.isNaN(dur) && dur > 0) {
      sanitized.duration = dur;
    }
  }

  if (query.limit !== undefined) {
    const parsedLimit = parseInt(query.limit, 10);
    if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
      sanitized.limit = Math.min(500, parsedLimit);
    }
  }

  return sanitized;
}

export function validateRecommendationFeedbackInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const recTarget = body.targetId || body.recommendationId || body.trackingId;
  if (!recTarget) {
    errors.push('Target ID or Recommendation ID is required');
  } else {
    sanitized.targetId = String(recTarget).trim();
  }

  if (body.trackingId) {
    sanitized.trackingId = String(body.trackingId).trim();
  }

  if (!body.action || typeof body.action !== 'string') {
    errors.push('Action is required (accepted, dismissed, or followed_through)');
  } else {
    let act = body.action.trim().toLowerCase();
    if (act === 'completed') act = 'followed_through';
    if (!['accepted', 'dismissed', 'viewed', 'followed_through'].includes(act)) {
      errors.push("Action must be 'accepted', 'dismissed', 'viewed', or 'followed_through'");
    } else {
      sanitized.action = act;
    }
  }

  sanitized.recommendationType = body.recommendationType ? String(body.recommendationType).trim().slice(0, 50) : 'general';

  if (body.feedbackText && typeof body.feedbackText === 'string') {
    sanitized.feedbackText = body.feedbackText.trim().slice(0, 500);
  } else {
    sanitized.feedbackText = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Recommendation feedback validation failed', errors);
  }

  return sanitized;
}

export function validateBlockUserInput(body = {}, currentUserId = null) {
  const errors = [];
  const sanitized = {};

  const targetId = body.targetUserId || body.userId;
  if (!targetId || typeof targetId !== 'string' || targetId.trim().length === 0) {
    errors.push('Target user ID to block is required');
  } else if (currentUserId && targetId.trim() === currentUserId) {
    errors.push('You cannot block your own user account');
  } else {
    sanitized.targetUserId = targetId.trim();
  }

  if (errors.length > 0) {
    throw new ValidationError('Block user validation failed', errors);
  }

  return sanitized;
}

export function validateDnaUpdate(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.collaborationStyle !== undefined) {
    if (typeof body.collaborationStyle !== 'string') {
      errors.push('collaborationStyle must be text');
    } else {
      sanitized.collaborationStyle = body.collaborationStyle.trim().slice(0, 100);
    }
  }

  if (body.preferredStudyTimes !== undefined) {
    if (typeof body.preferredStudyTimes !== 'string') {
      errors.push('preferredStudyTimes must be text');
    } else {
      sanitized.preferredStudyTimes = body.preferredStudyTimes.trim().slice(0, 100);
    }
  }

  if (body.preferredStudyDuration !== undefined) {
    const dur = parseInt(body.preferredStudyDuration, 10);
    if (!Number.isInteger(dur) || dur < 10 || dur > 360) {
      errors.push('preferredStudyDuration must be between 10 and 360 minutes');
    } else {
      sanitized.preferredStudyDuration = dur;
    }
  }

  if (body.preferredLanguages !== undefined) {
    if (!Array.isArray(body.preferredLanguages)) {
      errors.push('preferredLanguages must be an array of strings');
    } else {
      sanitized.preferredLanguages = body.preferredLanguages
        .filter((l) => typeof l === 'string' && l.trim().length > 0)
        .map((l) => l.trim().slice(0, 50));
    }
  }

  if (body.subjects !== undefined) {
    if (!Array.isArray(body.subjects)) {
      errors.push('subjects must be an array of subject names');
    } else {
      sanitized.subjects = body.subjects
        .filter((s) => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim().slice(0, 100));
    }
  }

  const topicList = body.topics || body.preferences;
  if (topicList !== undefined) {
    if (!Array.isArray(topicList)) {
      errors.push('topics must be an array of topic preferences');
    } else {
      const validConf = ['confident', 'neutral', 'needs_improvement'];
      sanitized.topics = topicList.map((item, idx) => {
        if (!item.topic_id && !item.topicId) {
          errors.push(`Topic preference at index ${idx} must include topic_id`);
        }
        const tid = (item.topic_id || item.topicId || '').trim();
        let conf = item.confidence_level || item.confidenceLevel;
        if (conf && typeof conf === 'string') {
          conf = conf.toLowerCase().trim();
          if (!validConf.includes(conf)) {
            conf = 'neutral';
          }
        } else {
          conf = item.is_strength ? 'confident' : item.is_improving ? 'needs_improvement' : 'neutral';
        }

        return {
          topic_id: tid,
          confidence_level: conf,
          willing_to_teach: Boolean(item.willing_to_teach || item.willingToTeach),
          wants_peer_support: Boolean(item.wants_peer_support || item.wantsPeerSupport),
          is_learning_now: item.is_learning_now !== undefined ? Boolean(item.is_learning_now) : true,
          learning_goal: typeof item.learning_goal === 'string' ? item.learning_goal.trim().slice(0, 255) : '',
          skill_level: typeof item.skill_level === 'string' ? item.skill_level.trim() : 'Intermediate',
          preferred_study_duration: Number.isInteger(item.preferred_study_duration) ? item.preferred_study_duration : 45,
        };
      });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Learning DNA validation failed', errors);
  }

  return sanitized;
}

export function validateAssessmentInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const topicId = body.topicId || body.topic_id;
  if (!topicId || typeof topicId !== 'string' || topicId.trim().length === 0) {
    errors.push('topicId is required');
  } else {
    sanitized.topicId = topicId.trim();
  }

  const rawScore = body.scorePercentage !== undefined ? body.scorePercentage : body.score_percentage;
  if (rawScore === undefined || rawScore === null) {
    errors.push('scorePercentage is required');
  } else {
    const score = Number(rawScore);
    if (isNaN(score) || score < 0 || score > 100) {
      errors.push('scorePercentage must be a number between 0 and 100');
    } else {
      sanitized.scorePercentage = Math.round(score * 10) / 10;
    }
  }

  sanitized.assessmentType = body.assessmentType || body.assessment_type || 'practice_quiz';
  if (typeof sanitized.assessmentType === 'string') {
    sanitized.assessmentType = sanitized.assessmentType.trim().slice(0, 50);
  } else {
    sanitized.assessmentType = 'practice_quiz';
  }

  if (body.notes && typeof body.notes === 'string') {
    sanitized.notes = body.notes.trim().slice(0, 500);
  } else {
    sanitized.notes = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Topic assessment validation failed', errors);
  }

  return sanitized;
}

export function validateFocusStartInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const topic = body.topic;
  if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
    errors.push('topic is required');
  } else {
    sanitized.topic = topic.trim().slice(0, 100);
  }

  if (body.subject && typeof body.subject === 'string') {
    sanitized.subject = body.subject.trim().slice(0, 100);
  } else {
    sanitized.subject = null;
  }

  if (body.goal && typeof body.goal === 'string') {
    sanitized.goal = body.goal.trim().slice(0, 255);
  } else {
    sanitized.goal = null;
  }

  let durationSec = 1500; // 25 min default
  if (body.plannedDurationMinutes !== undefined) {
    const mins = Number(body.plannedDurationMinutes);
    if (isNaN(mins) || mins < 1 || mins > 240) {
      errors.push('plannedDurationMinutes must be between 1 and 240');
    } else {
      durationSec = Math.round(mins * 60);
    }
  } else if (body.plannedDurationSeconds !== undefined) {
    const secs = Number(body.plannedDurationSeconds);
    if (isNaN(secs) || secs < 60 || secs > 14400) {
      errors.push('plannedDurationSeconds must be between 60 and 14400');
    } else {
      durationSec = Math.round(secs);
    }
  }
  sanitized.plannedDurationSeconds = durationSec;

  // Structured session phases
  const validPhases = ['focus', 'discuss', 'recall', 'review'];
  if (body.currentPhase && typeof body.currentPhase === 'string' && validPhases.includes(body.currentPhase.toLowerCase())) {
    sanitized.currentPhase = body.currentPhase.toLowerCase();
  } else {
    sanitized.currentPhase = 'focus';
  }

  if (Array.isArray(body.phases) && body.phases.length > 0) {
    sanitized.phases = body.phases.map((p) => ({
      id: String(p.id || '').toLowerCase(),
      name: String(p.name || ''),
      label: String(p.label || ''),
      durationSeconds: Math.max(0, parseInt(p.durationSeconds, 10) || 0),
      description: String(p.description || ''),
    }));
  } else {
    sanitized.phases = null;
  }

  sanitized.sessionId = body.sessionId && typeof body.sessionId === 'string' ? body.sessionId.trim() : null;
  sanitized.roomId = body.roomId && typeof body.roomId === 'string' ? body.roomId.trim() : null;
  sanitized.autoCancelPrevious = Boolean(body.autoCancelPrevious);

  if (errors.length > 0) {
    throw new ValidationError('Focus interval start validation failed', errors);
  }

  return sanitized;
}

export function validateFocusCompleteInput(body = {}) {
  const sanitized = {};

  const validGoals = ['yes', 'partially', 'no'];
  if (body.goalAchieved && typeof body.goalAchieved === 'string' && validGoals.includes(body.goalAchieved.toLowerCase())) {
    sanitized.goalAchieved = body.goalAchieved.toLowerCase();
  } else {
    sanitized.goalAchieved = null;
  }

  if (body.keyTakeaways && typeof body.keyTakeaways === 'string') {
    sanitized.keyTakeaways = body.keyTakeaways.trim().slice(0, 2000);
  } else {
    sanitized.keyTakeaways = null;
  }

  if (body.confusingDoubts && typeof body.confusingDoubts === 'string') {
    sanitized.confusingDoubts = body.confusingDoubts.trim().slice(0, 2000);
  } else {
    sanitized.confusingDoubts = null;
  }

  sanitized.needsRevision = Boolean(body.needsRevision);

  if (body.earlyExitReason && typeof body.earlyExitReason === 'string') {
    sanitized.earlyExitReason = body.earlyExitReason.trim().slice(0, 500);
  } else {
    sanitized.earlyExitReason = null;
  }

  if (Array.isArray(body.completedPhases)) {
    sanitized.completedPhases = body.completedPhases.map((id) => String(id).toLowerCase().trim()).filter(Boolean);
  } else {
    sanitized.completedPhases = null;
  }

  if (body.currentPhase && typeof body.currentPhase === 'string') {
    sanitized.currentPhase = body.currentPhase.toLowerCase().trim();
  } else {
    sanitized.currentPhase = null;
  }

  return sanitized;
}

export function validateFocusPhaseInput(body = {}) {
  const errors = [];
  const sanitized = {};
  const validPhases = ['focus', 'discuss', 'recall', 'review'];

  if (!body.currentPhase || typeof body.currentPhase !== 'string' || !validPhases.includes(body.currentPhase.toLowerCase().trim())) {
    errors.push(`currentPhase must be one of: ${validPhases.join(', ')}`);
  } else {
    sanitized.currentPhase = body.currentPhase.toLowerCase().trim();
  }

  if (body.completedPhase && typeof body.completedPhase === 'string' && validPhases.includes(body.completedPhase.toLowerCase().trim())) {
    sanitized.completedPhase = body.completedPhase.toLowerCase().trim();
  } else {
    sanitized.completedPhase = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Focus phase transition validation failed', errors);
  }

  return sanitized;
}


export function validateDistractionSettingsInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.suppressInAppNotifications !== undefined) {
    sanitized.suppressInAppNotifications = Boolean(body.suppressInAppNotifications);
  }
  if (body.hideNonEssentialNav !== undefined) {
    sanitized.hideNonEssentialNav = Boolean(body.hideNonEssentialNav);
  }
  if (body.breakRemindersEnabled !== undefined) {
    sanitized.breakRemindersEnabled = Boolean(body.breakRemindersEnabled);
  }
  if (body.breakIntervalMinutes !== undefined) {
    const val = Number(body.breakIntervalMinutes);
    if (isNaN(val) || val < 5 || val > 180) {
      errors.push('breakIntervalMinutes must be between 5 and 180');
    } else {
      sanitized.breakIntervalMinutes = Math.round(val);
    }
  }
  if (body.breakDurationMinutes !== undefined) {
    const val = Number(body.breakDurationMinutes);
    if (isNaN(val) || val < 1 || val > 60) {
      errors.push('breakDurationMinutes must be between 1 and 60');
    } else {
      sanitized.breakDurationMinutes = Math.round(val);
    }
  }
  if (body.audioChimeEnabled !== undefined) {
    sanitized.audioChimeEnabled = Boolean(body.audioChimeEnabled);
  }

  if (errors.length > 0) {
    throw new ValidationError('Distraction Shield settings validation failed', errors);
  }

  return sanitized;
}

export function validatePeerFeedbackInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (!body.targetPeerId || typeof body.targetPeerId !== 'string' || body.targetPeerId.trim().length === 0) {
    errors.push('targetPeerId is required');
  } else {
    sanitized.targetPeerId = body.targetPeerId.trim();
  }

  if (body.sessionId !== undefined && body.sessionId !== null) {
    if (typeof body.sessionId !== 'string' || body.sessionId.trim().length === 0) {
      errors.push('sessionId must be a valid string if provided');
    } else {
      sanitized.sessionId = body.sessionId.trim();
    }
  } else {
    sanitized.sessionId = null;
  }

  if (body.wasHelpful !== undefined && body.wasHelpful !== null) {
    sanitized.wasHelpful = Boolean(body.wasHelpful) ? 1 : 0;
  } else {
    sanitized.wasHelpful = null;
  }

  if (body.wouldStudyAgain !== undefined && body.wouldStudyAgain !== null) {
    sanitized.wouldStudyAgain = Boolean(body.wouldStudyAgain) ? 1 : 0;
  } else {
    sanitized.wouldStudyAgain = null;
  }

  if (body.topicRelevance !== undefined && body.topicRelevance !== null) {
    sanitized.topicRelevance = Boolean(body.topicRelevance) ? 1 : 0;
  } else {
    sanitized.topicRelevance = null;
  }

  if (body.feedbackNotes !== undefined && body.feedbackNotes !== null) {
    if (typeof body.feedbackNotes !== 'string') {
      errors.push('feedbackNotes must be text');
    } else {
      sanitized.feedbackNotes = body.feedbackNotes.trim().slice(0, 500);
    }
  } else {
    sanitized.feedbackNotes = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Peer feedback validation failed', errors);
  }

  return sanitized;
}

export function validateRecommendationExplicitFeedbackInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.trackingId && typeof body.trackingId === 'string') {
    sanitized.trackingId = body.trackingId.trim();
  } else if (body.recommendationId && typeof body.recommendationId === 'string') {
    sanitized.trackingId = body.recommendationId.trim();
  } else {
    sanitized.trackingId = null;
  }

  sanitized.recommendationType = body.recommendationType || 'general';
  sanitized.targetId = body.targetId ? String(body.targetId).trim() : 'unknown';

  if (body.isRelevant !== undefined && body.isRelevant !== null) {
    sanitized.isRelevant = Boolean(body.isRelevant) ? 1 : 0;
  } else {
    sanitized.isRelevant = null;
  }

  if (body.qualityRating !== undefined && body.qualityRating !== null) {
    const r = Number(body.qualityRating);
    if (isNaN(r) || r < 1 || r > 5) {
      errors.push('qualityRating must be an integer between 1 and 5');
    } else {
      sanitized.qualityRating = Math.round(r);
    }
  } else {
    sanitized.qualityRating = null;
  }

  if (body.reasonTag !== undefined && body.reasonTag !== null) {
    sanitized.reasonTag = String(body.reasonTag).trim().slice(0, 50);
  } else {
    sanitized.reasonTag = null;
  }

  if (body.feedbackText !== undefined && body.feedbackText !== null) {
    sanitized.feedbackText = String(body.feedbackText).trim().slice(0, 500);
  } else {
    sanitized.feedbackText = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Recommendation explicit feedback validation failed', errors);
  }

  return sanitized;
}

// ============================================================================
// Phase 14: Safety, Privacy & Trust Schemas
// ============================================================================

const DANGEROUS_TAG_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const JAVASCRIPT_URI_REGEX = /javascript\s*:/gi;
const EVENT_HANDLER_REGEX = /\bon\w+\s*=/gi;

/**
 * Sanitizes user-submitted text content to mitigate script injection & XSS
 */
export function sanitizeContentText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(DANGEROUS_TAG_REGEX, '')
    .replace(JAVASCRIPT_URI_REGEX, '')
    .replace(EVENT_HANDLER_REGEX, '')
    .trim();
}

/**
 * Validates external resource URLs (strictly requires http: or https: schemes)
 */
export function validateSafeUrl(urlStr) {
  if (typeof urlStr !== 'string' || !urlStr.trim()) return false;
  try {
    const parsed = new URL(urlStr.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validatePrivacySettingsUpdate(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.profileVisibility !== undefined) {
    const validVis = ['public', 'rooms_only', 'private'];
    const vis = String(body.profileVisibility).trim().toLowerCase();
    if (!validVis.includes(vis)) {
      errors.push("profileVisibility must be one of: 'public', 'rooms_only', 'private'");
    } else {
      sanitized.profileVisibility = vis;
    }
  }

  if (body.showActivityStatus !== undefined) {
    sanitized.showActivityStatus = Boolean(body.showActivityStatus);
  }

  if (body.showLearningPreferences !== undefined) {
    sanitized.showLearningPreferences = Boolean(body.showLearningPreferences);
  }

  if (body.showInstitution !== undefined) {
    sanitized.showInstitution = Boolean(body.showInstitution);
  }

  if (body.allowStudyInvites !== undefined) {
    sanitized.allowStudyInvites = Boolean(body.allowStudyInvites);
  }

  if (errors.length > 0) {
    throw new ValidationError('Privacy settings validation failed', errors);
  }

  return sanitized;
}

export function validateReportInput(body = {}, reporterId = null) {
  const errors = [];
  const sanitized = {};

  const validCategories = [
    'harassment',
    'spam',
    'impersonation',
    'inappropriate_content',
    'suspicious_behavior',
    'other',
  ];

  if (!body.category || typeof body.category !== 'string') {
    errors.push('Report category is required');
  } else {
    const cat = body.category.trim().toLowerCase();
    if (!validCategories.includes(cat)) {
      errors.push(`Category must be one of: ${validCategories.join(', ')}`);
    } else {
      sanitized.category = cat;
    }
  }

  if (body.reportedUserId !== undefined && body.reportedUserId !== null) {
    const target = String(body.reportedUserId).trim();
    if (reporterId && target === reporterId) {
      errors.push('You cannot report yourself');
    } else {
      sanitized.reportedUserId = target;
    }
  } else {
    sanitized.reportedUserId = null;
  }

  if (body.roomId !== undefined && body.roomId !== null) {
    sanitized.roomId = String(body.roomId).trim();
  } else {
    sanitized.roomId = null;
  }

  if (body.contentType !== undefined && body.contentType !== null) {
    const validTypes = ['user', 'room_message', 'question', 'note', 'resource'];
    const cType = String(body.contentType).trim().toLowerCase();
    if (!validTypes.includes(cType)) {
      errors.push(`contentType must be one of: ${validTypes.join(', ')}`);
    } else {
      sanitized.contentType = cType;
    }
  } else {
    sanitized.contentType = sanitized.reportedUserId ? 'user' : 'other';
  }

  if (body.contentId !== undefined && body.contentId !== null) {
    sanitized.contentId = String(body.contentId).trim();
  } else {
    sanitized.contentId = null;
  }

  if (body.description !== undefined && body.description !== null) {
    const desc = sanitizeContentText(String(body.description));
    if (desc.length > 1000) {
      errors.push('Report description cannot exceed 1000 characters');
    } else {
      sanitized.description = desc;
    }
  } else {
    sanitized.description = '';
  }

  if (!sanitized.reportedUserId && !sanitized.roomId && !sanitized.contentId) {
    errors.push('At least one target (user, room, or content ID) must be specified in the report');
  }

  if (errors.length > 0) {
    throw new ValidationError('Report submission validation failed', errors);
  }

  return sanitized;
}

export function validateModerationAction(body = {}) {
  const errors = [];
  const sanitized = {};

  const validStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
  if (!body.status || typeof body.status !== 'string') {
    errors.push('Moderation status is required');
  } else {
    const st = body.status.trim().toLowerCase();
    if (!validStatuses.includes(st)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    } else {
      sanitized.status = st;
    }
  }

  if (body.actionTaken !== undefined && body.actionTaken !== null) {
    sanitized.actionTaken = sanitizeContentText(String(body.actionTaken)).slice(0, 100);
  } else {
    sanitized.actionTaken = null;
  }

  if (body.moderatorNotes !== undefined && body.moderatorNotes !== null) {
    sanitized.moderatorNotes = sanitizeContentText(String(body.moderatorNotes)).slice(0, 1000);
  } else {
    sanitized.moderatorNotes = null;
  }

  if (errors.length > 0) {
    throw new ValidationError('Moderation action validation failed', errors);
  }

  return sanitized;
}

export function validateStudyInviteInput(body = {}, senderId = null) {
  const errors = [];
  const sanitized = {};

  if (!body.receiverId || typeof body.receiverId !== 'string') {
    errors.push('receiverId is required');
  } else {
    const rId = body.receiverId.trim();
    if (senderId && rId === senderId) {
      errors.push('You cannot send a study invitation to yourself');
    } else {
      sanitized.receiverId = rId;
    }
  }

  if (body.topic !== undefined && body.topic !== null) {
    sanitized.topic = sanitizeContentText(String(body.topic)).slice(0, 120);
  } else {
    sanitized.topic = 'General Coursework';
  }

  if (body.message !== undefined && body.message !== null) {
    sanitized.message = sanitizeContentText(String(body.message)).slice(0, 500);
  } else {
    sanitized.message = '';
  }

  if (errors.length > 0) {
    throw new ValidationError('Study invite validation failed', errors);
  }

  return sanitized;
}

export function validateAccountDeactivateInput(body = {}) {
  const errors = [];
  const sanitized = {};

  if (!body.password || typeof body.password !== 'string') {
    errors.push('Current password is required to verify identity');
  } else {
    sanitized.password = body.password;
  }

  if (!body.confirmation || typeof body.confirmation !== 'string') {
    errors.push("Type 'CONFIRM' to confirm account deactivation");
  } else if (body.confirmation.trim().toUpperCase() !== 'CONFIRM') {
    errors.push("Confirmation must be exactly 'CONFIRM'");
  } else {
    sanitized.confirmation = 'CONFIRM';
  }

  if (errors.length > 0) {
    throw new ValidationError('Account deactivation validation failed', errors);
  }

  return sanitized;
}



export function validateCreateMessageInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const rawContent = body.message_content !== undefined
    ? body.message_content
    : (body.text !== undefined ? body.text : (body.message !== undefined ? body.message : body.content));

  if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    errors.push('Message content cannot be blank');
  } else if (rawContent.trim().length > 2000) {
    errors.push('Message cannot exceed 2000 characters');
  } else {
    sanitized.message_content = sanitizeContentText(rawContent.trim());
  }

  if (body.topicTag !== undefined && body.topicTag !== null) {
    if (typeof body.topicTag === 'string' && body.topicTag.trim().length > 0) {
      sanitized.topicTag = sanitizeContentText(body.topicTag.trim()).slice(0, 50);
    } else {
      sanitized.topicTag = null;
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Message validation failed', errors);
  }

  return sanitized;
}

export function validateRoomMessagesQuery(query = {}) {
  const errors = [];
  const filters = {};

  const limit = query.limit !== undefined ? parseInt(query.limit, 10) : 50;
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push('Limit must be an integer between 1 and 100');
  } else {
    filters.limit = limit;
  }

  const offset = query.offset !== undefined ? parseInt(query.offset, 10) : 0;
  if (isNaN(offset) || offset < 0) {
    errors.push('Offset must be a non-negative integer');
  } else {
    filters.offset = offset;
  }

  if (query.before && typeof query.before === 'string') {
    filters.before = query.before.trim();
  }

  if (errors.length > 0) {
    throw new ValidationError('Room messages query validation failed', errors);
  }

  return filters;
}

export function validateSettingsUpdate(body = {}) {
  const errors = [];
  const sanitized = {};

  if (body.theme !== undefined) {
    const validThemes = ['light', 'dark', 'system'];
    if (typeof body.theme !== 'string' || !validThemes.includes(body.theme.toLowerCase())) {
      errors.push(`Theme must be one of: ${validThemes.join(', ')}`);
    } else {
      sanitized.theme = body.theme.toLowerCase();
    }
  }

  if (body.language !== undefined) {
    let lang = typeof body.language === 'string' ? body.language.toLowerCase().trim() : '';
    if (lang === 'english') lang = 'en';
    if (lang === 'tamil') lang = 'ta';
    const validLanguages = ['en', 'ta'];
    if (!validLanguages.includes(lang)) {
      errors.push(`Language must be one of: ${validLanguages.join(', ')}`);
    } else {
      sanitized.language = lang;
    }
  }

  if (body.fontScaling !== undefined) {
    let raw = body.fontScaling;
    let scale = typeof raw === 'string' ? raw.toLowerCase().trim() : String(raw).trim();
    if (scale === 'small') scale = 'compact';
    if (scale === 'default') scale = 'standard';
    if (scale === 'large') scale = 'comfortable';

    const validNamedScales = ['compact', 'standard', 'comfortable'];
    if (validNamedScales.includes(scale)) {
      sanitized.fontScaling = scale;
    } else {
      const match = scale.match(/^(\d+)(?:px)?$/);
      if (match) {
        const px = parseInt(match[1], 10);
        if (px >= 12 && px <= 24) {
          sanitized.fontScaling = `${px}px`;
        } else {
          errors.push('Font size must be between 12px and 24px');
        }
      } else {
        errors.push('Font scaling must be between 12px and 24px, or small, default, large');
      }
    }
  }

  if (body.reducedMotion !== undefined) {
    sanitized.reducedMotion = Boolean(body.reducedMotion);
  }

  if (body.roomAudioVideo !== undefined) {
    const validAudioVideo = ['muted', 'mic-only'];
    if (typeof body.roomAudioVideo !== 'string' || !validAudioVideo.includes(body.roomAudioVideo)) {
      errors.push(`Room audio/video must be one of: ${validAudioVideo.join(', ')}`);
    } else {
      sanitized.roomAudioVideo = body.roomAudioVideo;
    }
  }

  if (body.focusDuration !== undefined) {
    const duration = parseInt(body.focusDuration, 10);
    if (isNaN(duration) || duration < 10 || duration > 240) {
      errors.push('Focus duration must be an integer between 10 and 240 minutes');
    } else {
      sanitized.focusDuration = duration;
    }
  }

  if (body.breakDuration !== undefined) {
    const breakDur = parseInt(body.breakDuration, 10);
    if (isNaN(breakDur) || breakDur < 1 || breakDur > 60) {
      errors.push('Break duration must be an integer between 1 and 60 minutes');
    } else {
      sanitized.breakDuration = breakDur;
    }
  }

  if (body.primaryStudyLanguage !== undefined) {
    if (typeof body.primaryStudyLanguage === 'string' && body.primaryStudyLanguage.trim().length > 0) {
      sanitized.primaryStudyLanguage = body.primaryStudyLanguage.trim();
    }
  }

  if (body.suppressInAppNotifications !== undefined) {
    sanitized.suppressInAppNotifications = Boolean(body.suppressInAppNotifications);
  }

  if (body.breakRemindersEnabled !== undefined) {
    sanitized.breakRemindersEnabled = Boolean(body.breakRemindersEnabled);
  }

  if (body.audioChimeEnabled !== undefined) {
    sanitized.audioChimeEnabled = Boolean(body.audioChimeEnabled);
  }

  if (body.profileVisibility !== undefined) {
    const validVis = ['public', 'rooms_only', 'private'];
    if (!validVis.includes(body.profileVisibility)) {
      errors.push(`Profile visibility must be one of: ${validVis.join(', ')}`);
    } else {
      sanitized.profileVisibility = body.profileVisibility;
    }
  }

  if (body.showLearningPreferences !== undefined) {
    sanitized.showLearningPreferences = Boolean(body.showLearningPreferences);
  }

  if (body.allowStudyInvites !== undefined) {
    sanitized.allowStudyInvites = Boolean(body.allowStudyInvites);
  }

  if (errors.length > 0) {
    throw new ValidationError('Settings validation failed', errors);
  }

  return sanitized;
}

export function validateCreateDirectMessageInput(body = {}) {
  const errors = [];
  const sanitized = {};

  const rawContent = body.message_content !== undefined
    ? body.message_content
    : (body.messageContent !== undefined
      ? body.messageContent
      : (body.text !== undefined ? body.text : (body.message !== undefined ? body.message : body.content)));

  if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length === 0) {
    errors.push('Message content cannot be blank');
  } else if (rawContent.trim().length > 2000) {
    errors.push('Message cannot exceed 2000 characters');
  } else {
    sanitized.message_content = sanitizeContentText(rawContent.trim());
  }

  if (errors.length > 0) {
    throw new ValidationError('Direct message validation failed', errors);
  }

  return sanitized;
}

export function validateCreateConversationInput(body = {}, senderId = null) {
  const errors = [];
  const sanitized = {};

  const recipientId = body.recipientId || body.receiverId || body.userId || body.targetUserId;
  if (!recipientId || typeof recipientId !== 'string' || recipientId.trim().length === 0) {
    errors.push('Recipient user ID is required');
  } else {
    const rId = recipientId.trim();
    if (senderId && rId === senderId) {
      errors.push('Cannot start a conversation with yourself');
    } else {
      sanitized.recipientId = rId;
    }
  }

  if (body.message !== undefined || body.message_content !== undefined || body.text !== undefined) {
    const rawMsg = body.message_content !== undefined ? body.message_content : (body.message !== undefined ? body.message : body.text);
    if (typeof rawMsg === 'string' && rawMsg.trim().length > 0) {
      if (rawMsg.trim().length > 2000) {
        errors.push('Initial message cannot exceed 2000 characters');
      } else {
        sanitized.initialMessage = sanitizeContentText(rawMsg.trim());
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Conversation validation failed', errors);
  }

  return sanitized;
}

export function validateDirectMessagesQuery(query = {}) {
  const errors = [];
  const filters = {};

  const limit = query.limit !== undefined ? parseInt(query.limit, 10) : 50;
  if (isNaN(limit) || limit < 1 || limit > 100) {
    errors.push('Limit must be an integer between 1 and 100');
  } else {
    filters.limit = limit;
  }

  const offset = query.offset !== undefined ? parseInt(query.offset, 10) : 0;
  if (isNaN(offset) || offset < 0) {
    errors.push('Offset must be a non-negative integer');
  } else {
    filters.offset = offset;
  }

  if (query.before && typeof query.before === 'string') {
    filters.before = query.before.trim();
  }

  if (errors.length > 0) {
    throw new ValidationError('Direct messages query validation failed', errors);
  }

  return filters;
}

export function validateJoinCodeInput(body = {}) {
  const rawCode = body?.code || body?.room_code || body?.roomCode;
  if (!rawCode || typeof rawCode !== 'string' || rawCode.trim().length === 0) {
    throw new ValidationError('Room code is required', ['Please enter a room code']);
  }
  const clean = rawCode.trim().toUpperCase();
  if (clean.length < 3 || clean.length > 30) {
    throw new ValidationError('Invalid room code length', ['Room code must be between 3 and 30 characters']);
  }
  return clean;
}

export function formatSuccess(data, meta = null) {
  const response = {
    success: true,
    data,
  };
  if (meta) {
    response.meta = meta;
  }
  return response;
}

export function formatError(message, code = 'BAD_REQUEST', details = []) {
  return {
    success: false,
    error: {
      message,
      code,
      details,
    },
  };
}
