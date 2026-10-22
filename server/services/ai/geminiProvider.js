import { AIProviderInterface } from './aiProviderInterface.js';

/**
 * StudySync AI — Optional Gemini AI Provider (Phase 9)
 * 
 * Secure, rate-limited, opt-in AI provider.
 * Activates ONLY when GEMINI_API_KEY or AI_API_KEY is present in the server environment.
 * If unset, times out, or fails, gracefully falls back without compromising application stability.
 */
export class GeminiProvider extends AIProviderInterface {
  constructor(apiKey = null) {
    super('gemini');
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.AI_API_KEY || null;
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.timeoutMs = 4000;

    // Rate limiter: Max 15 requests per minute
    this.requestTimestamps = [];
    this.maxRequestsPerMinute = 15;
  }

  isAvailable() {
    return Boolean(this.apiKey && typeof this.apiKey === 'string' && this.apiKey.trim().length > 0);
  }

  _isRateLimited() {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < 60000);
    return this.requestTimestamps.length >= this.maxRequestsPerMinute;
  }

  _recordRequest() {
    this.requestTimestamps.push(Date.now());
  }

  async _callGeminiApi(promptText) {
    if (!this.isAvailable()) return null;
    if (this._isRateLimited()) {
      return null;
    }

    this._recordRequest();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        this.model
      )}:generateContent`;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 120,
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json().catch(() => null);
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? text.trim() : null;
    } catch {
      // Safely catch timeouts, network drops, or JSON errors without breaking callers
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async enhancePeerMatch(candidate, currentUserProfile, targetTopic) {
    if (!this.isAvailable()) {
      return { insight: null, isEnhanced: false, provider: this.name, error: 'API_KEY_NOT_CONFIGURED' };
    }

    const prompt = `You are StudySync AI's academic peer matching assistant.
Learner A (${currentUserProfile?.skill_level || 'Intermediate'}) wants to study "${targetTopic || 'core coursework'}".
Matched with Peer B: ${candidate.displayName || 'Peer'} (Skill: ${candidate.skillLevel || 'Intermediate'}, Availability: ${candidate.mutualAvailability || 'Evenings'}).
Reasons: ${(candidate.matchingReasons || []).slice(0, 3).join(', ')}.
Write a single, encouraging sentence (max 25 words) highlighting why they should connect and an initial collaborative topic to discuss.`;

    const response = await this._callGeminiApi(prompt);

    if (response) {
      return {
        insight: response,
        isEnhanced: true,
        provider: this.name,
      };
    }

    return {
      insight: null,
      isEnhanced: false,
      provider: this.name,
      error: 'PROVIDER_TIMEOUT_OR_UNAVAILABLE',
    };
  }

  async enhanceStudyRecommendation(recommendation, currentUserProfile) {
    if (!this.isAvailable()) {
      return { tip: null, isEnhanced: false, provider: this.name, error: 'API_KEY_NOT_CONFIGURED' };
    }

    const prompt = `You are StudySync AI's study coach.
Recommendation: ${recommendation.title} (${recommendation.topic}).
Context: ${recommendation.reason}.
Write a single concise study action tip (max 20 words) for the student.`;

    const response = await this._callGeminiApi(prompt);

    if (response) {
      return {
        tip: response,
        isEnhanced: true,
        provider: this.name,
      };
    }

    return {
      tip: null,
      isEnhanced: false,
      provider: this.name,
      error: 'PROVIDER_TIMEOUT_OR_UNAVAILABLE',
    };
  }
}

export default GeminiProvider;
