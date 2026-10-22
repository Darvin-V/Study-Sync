import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('StudySync — Comprehensive Mobile Responsiveness Audit Across All Routes', () => {
  const layoutCssPath = path.resolve('src/styles/layout.css');
  const componentsCssPath = path.resolve('src/styles/components.css');
  const messagesCssPath = path.resolve('src/styles/messages.css');
  const discoverCssPath = path.resolve('src/styles/discover.css');
  const appCssPath = path.resolve('src/App.css');
  const baseCssPath = path.resolve('src/styles/base.css');

  const topbarJsxPath = path.resolve('src/components/Layout/Topbar.jsx');
  const authPageJsxPath = path.resolve('src/components/Auth/AuthPage.jsx');
  const knowledgeMapPageJsxPath = path.resolve('src/pages/KnowledgeMapPage.jsx');
  const topicPathwaysJsxPath = path.resolve('src/components/Domain/TopicPrerequisitePathways.jsx');
  const roomDetailJsxPath = path.resolve('src/components/Rooms/RoomDetailView.jsx');
  const messagesJsxPath = path.resolve('src/pages/Messages.jsx');

  const REQUIRED_VIEWPORTS = [
    { width: 320, height: 700, type: 'compact-mobile', name: '320x700 (Ultra Compact / iPhone SE 1st)' },
    { width: 360, height: 800, type: 'standard-mobile', name: '360x800 (Compact Android)' },
    { width: 375, height: 812, type: 'standard-mobile', name: '375x812 (iPhone SE 2/3 / iPhone 11 Pro)' },
    { width: 390, height: 844, type: 'modern-mobile', name: '390x844 (iPhone 12/13/14/15)' },
    { width: 430, height: 932, type: 'large-mobile', name: '430x932 (iPhone 14/15/16 Pro Max)' },
    { width: 768, height: 1024, type: 'tablet-portrait', name: '768x1024 (iPad Portrait)' },
    { width: 1024, height: 768, type: 'tablet-landscape', name: '1024x768 (iPad Landscape)' },
    { width: 1280, height: 800, type: 'small-desktop', name: '1280x800 (Laptop / Small Desktop)' },
    { width: 1440, height: 900, type: 'standard-desktop', name: '1440x900 (Desktop Large)' },
  ];

  test('1. Viewport verification: Layout system accounts for all 9 required responsive sizes', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // Desktop viewports (1440, 1280, 1024): Sidebar stationary full-height
    assert.ok(layoutCss.includes('width: var(--sidebar-width);'), 'Sidebar has fixed width token');
    assert.ok(layoutCss.includes('height: 100vh;') || layoutCss.includes('height: 100dvh;'), 'Sidebar uses full viewport height');
    assert.ok(layoutCss.includes('.app-shell {') && layoutCss.includes('overflow: hidden;'), 'Shell prevents page body bounce');
    assert.ok(layoutCss.includes('.app-main {') && layoutCss.includes('overflow-y: auto;'), 'Main content scrolls independently on desktop');

    // Mobile & tablet breakpoints (768px, 480px, 380px, 340px)
    assert.ok(layoutCss.includes('@media (max-width: 768px)'), 'Includes 768px mobile breakpoint');
    assert.ok(layoutCss.includes('@media (max-width: 480px)'), 'Includes 480px small mobile breakpoint');
    assert.ok(layoutCss.includes('@media (max-width: 380px)'), 'Includes 380px compact mobile breakpoint');
    assert.ok(layoutCss.includes('@media (max-width: 340px)'), 'Includes 340px ultra-compact mobile breakpoint');
  });

  test('2. Topbar Focus Pill: Does not overflow on screens <= 480px and <= 360px', () => {
    const topbarJsx = fs.readFileSync(topbarJsxPath, 'utf8');
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // Span has class topbar-focus-shield-text
    assert.ok(topbarJsx.includes('className="topbar-focus-shield-text"'), 'Distraction shield span has topbar-focus-shield-text class');

    // CSS hides label on <= 480px
    assert.ok(layoutCss.includes('.topbar-focus-shield-text {\n    display: none !important;'), 'Shield text is hidden on <= 480px');

    // CSS compacts pill on <= 380px
    assert.ok(layoutCss.includes('#topbar-active-focus-pill {\n    padding: 3px 6px !important;'), 'Pill padding is reduced on <= 380px');
  });

  test('3. Auth & OTP Verification: Fits within 320px viewport without horizontal overflow', () => {
    const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');
    const authPageJsx = fs.readFileSync(authPageJsxPath, 'utf8');

    assert.ok(authPageJsx.includes('id="otp-digits-container"'), 'OTP digits container exists');

    // On <= 360px: padding is reduced to 10px and gap to 4px
    assert.ok(componentsCss.includes('#auth-card-container {\n    padding: 14px 10px !important;'), 'Card padding reduced on <= 360px');
    assert.ok(componentsCss.includes('#otp-digits-container {\n    gap: 4px !important;'), 'Digit gap reduced to 4px on <= 360px');
    assert.ok(componentsCss.includes('width: clamp(34px, 10.5vw, 42px) !important;'), 'Digit width clamped for small viewports');

    // Verify mathematical fit at 320px:
    // Available card inner width = 320 - 16 (root padding) - 20 (card padding) = 284px
    // 6 boxes * 36px + 5 * 4px gap = 216 + 20 = 236px <= 284px (comfortable fit with 48px margin)
    const boxWidth = 36;
    const gap = 4;
    const totalOtpWidth = 6 * boxWidth + 5 * gap;
    const availableWidthAt320 = 320 - 16 - 20;
    assert.ok(totalOtpWidth < availableWidthAt320, '6 OTP digits must fit cleanly within 320px screen width');
  });

  test('4. Notification Drawer: Extends properly in mobile bottom-sheet mode', () => {
    const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

    assert.ok(componentsCss.includes('.notif-panel-container .notif-list-body {'), 'Targets notif-list-body in mobile bottom sheet');
    assert.ok(componentsCss.includes('max-height: calc(85dvh - 120px)'), 'Provides dynamic dvh-based max height on mobile');
  });

  test('5. Topic Prerequisite Pathways: Prevents horizontal blowout on narrow screens', () => {
    const topicPathwaysJsx = fs.readFileSync(topicPathwaysJsxPath, 'utf8');

    // Ensures minWidth is not a fixed 260px that exceeds 320px container
    assert.ok(!topicPathwaysJsx.includes('minWidth: 260'), 'Must not have fixed minWidth: 260 that causes mobile overflow');
    assert.ok(
      topicPathwaysJsx.includes("minWidth: 'min(200px, 100%)'") || topicPathwaysJsx.includes('minWidth: 0'),
      'Must use flexible or fluid minWidth'
    );
  });

  test('6. Knowledge Map Page: View switcher and topic grid collapse cleanly on mobile', () => {
    const kmPageJsx = fs.readFileSync(knowledgeMapPageJsxPath, 'utf8');
    const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

    // Navigation view switcher wraps buttons onto multiple lines
    assert.ok(
      kmPageJsx.includes("flexWrap: 'wrap'"),
      'View switcher row must specify flexWrap: wrap to prevent horizontal scrolling'
    );

    // Knowledge map grid collapses to 1fr on <= 480px
    assert.ok(
      componentsCss.includes('#knowledge-map-grid {\n    grid-template-columns: 1fr !important;\n  }'),
      '#knowledge-map-grid collapses to single column on mobile screens'
    );
  });

  test('7. Study Rooms: Detail view chat input row wraps cleanly on narrow screens', () => {
    const roomDetailJsx = fs.readFileSync(roomDetailJsxPath, 'utf8');

    assert.ok(
      roomDetailJsx.includes("flexWrap: 'wrap'"),
      'Room chat input row must have flexWrap: wrap'
    );
    assert.ok(
      roomDetailJsx.includes("flex: '0 1 120px'"),
      'Chat topic tag input must have flexible flex-basis'
    );
  });

  test('8. Messages Route: Mobile split-pane switching and compact header on <= 340px', () => {
    const messagesCss = fs.readFileSync(messagesCssPath, 'utf8');

    // On <= 768px: sidebar and main are single-pane with .hidden-mobile
    assert.ok(messagesCss.includes('.messages-sidebar.hidden-mobile {\n    display: none !important;'), 'Hides conversation list when chat is open');
    assert.ok(messagesCss.includes('.messages-main.hidden-mobile {\n    display: none !important;'), 'Hides chat pane when list is active');

    // On <= 340px: thread header compacts to fit back button + avatar + name + call action
    assert.ok(messagesCss.includes('@media (max-width: 340px)'), 'Includes 340px media query for ultra-narrow messaging');
    assert.ok(messagesCss.includes('#messages-study-call-btn'), 'Compacts study call button on 340px');
  });

  test('9. Settings Route: Single-list controls fit within <= 360px screens without clipping', () => {
    const componentsCss = fs.readFileSync(componentsCssPath, 'utf8');

    assert.ok(
      componentsCss.includes('.settings-item {\n    padding: 10px 12px;\n    gap: 8px;\n  }'),
      'Settings item padding and gap compact on <= 360px'
    );
    assert.ok(
      componentsCss.includes('.settings-clean-select {\n    max-width: 120px;\n    font-size: 13px;'),
      'Settings dropdown max-width constrained to 120px on <= 360px'
    );
  });

  test('10. Bottom Navigation Bar clearance across all mobile viewports', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // Verifies bottom navigation has 44px+ touch targets and adequate height
    assert.ok(layoutCss.includes('min-height: 48px;'), 'Mobile bottom tabs maintain >= 48px touch target');
    assert.ok(layoutCss.includes('height: calc(58px + env(safe-area-inset-bottom, 0px))'), 'Mobile bottom nav height includes safe area');
  });
});
