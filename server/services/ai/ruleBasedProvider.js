import { AIProviderInterface } from './aiProviderInterface.js';

/**
 * StudySync AI — Rule-Based Recommendation Provider (Phase 9)
 * 
 * Default, zero-cost, transparent recommendation provider.
 * Uses syllabus rules, profile preferences, and attendance history.
 * Explicitly declares itself as non-AI-generated (`isEnhanced: false`).
 */
export class RuleBasedProvider extends AIProviderInterface {
  constructor() {
    super('rule_based');
  }

  isAvailable() {
    return true; // Always operational and free
  }

  async enhancePeerMatch(candidate, currentUserProfile, targetTopic) {
    // Generates a transparent, rule-derived summary sentence
    const reasons = candidate.matchingReasons || [];
    let summary = '';

    if (reasons.length > 0) {
      summary = `Recommended based on ${reasons.slice(0, 2).join(' and ')}.`;
    } else {
      summary = `Aligned study schedule and active coursework in ${targetTopic || 'shared subjects'}.`;
    }

    return {
      insight: summary,
      isEnhanced: false,
      provider: this.name,
      engine: 'deterministic_rule_based',
    };
  }

  async enhanceStudyRecommendation(recommendation, currentUserProfile) {
    return {
      tip: recommendation.reason || 'Continue your consistent study cadence.',
      isEnhanced: false,
      provider: this.name,
      engine: 'deterministic_rule_based',
    };
  }
}

export default RuleBasedProvider;
