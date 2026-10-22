/**
 * StudySync AI — AI Provider Interface (Phase 9)
 * 
 * Formal abstraction for AI enhancement providers. Allows StudySync AI
 * to switch between rule-based, Gemini, or future local LLM models
 * without altering core business logic or frontend contracts.
 */

export class AIProviderInterface {
  constructor(name = 'base') {
    this.name = name;
  }

  /**
   * Whether this provider has valid credentials and is ready for use.
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }

  /**
   * Name of this provider ('rule_based', 'gemini', 'openai_compatible', etc.)
   * @returns {string}
   */
  getProviderName() {
    return this.name;
  }

  /**
   * Generates or enhances study partner matching insight.
   * @param {Object} candidate - Ranked peer candidate data
   * @param {Object} currentUserProfile - Authenticated user's profile
   * @param {string} targetTopic - Topic requested for study
   * @returns {Promise<{ insight: string|null, isEnhanced: boolean }>}
   */
  async enhancePeerMatch(candidate, currentUserProfile, targetTopic) {
    throw new Error('Method enhancePeerMatch must be implemented by provider');
  }

  /**
   * Generates or enhances a personalized learning tip.
   * @param {Object} recommendation - Base rule-generated recommendation
   * @param {Object} currentUserProfile - Authenticated user's profile
   * @returns {Promise<{ tip: string|null, isEnhanced: boolean }>}
   */
  async enhanceStudyRecommendation(recommendation, currentUserProfile) {
    throw new Error('Method enhanceStudyRecommendation must be implemented by provider');
  }
}

export default AIProviderInterface;
