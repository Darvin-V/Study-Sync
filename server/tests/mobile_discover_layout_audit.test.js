import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('StudySync Mobile Discover Learners — Responsive Layout & Empty Space Audit', () => {
  const discoverCssPath = path.resolve('src/styles/discover.css');
  const componentsCssPath = path.resolve('src/styles/components.css');
  const discoverJsxPath = path.resolve('src/pages/Discover.jsx');
  const layoutCssPath = path.resolve('src/styles/layout.css');

  test('1. Core Discover component elements and test IDs are intact', () => {
    assert.ok(fs.existsSync(discoverJsxPath), 'Discover.jsx must exist');
    const content = fs.readFileSync(discoverJsxPath, 'utf8');

    // Key test IDs and structure
    assert.ok(content.includes('id="discover-page"'), 'Must have #discover-page root');
    assert.ok(content.includes('id="discover-page-header"'), 'Must have #discover-page-header');
    assert.ok(content.includes('id="partner-search-criteria-card"'), 'Must have #partner-search-criteria-card');
    assert.ok(content.includes('id="partner-filter-form"'), 'Must have #partner-filter-form');
    assert.ok(content.includes('id="discover-subject-input"'), 'Must have #discover-subject-input');
    assert.ok(content.includes('id="discover-topic-input"'), 'Must retain hidden #discover-topic-input');
    assert.ok(content.includes('id="btn-find-study-partner"'), 'Must have #btn-find-study-partner');
    assert.ok(content.includes('id="discover-filters-toggle-btn"'), 'Must have #discover-filters-toggle-btn');
    assert.ok(content.includes('id="discover-sort-select"'), 'Must have #discover-sort-select');
    assert.ok(content.includes('id="matched-partners-section"'), 'Must have #matched-partners-section');

    // Button label says Find Partners
    assert.ok(content.includes('Find Partners'), 'Submit button must have Find Partners label');
  });

  test('2. DOM hierarchy: Search input is followed closely by action button and popular topic chips', () => {
    const content = fs.readFileSync(discoverJsxPath, 'utf8');

    const searchInputIdx = content.indexOf('id="discover-subject-input"');
    const buttonIdx = content.indexOf('id="btn-find-study-partner"');
    const popularChipsIdx = content.indexOf('className="discover-popular-chips"');
    const matchedSectionIdx = content.indexOf('id="matched-partners-section"');

    assert.ok(searchInputIdx > 0, 'Search input must exist');
    assert.ok(buttonIdx > searchInputIdx, 'Find Partners button must appear directly after search input');
    assert.ok(popularChipsIdx > buttonIdx, 'Popular topics chips must appear directly below the button');
    assert.ok(matchedSectionIdx > popularChipsIdx, 'Results section must follow the search panel');
  });

  test('3. Mobile search card uses content-based height without viewport stretching', () => {
    const discoverCss = fs.readFileSync(discoverCssPath, 'utf8');

    // Desktop card definition
    assert.ok(discoverCss.includes('.discover-search-card'), '.discover-search-card must be styled');

    // Mobile media query overrides
    const mobileBlockMatch = discoverCss.match(/@media\s*\(max-width:\s*768px\)[\s\S]*?\{([\s\S]*?)\n\}/);
    assert.ok(mobileBlockMatch, '@media (max-width: 768px) block must exist in discover.css');
    const mobileCss = mobileBlockMatch[1];

    // Assert content-based height on mobile
    assert.ok(
      mobileCss.includes('.discover-search-card') &&
      mobileCss.includes('height: auto') &&
      mobileCss.includes('min-height: 0'),
      'Search card must use content-based height: auto and min-height: 0 on mobile'
    );
    assert.ok(
      !mobileCss.includes('.discover-search-card {\n    height: 100vh') &&
      !mobileCss.includes('.discover-search-card {\n    min-height: 100vh') &&
      !mobileCss.includes('.discover-search-card {\n    min-height: 80vh'),
      'Search card must not be stretched to fill the viewport'
    );
  });

  test('4. Stacking order on mobile puts search input at top and action controls directly below', () => {
    const discoverCss = fs.readFileSync(discoverCssPath, 'utf8');

    // Verify .discover-search-top-row stacks in column on mobile
    assert.ok(
      discoverCss.includes('.discover-search-top-row') &&
      discoverCss.includes('flex-direction: column') &&
      discoverCss.includes('align-items: stretch'),
      '.discover-search-top-row must stack vertically on mobile'
    );

    // Verify .discover-search-input-wrap takes 100% width
    assert.ok(
      discoverCss.includes('.discover-search-input-wrap') &&
      discoverCss.includes('width: 100%'),
      '.discover-search-input-wrap must take full width on mobile'
    );
  });

  test('5. Popular topic chips wrap onto additional lines without horizontal overflow', () => {
    const discoverCss = fs.readFileSync(discoverCssPath, 'utf8');

    // Assert flex-wrap on popular chips
    assert.ok(
      discoverCss.includes('.discover-popular-chips') &&
      discoverCss.includes('flex-wrap: wrap'),
      '.discover-popular-chips must specify flex-wrap: wrap to prevent horizontal overflow'
    );
  });

  test('6. Bottom navigation clearance accounts for mobile bottom nav and safe area', () => {
    const discoverCss = fs.readFileSync(discoverCssPath, 'utf8');

    // Ensure padding-bottom leaves ample room above the fixed mobile bottom nav
    assert.ok(
      discoverCss.includes('env(safe-area-inset-bottom') &&
      (discoverCss.includes('calc(84px') || discoverCss.includes('calc(80px')),
      'Mobile discover page must account for bottom nav and safe-area-inset-bottom'
    );
  });

  test('7. Viewport responsive behavior across all required widths', () => {
    const requiredWidths = [
      { name: '320px (Compact Mobile / iPhone SE 1st)', width: 320, isMobile: true, singleColBtn: true },
      { name: '375px (iPhone SE 2/3, iPhone 8)', width: 375, isMobile: true, singleColBtn: true },
      { name: '390px (iPhone 12/13/14/15)', width: 390, isMobile: true, singleColBtn: true },
      { name: '430px (iPhone 14/15/16 Pro Max)', width: 430, isMobile: true, singleColBtn: true },
      { name: '768px (Tablet)', width: 768, isMobile: true, singleColBtn: false },
      { name: '1024px+ (Desktop)', width: 1024, isMobile: false, singleColBtn: false },
    ];

    const discoverCss = fs.readFileSync(discoverCssPath, 'utf8');

    for (const vp of requiredWidths) {
      if (vp.width <= 768) {
        assert.ok(discoverCss.includes('@media (max-width: 768px)'), `Must support ${vp.name} via 768px media query`);
      }
      if (vp.width <= 480) {
        assert.ok(discoverCss.includes('@media (max-width: 480px)'), `Must support ${vp.name} via 480px media query`);
      }
      if (vp.width <= 340) {
        assert.ok(discoverCss.includes('@media (max-width: 340px)'), `Must support ${vp.name} via 340px media query`);
      }
    }
  });

  test('8. Desktop layout preservation: horizontal search bar row intact on >= 769px', () => {
    const discoverCss = fs.readFileSync(discoverCssPath, 'utf8');

    // Check desktop rule for .discover-search-top-row
    const desktopSearchTopRow = discoverCss.slice(0, discoverCss.indexOf('@media (max-width: 768px)'));
    assert.ok(
      desktopSearchTopRow.includes('.discover-search-top-row {') &&
      desktopSearchTopRow.includes('display: flex;') &&
      desktopSearchTopRow.includes('align-items: center;'),
      'Desktop .discover-search-top-row must preserve horizontal flex alignment'
    );
    assert.ok(
      desktopSearchTopRow.includes('.discover-search-input-wrap {') &&
      desktopSearchTopRow.includes('flex: 1;'),
      'Desktop .discover-search-input-wrap must expand horizontally with flex: 1'
    );
  });
});
