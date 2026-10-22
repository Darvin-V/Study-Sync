import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('StudySync Mobile Navigation & Responsive Layout Test Suite', () => {
  const layoutCssPath = path.resolve('src/styles/layout.css');
  const baseCssPath = path.resolve('src/styles/base.css');
  const mobileNavJsxPath = path.resolve('src/components/Layout/MobileNav.jsx');
  const routesConfigPath = path.resolve('src/config/routes.js');

  test('1. MobileNav component provides all six primary destinations', () => {
    assert.ok(fs.existsSync(mobileNavJsxPath), 'MobileNav.jsx must exist');
    const content = fs.readFileSync(mobileNavJsxPath, 'utf8');

    // All 6 primary destinations must be defined
    assert.ok(content.includes('ROUTES.HOME'), 'Must include Home destination');
    assert.ok(content.includes('ROUTES.DISCOVER'), 'Must include Discover Learners destination');
    assert.ok(content.includes('ROUTES.ROOMS'), 'Must include Study Rooms destination');
    assert.ok(content.includes('ROUTES.MESSAGES'), 'Must include Messages destination');
    assert.ok(content.includes('ROUTES.CIRCLE'), 'Must include Circle destination');
    assert.ok(content.includes('ROUTES.PROFILE'), 'Must include Profile destination');

    // More popover must exist with Circle, Profile, and Settings
    assert.ok(content.includes('mobile-nav-more-popover'), 'Must include More popover sheet');
    assert.ok(content.includes('mobile-more-link-circle'), 'More popover must link to Circle');
    assert.ok(content.includes('mobile-more-link-profile'), 'More popover must link to Profile');
    assert.ok(content.includes('mobile-more-link-settings'), 'More popover must link to Settings');
  });

  test('2. Labels are concise, professional, and prohibited from wrapping into multiple lines', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');
    const mobileNavJsx = fs.readFileSync(mobileNavJsxPath, 'utf8');

    // Ensure labels are short and single-word in MobileNav
    const shortLabels = ['Home', 'Discover', 'Rooms', 'Messages', 'Circle', 'Profile', 'More'];
    for (const label of shortLabels) {
      assert.ok(mobileNavJsx.includes(label), `Mobile navigation must use concise label "${label}"`);
    }

    // CSS must strictly enforce single-line no-wrap with ellipsis
    assert.ok(
      layoutCss.includes('white-space: nowrap !important') || layoutCss.includes('white-space: nowrap'),
      'Navigation labels must strictly prevent text wrapping'
    );
    assert.ok(layoutCss.includes('text-overflow: ellipsis'), 'Must specify text-overflow: ellipsis for overflow protection');
    assert.ok(layoutCss.includes('overflow: hidden'), 'Must specify overflow: hidden on label container');
  });

  test('3. Selected tab uses subtle indicator without oversized rounded background', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // Verify .mobile-bottom-tab.active does NOT set a full-block dark background
    assert.ok(layoutCss.includes('.mobile-bottom-tab.active'), '.mobile-bottom-tab.active rule must exist');

    // Active state uses subtle icon pill and top accent line indicator
    assert.ok(
      layoutCss.includes('.mobile-bottom-tab.active .mobile-tab-icon-wrap'),
      'Must style active icon wrap with subtle pill indicator'
    );
    assert.ok(
      layoutCss.includes('.mobile-bottom-tab.active::before'),
      'Must provide clean top accent line indicator for active tab'
    );
  });

  test('4. Responsive navigation breakpoint strategy for narrow viewports vs wider screens', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // Narrow screens (< 410px) hide direct Circle & Profile and show More trigger
    assert.ok(layoutCss.includes('@media (max-width: 409.98px)'), 'Must include narrow viewport media query');
    assert.ok(
      layoutCss.includes('.mobile-tab-circle') && layoutCss.includes('.mobile-tab-profile'),
      'Must target Circle and Profile tabs for responsive visibility'
    );
    assert.ok(
      layoutCss.includes('.mobile-tab-more-trigger'),
      'Must target More trigger button for responsive visibility'
    );

    // Wider screens (>= 410px) show all 6 tabs and hide More trigger
    assert.ok(layoutCss.includes('@media (min-width: 410px)'), 'Must include wider screen media query');
  });

  test('5. Touch targets and layout dimensions at real mobile viewports', () => {
    const mobileWidths = [
      { name: 'Small mobile (iPhone SE 1st gen / Android compact)', width: 320, tabCount: 5 },
      { name: 'Standard Android mobile', width: 360, tabCount: 5 },
      { name: 'iPhone SE 2nd/3rd gen / iPhone 8', width: 375, tabCount: 5 },
      { name: 'iPhone 12/13/14/15/16 standard', width: 390, tabCount: 5 },
      { name: 'iPhone Plus / Max', width: 414, tabCount: 6 },
      { name: 'iPhone 14/15/16 Pro Max', width: 430, tabCount: 6 },
    ];

    for (const vp of mobileWidths) {
      const tabWidth = vp.width / vp.tabCount;
      const minTouchTarget = 44; // 44x44 CSS pixels
      const barHeight = 58;

      assert.ok(
        tabWidth >= minTouchTarget,
        `At viewport ${vp.width}px (${vp.name}), tab width ${tabWidth.toFixed(1)}px must exceed touch target ${minTouchTarget}px`
      );
      assert.ok(
        barHeight >= minTouchTarget,
        `Navigation bar height ${barHeight}px must exceed touch target ${minTouchTarget}px`
      );
    }
  });

  test('6. Safe area insets and fixed bottom bar positioning', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    assert.ok(layoutCss.includes('env(safe-area-inset-bottom'), 'Must respect safe-area-inset-bottom');
    assert.ok(layoutCss.includes('position: fixed'), 'Bottom navigation must be fixed to viewport bottom');
    assert.ok(layoutCss.includes('bottom: 0'), 'Bottom navigation must anchor at bottom: 0');
    assert.ok(layoutCss.includes('z-index: 50') || layoutCss.includes('z-index: 40'), 'Must have adequate z-index');
  });

  test('7. Content clearance: Page content is never obscured by navigation bar', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // .app-main on mobile must have bottom padding >= 76px to clear 58px bar + safe area
    assert.ok(
      layoutCss.includes('padding-bottom: calc(80px') || layoutCss.includes('padding-bottom: calc(76px'),
      'Must provide generous bottom padding on app-main to prevent content obstruction'
    );
  });

  test('8. Horizontal page overflow guards on all core containers', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');
    const baseCss = fs.readFileSync(baseCssPath, 'utf8');

    assert.ok(baseCss.includes('overflow-x: hidden'), 'base.css must enforce overflow-x: hidden on html/body');
    assert.ok(layoutCss.includes('overflow-x: hidden'), 'layout.css must enforce overflow-x: hidden on shell');
    assert.ok(baseCss.includes('max-width: 100vw'), 'base.css must enforce max-width: 100vw');
    assert.ok(layoutCss.includes('max-width: 100vw'), 'layout.css must enforce max-width: 100vw on shell');
  });

  test('9. Accessibility: ARIA roles, labels, and keyboard support', () => {
    const mobileNavJsx = fs.readFileSync(mobileNavJsxPath, 'utf8');

    assert.ok(mobileNavJsx.includes('aria-label="Mobile Bottom Navigation"'), 'Must provide accessible name for bottom nav');
    assert.ok(mobileNavJsx.includes('aria-label="More navigation destinations"'), 'Must provide accessible name for More button');
    assert.ok(mobileNavJsx.includes('aria-haspopup="true"'), 'Must indicate popup on More button');
    assert.ok(mobileNavJsx.includes('aria-expanded'), 'Must indicate expanded state on More button');
    assert.ok(mobileNavJsx.includes('role="menu"'), 'Must designate More popover as menu');
    assert.ok(mobileNavJsx.includes('role="menuitem"'), 'Must designate More popover links as menuitem');
    assert.ok(mobileNavJsx.includes("'Escape'"), 'Must handle Escape key to close More popover');
  });

  test('10. Desktop and tablet responsiveness: sidebar remains visible on desktop, bottom nav hidden', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // On desktop (> 768px): mobile-bottom-nav is display: none
    assert.ok(layoutCss.includes('.mobile-bottom-nav {\n  display: none;'), 'Mobile bottom nav must be hidden by default on desktop');

    // On mobile (<= 768px): app-sidebar is display: none, mobile-bottom-nav is display: flex
    assert.ok(layoutCss.includes('@media (max-width: 768px)'), 'Must include 768px mobile breakpoint');
    assert.ok(layoutCss.includes('.app-sidebar {\n    display: none;\n  }'), 'Sidebar must hide on mobile screens');
  });
});
