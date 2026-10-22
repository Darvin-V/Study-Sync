/**
 * StudySync AI — Route Definitions & Navigation Configuration
 * 
 * Defines standard path constants and navigation link metadata for the application.
 */

export const ROUTES = Object.freeze({
  HOME: '/',
  DISCOVER: '/discover',
  ROOMS: '/rooms',
  SESSIONS: '/sessions',
  NOTES: '/notes',
  KNOWLEDGE_MAP: '/knowledge-map',
  PROFILE: '/profile',
  MESSAGES: '/messages',
  CIRCLE: '/circle',
  CONTACTS: '/circle',
  SETTINGS: '/settings',
  LOGIN: '/login',
  REGISTER: '/register',
  ONBOARDING: '/onboarding',
});

export const NAV_ITEMS = Object.freeze([
  { path: ROUTES.HOME, label: 'Home', description: 'Start studying or resume recent learning' },
  { path: ROUTES.DISCOVER, label: 'Discover Learners', description: 'Find and connect with verified learners' },
  { path: ROUTES.CIRCLE, label: 'Circle', description: 'View and search learners in your Circle' },
  { path: ROUTES.ROOMS, label: 'Rooms', description: 'Find, create, and join study rooms' },
  { path: ROUTES.MESSAGES, label: 'Messages', description: 'Private and group conversations' },
  { path: ROUTES.PROFILE, label: 'Profile', description: 'Academic identity, resources, and settings' },
]);
