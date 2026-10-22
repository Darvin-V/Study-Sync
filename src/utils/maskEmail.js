/**
 * Masks destination email address for secure, privacy-preserving presentation.
 * Example: "darvin@example.com" -> "d***@example.com"
 * 
 * @param {string} email
 * @returns {string} Masked email string
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return email || '';
  }
  const parts = email.split('@');
  const userPart = parts[0];
  const domainPart = parts.slice(1).join('@');
  if (userPart.length <= 1) {
    return `${userPart}***@${domainPart}`;
  }
  return `${userPart[0]}***@${domainPart}`;
}

export default maskEmail;
