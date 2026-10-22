import { RuleBasedProvider } from './ruleBasedProvider.js';
import { GeminiProvider } from './geminiProvider.js';

/**
 * StudySync AI — Unified AI Service Manager (Phase 9)
 * 
 * Selects between rule-based and optional external AI providers dynamically.
 * Assures zero-cost deployment, safe fallbacks, and honest labeling of recommendations.
 */
class AIServiceManager {
  constructor() {
    this.ruleBasedProvider = new RuleBasedProvider();
    this.geminiProvider = new GeminiProvider();
    this.activeProvider = this.geminiProvider.isAvailable()
      ? this.geminiProvider
      : this.ruleBasedProvider;
  }

  /**
   * Re-evaluates active provider (useful if environment variables change or for testing)
   */
  refreshProvider() {
    this.geminiProvider = new GeminiProvider();
    this.activeProvider = this.geminiProvider.isAvailable()
      ? this.geminiProvider
      : this.ruleBasedProvider;
    return this.getStatus();
  }

  /**
   * Injects a custom provider for testing or alternative providers
   */
  setCustomProvider(provider) {
    if (provider) {
      this.activeProvider = provider;
    } else {
      this.refreshProvider();
    }
  }

  /**
   * Reports system status for AI capabilities
   */
  getStatus() {
    const isAiConfigured = this.activeProvider.getProviderName() !== 'rule_based' && this.activeProvider.isAvailable();
    return {
      ai_available: isAiConfigured,
      active_provider: this.activeProvider.getProviderName(),
      rule_engine_operational: true,
      free_tier_compatible: true,
      model: isAiConfigured ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash') : 'none (deterministic rule engine)',
      ai_label: isAiConfigured ? 'AI-Enhanced' : 'StudySync Rule-Based Matching',
    };
  }

  /**
   * Enhances peer match with an explainable insight
   */
  async enhancePeerMatch(candidate, currentUserProfile, targetTopic) {
    try {
      if (this.activeProvider.isAvailable() && this.activeProvider.getProviderName() !== 'rule_based') {
        const result = await this.activeProvider.enhancePeerMatch(candidate, currentUserProfile, targetTopic);
        if (result && result.isEnhanced) {
          return result;
        }
      }
    } catch {
      // Fall through to rule-based fallback
    }

    // Default transparent rule-based insight
    return this.ruleBasedProvider.enhancePeerMatch(candidate, currentUserProfile, targetTopic);
  }

  /**
   * Enhances study recommendation with actionable tips
   */
  async enhanceStudyRecommendation(recommendation, currentUserProfile) {
    try {
      if (this.activeProvider.isAvailable() && this.activeProvider.getProviderName() !== 'rule_based') {
        const result = await this.activeProvider.enhanceStudyRecommendation(recommendation, currentUserProfile);
        if (result && result.isEnhanced) {
          return result;
        }
      }
    } catch {
      // Fall through to rule-based fallback
    }

    return this.ruleBasedProvider.enhanceStudyRecommendation(recommendation, currentUserProfile);
  }
}

export const aiService = new AIServiceManager();
export default aiService;
