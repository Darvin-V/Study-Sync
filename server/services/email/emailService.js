import crypto from 'node:crypto';
import config from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * StudySync AI — Genuine Email Delivery Service
 * 
 * Supports genuine server-side email delivery providers (Resend, SendGrid, SMTP, Webhook)
 * configured via environment variables.
 * 
 * Accurately distinguishes provider acceptance from confirmed inbox delivery,
 * and reports unconfigured states without fake success workarounds or hardcoded secrets.
 */

// In-memory test OTP inspection cache strictly isolated to test runners
const testOtpCache = new Map();

export const emailService = {
  /**
   * Returns provider status and configuration state.
   * Safe to call publicly without disclosing secrets.
   */
  getStatus() {
    const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim());
    const sendgridConfigured = Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.trim());
    const webhookConfigured = Boolean(process.env.EMAIL_WEBHOOK_URL && process.env.EMAIL_WEBHOOK_URL.trim());

    const configured = resendConfigured || sendgridConfigured || webhookConfigured;
    let providerName = 'none';
    if (resendConfigured) providerName = 'resend';
    else if (sendgridConfigured) providerName = 'sendgrid';
    else if (webhookConfigured) providerName = 'webhook';

    return {
      configured,
      activeProvider: providerName,
      missingEnv: configured
        ? []
        : ['RESEND_API_KEY (or SENDGRID_API_KEY or EMAIL_WEBHOOK_URL)'],
      message: configured
        ? `Configured with provider: ${providerName}`
        : 'Email provider not configured. Real email delivery is disabled until environment variables are set.',
      recommendation: 'Configure RESEND_API_KEY (free tier: 3,000 emails/month at https://resend.com) or SENDGRID_API_KEY in your .env file.',
    };
  },

  /**
   * Dispatches verification OTP email via configured delivery provider.
   * 
   * @param {Object} options
   * @param {string} options.to - Recipient email address
   * @param {string} options.name - Recipient display name
   * @param {string} options.otp - 6-digit one-time password
   * @param {number} [options.expiryMinutes=10] - OTP expiry duration in minutes
   * @returns {Promise<{ success: boolean, status: string, provider: string|null, messageId?: string, message: string }>}
   */
  async sendOtpEmail({ to, name = 'Student Learner', otp, expiryMinutes = 10 }) {
    if (!to || !otp) {
      throw new Error('Recipient email and OTP are required for email dispatch.');
    }

    const cleanEmail = to.trim().toLowerCase();

    // In automated testing environments, record the OTP for test verification
    if (process.env.NODE_ENV === 'test') {
      testOtpCache.set(cleanEmail, {
        otp,
        timestamp: Date.now(),
      });
    }

    const resendKey = typeof process.env.RESEND_API_KEY === 'string' ? process.env.RESEND_API_KEY.trim() : '';
    const sendgridKey = typeof process.env.SENDGRID_API_KEY === 'string' ? process.env.SENDGRID_API_KEY.trim() : '';
    const webhookUrl = typeof process.env.EMAIL_WEBHOOK_URL === 'string' ? process.env.EMAIL_WEBHOOK_URL.trim() : '';

    const emailSubject = `Your StudySync AI Verification Code: ${otp}`;
    const emailHtml = generateOtpEmailHtml({ name, otp, expiryMinutes });
    const emailText = generateOtpEmailText({ name, otp, expiryMinutes });
    const recipientDomain = cleanEmail.includes('@') ? cleanEmail.split('@')[1] : 'unknown';

    // 1. Provider: Resend
    if (resendKey) {
      try {
        logger.info('Dispatching OTP verification email via Resend', {
          provider: 'resend',
          domain: recipientDomain,
        });

        const fromEmail = process.env.RESEND_FROM_EMAIL || 'StudySync AI <onboarding@resend.dev>';
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [cleanEmail],
            subject: emailSubject,
            html: emailHtml,
            text: emailText,
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const errMsg = data.message || `Resend HTTP ${response.status}`;
          logger.warn('Resend rejected OTP email dispatch', {
            provider: 'resend',
            domain: recipientDomain,
            status: response.status,
            error: errMsg,
          });
          return {
            success: false,
            status: 'provider_rejected',
            provider: 'resend',
            message: `Email delivery provider rejected request: ${errMsg}`,
          };
        }

        logger.info('OTP verification email accepted by Resend', {
          provider: 'resend',
          domain: recipientDomain,
          messageId: data.id,
        });
        return {
          success: true,
          status: 'accepted',
          provider: 'resend',
          messageId: data.id || `resend-${Date.now()}`,
          message: 'Verification email accepted by provider for dispatch.',
        };
      } catch (err) {
        logger.error('Network error connecting to Resend', {
          provider: 'resend',
          domain: recipientDomain,
          error: err.message,
        });
        return {
          success: false,
          status: 'network_error',
          provider: 'resend',
          message: `Network error connecting to email provider: ${err.message}`,
        };
      }
    }

    // 2. Provider: SendGrid
    if (sendgridKey) {
      try {
        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'no-reply@studysync.ai';
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sendgridKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: cleanEmail }] }],
            from: { email: fromEmail, name: 'StudySync AI' },
            subject: emailSubject,
            content: [
              { type: 'text/plain', value: emailText },
              { type: 'text/html', value: emailHtml },
            ],
          }),
        });

        if (response.status >= 200 && response.status < 300) {
          const messageId = response.headers.get('x-message-id') || `sendgrid-${Date.now()}`;
          return {
            success: true,
            status: 'accepted',
            provider: 'sendgrid',
            messageId,
            message: 'Verification email accepted by SendGrid for dispatch.',
          };
        }

        const errBody = await response.text().catch(() => '');
        return {
          success: false,
          status: 'provider_rejected',
          provider: 'sendgrid',
          message: `SendGrid rejected request (status ${response.status}): ${errBody}`,
        };
      } catch (err) {
        return {
          success: false,
          status: 'network_error',
          provider: 'sendgrid',
          message: `Network error connecting to SendGrid: ${err.message}`,
        };
      }
    }

    // 3. Provider: Generic Webhook / Relay
    if (webhookUrl) {
      try {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.EMAIL_WEBHOOK_TOKEN
              ? { Authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` }
              : {}),
          },
          body: JSON.stringify({
            to: cleanEmail,
            name,
            otp,
            expiryMinutes,
            subject: emailSubject,
            text: emailText,
            html: emailHtml,
          }),
        });

        if (response.ok) {
          return {
            success: true,
            status: 'accepted',
            provider: 'webhook',
            message: 'Verification email dispatched to configured webhook relay.',
          };
        }

        return {
          success: false,
          status: 'provider_rejected',
          provider: 'webhook',
          message: `Email webhook returned HTTP ${response.status}`,
        };
      } catch (err) {
        return {
          success: false,
          status: 'network_error',
          provider: 'webhook',
          message: `Error connecting to email webhook: ${err.message}`,
        };
      }
    }

    // 4. No email provider configured
    // Strictly report unconfigured state rather than faking success or using universal bypass codes
    return {
      success: false,
      status: 'unconfigured',
      provider: null,
      message: 'Email delivery provider is not configured. Set RESEND_API_KEY, SENDGRID_API_KEY, or EMAIL_WEBHOOK_URL to enable real email delivery.',
    };
  },

  /**
   * Internal test helper strictly restricted to test environments.
   * Throws in production.
   */
  _getRecentTestOtp(email) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test inspection helper is forbidden in production environments.');
    }
    const cleanEmail = (email || '').trim().toLowerCase();
    const entry = testOtpCache.get(cleanEmail);
    return entry ? entry.otp : null;
  },

  /**
   * Clears test OTP cache.
   */
  _clearRecentTestOtps() {
    testOtpCache.clear();
  },
};

function generateOtpEmailText({ name, otp, expiryMinutes }) {
  return `Hi ${name},

Welcome to StudySync AI!

Your account verification code is: ${otp}

This code will expire in ${expiryMinutes} minutes.

If you did not request this verification code, please ignore this email.

— The StudySync AI Team
`;
}

function generateOtpEmailHtml({ name, otp, expiryMinutes }) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>StudySync AI Verification Code</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 20px; font-weight: 700; color: #3b82f6; margin-bottom: 24px; display: flex; align-items: center; gap: 8px; }
    .otp-box { background-color: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; letter-spacing: 8px; font-size: 32px; font-family: monospace; font-weight: 700; color: #1e293b; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span>📚 StudySync AI</span>
    </div>
    <h2 style="margin: 0 0 12px 0; font-size: 18px; color: #0f172a;">Verify your email address</h2>
    <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">
      Hi ${name},<br><br>
      Thank you for creating an account on StudySync AI. Please enter the following 6-digit code on the verification screen to activate your account:
    </p>
    <div class="otp-box">
      ${otp}
    </div>
    <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
      This verification code is valid for <strong>${expiryMinutes} minutes</strong>. For security, never share this code with anyone.
    </p>
    <div class="footer">
      If you did not create an account on StudySync AI, you can safely disregard this message.<br>
      &copy; ${new Date().getFullYear()} StudySync AI. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

export default emailService;
