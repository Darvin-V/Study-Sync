/**
 * StudySync AI — Formatting Utility Functions
 */

/**
 * Format ISO date string into readable user-friendly string
 * @param {string} isoString
 * @returns {string}
 */
export function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Format minutes into readable hour / minute representation
 * @param {number} minutes
 * @returns {string}
 */
export function formatDuration(minutes) {
  if (typeof minutes !== 'number' || minutes < 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hrs > 0 && remainingMins > 0) return `${hrs}h ${remainingMins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${remainingMins}m`;
}

/**
 * Format a number as a score percentage
 * @param {number} score
 * @returns {string}
 */
export function formatScore(score) {
  if (typeof score !== 'number') return '0%';
  return `${Math.round(score)}%`;
}

/**
 * Normalizes font scaling identifier to canonical ('compact' | 'standard' | 'comfortable').
 * Accepts aliases: 'small' -> 'compact', 'default' -> 'standard', 'large' -> 'comfortable'.
 * @param {string} scale
 * @returns {'compact' | 'standard' | 'comfortable'}
 */
export function normalizeFontScale(scale) {
  if (!scale) return 'standard';
  const s = String(scale).toLowerCase().trim();
  if (s === 'small' || s === 'compact') return 'compact';
  if (s === 'large' || s === 'comfortable') return 'comfortable';
  return 'standard';
}

