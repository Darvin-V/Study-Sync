import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('PWA & Android Packaging Tests (Phase 6)', () => {
  // 1. Web App Manifest Validation
  describe('1. Web App Manifest Validation', () => {
    const manifestPath = path.resolve('public/manifest.webmanifest');

    test('Manifest file exists in public/ directory', () => {
      assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');
    });

    test('Manifest is valid JSON and contains required PWA fields', () => {
      const content = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(content);

      assert.equal(typeof manifest.name, 'string');
      assert.ok(manifest.name.includes('StudySync'));
      assert.equal(typeof manifest.short_name, 'string');
      assert.equal(manifest.display, 'standalone');
      assert.ok(manifest.start_url);
      assert.ok(manifest.theme_color);
      assert.ok(manifest.background_color);
      assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3);

      const has192 = manifest.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png');
      const has512 = manifest.icons.some((i) => i.sizes === '512x512' && i.type === 'image/png');
      const hasMaskable = manifest.icons.some((i) => i.purpose?.includes('maskable'));

      assert.ok(has192, 'Manifest must specify a 192x192 icon');
      assert.ok(has512, 'Manifest must specify a 512x512 icon');
      assert.ok(hasMaskable, 'Manifest must specify a maskable icon');
    });
  });

  // 2. Icon Assets Integrity
  describe('2. Icon Assets Integrity and PNG Signatures', () => {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const icons = [
      'public/icons/icon-192x192.png',
      'public/icons/icon-512x512.png',
      'public/icons/maskable-icon-512x512.png',
      'public/icons/apple-touch-icon.png',
    ];

    for (const iconPath of icons) {
      test(`Verifies ${iconPath} exists and has valid PNG header`, () => {
        const resolved = path.resolve(iconPath);
        assert.ok(fs.existsSync(resolved), `${iconPath} must exist on disk`);

        const buf = fs.readFileSync(resolved);
        assert.ok(buf.length > 500, `${iconPath} must be a non-trivial file`);
        assert.ok(
          buf.subarray(0, 8).equals(pngSignature),
          `${iconPath} must start with standard PNG magic bytes`
        );
      });
    }
  });

  // 3. Service Worker Security & Privacy Boundaries
  describe('3. Service Worker Security & Privacy Boundaries', () => {
    const swPath = path.resolve('public/sw.js');

    test('sw.js exists and precaches safe application shell only', () => {
      assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');
      const swContent = fs.readFileSync(swPath, 'utf8');

      // Precache check
      assert.ok(swContent.includes('/index.html'));
      assert.ok(swContent.includes('/manifest.webmanifest'));
      assert.ok(swContent.includes('/icons/icon-192x192.png'));
    });

    test('sw.js explicitly forbids caching of private /api/ endpoints', () => {
      const swContent = fs.readFileSync(swPath, 'utf8');

      // Check rule preventing API caching
      assert.ok(
        swContent.includes("url.pathname.startsWith('/api')") ||
          swContent.includes('request.headers.has(\'authorization\')'),
        'Service worker must explicitly guard against caching /api endpoints'
      );

      // Check offline fallback for API requests
      assert.ok(
        swContent.includes('NETWORK_OFFLINE') || swContent.includes('offline'),
        'Service worker should provide safe fallback for offline API calls'
      );
    });

    test('sw.js implements update lifecycle without stale caching lock', () => {
      const swContent = fs.readFileSync(swPath, 'utf8');
      assert.ok(swContent.includes('skipWaiting()'), 'Service worker must support skipWaiting');
      assert.ok(swContent.includes('clients.claim()'), 'Service worker must support clients.claim');
      assert.ok(swContent.includes('caches.delete'), 'Service worker must clean up stale caches');
    });
  });

  // 4. Android Capacitor Packaging & Network Security
  describe('4. Android Capacitor Packaging & Network Security', () => {
    test('capacitor.config.json exists with valid configuration', () => {
      const capConfigPath = path.resolve('capacitor.config.json');
      assert.ok(fs.existsSync(capConfigPath), 'capacitor.config.json must exist');

      const config = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
      assert.equal(config.appId, 'ai.studysync.app');
      assert.equal(config.appName, 'StudySync AI');
      assert.equal(config.webDir, 'dist');
      assert.equal(config.server?.androidScheme, 'https');
    });

    test('Android project and AndroidManifest.xml configured with network security', () => {
      const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
      assert.ok(fs.existsSync(manifestPath), 'AndroidManifest.xml must exist');

      const manifestContent = fs.readFileSync(manifestPath, 'utf8');
      assert.ok(
        manifestContent.includes('android:networkSecurityConfig="@xml/network_security_config"'),
        'AndroidManifest must link network_security_config'
      );
      assert.ok(
        manifestContent.includes('android.permission.INTERNET'),
        'AndroidManifest must request INTERNET permission'
      );
    });

    test('network_security_config.xml enforces HTTPS by default with local loopback exception', () => {
      const netSecPath = path.resolve('android/app/src/main/res/xml/network_security_config.xml');
      assert.ok(fs.existsSync(netSecPath), 'network_security_config.xml must exist');

      const content = fs.readFileSync(netSecPath, 'utf8');
      assert.ok(
        content.includes('cleartextTrafficPermitted="false"'),
        'Base config must disallow cleartext traffic by default'
      );
      assert.ok(
        content.includes('<domain includeSubdomains="true">10.0.2.2</domain>'),
        'Must permit loopback for Android emulator local testing'
      );
    });
  });

  // 5. Build Artifacts in dist/
  describe('5. Production Build Integration', () => {
    test('dist/ contains manifest, service worker, and icons after build', () => {
      assert.ok(fs.existsSync(path.resolve('dist/index.html')), 'dist/index.html must exist');
      assert.ok(fs.existsSync(path.resolve('dist/manifest.webmanifest')), 'dist/manifest.webmanifest must exist');
      assert.ok(fs.existsSync(path.resolve('dist/sw.js')), 'dist/sw.js must exist');
      assert.ok(fs.existsSync(path.resolve('dist/icons/icon-192x192.png')), 'dist/icons/icon-192x192.png must exist');
      assert.ok(fs.existsSync(path.resolve('dist/icons/icon-512x512.png')), 'dist/icons/icon-512x512.png must exist');
    });
  });
});
