import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import topicRoutes from './routes/topic.routes.js';
import roomRoutes from './routes/room.routes.js';
import sessionRoutes from './routes/session.routes.js';
import noteRoutes from './routes/note.routes.js';
import authRoutes from './routes/auth.routes.js';
import profileRoutes from './routes/profile.routes.js';
import matchRoutes from './routes/match.routes.js';
import recommendationRoutes from './routes/recommendation.routes.js';
import dnaRoutes from './routes/dna.routes.js';
import knowledgeMapRoutes from './routes/knowledgeMap.routes.js';
import focusRoutes from './routes/focus.routes.js';
import feedbackRoutes from './routes/feedback.routes.js';
import safetyRoutes from './routes/safety.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import circleRoutes from './routes/circle.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { formatSuccess } from './schemas/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/**
 * StudySync AI — Express Application Setup
 * 
 * Configures middleware, security boundaries, and API route mounts.
 */
export function createApp() {
  const app = express();

  // Security Hardening: Disable X-Powered-By
  app.disable('x-powered-by');

  // Reverse Proxy Trust: Required for Render, Fly, and cloud load balancers
  // Ensures correct client IP detection (rate limiters) and req.protocol === 'https'
  app.set('trust proxy', 1);

  // HTTP Security Headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Restricted CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        const allowed = [
          config.corsOrigin,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:3000',
        ];

        if (allowed.includes(origin) || config.isDevelopment || config.nodeEnv === 'test') {
          return callback(null, true);
        }

        return callback(null, false);
      },
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
    })
  );

  // Body Parsing with safe limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Root API metadata
  app.get('/api', (req, res) => {
    res.status(200).json(
      formatSuccess({
        name: 'StudySync AI Backend API',
        version: '0.1.0',
        status: 'online',
        endpoints: [
          '/health',
          '/api/health',
          '/api/health/db',
          '/api/auth/register',
          '/api/auth/login',
          '/api/auth/logout',
          '/api/auth/me',
          '/api/profile/me',
          '/api/profile/preferences',
          '/api/topics',
          '/api/topics/subjects',
          '/api/rooms',
          '/api/sessions',
          '/api/notes',
          '/api/matches/peers',
          '/api/matches/status',
          '/api/recommendations/study',
          '/api/recommendations/status',
          '/api/dna',
          '/api/knowledge-map',
          '/api/knowledge-map/progress',
          '/api/knowledge-map/paths',
        ],
      })
    );
  });

  // Health and Liveness Probes (available at both /health and /api/health)
  app.use('/health', healthRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/dna', dnaRoutes);
  app.use('/api/knowledge-map', knowledgeMapRoutes);
  app.use('/api/topics', topicRoutes);
  app.use('/api/rooms', roomRoutes);
  app.use('/api/sessions', sessionRoutes);
  app.use('/api/notes', noteRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/recommendations', recommendationRoutes);
  app.use('/api/focus', focusRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/user/settings', settingsRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/circle', circleRoutes);
  app.use('/api', safetyRoutes);

  // Static Assets & Single-Page Application (SPA) Routing for Production Deployment
  const distPath = path.resolve(projectRoot, 'dist');
  if ((config.isProduction || process.env.SERVE_STATIC === 'true') && fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      // Pass through non-GET, API, and health routes so they can reach notFoundHandler
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  // 404 Route Handler
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export default createApp;
