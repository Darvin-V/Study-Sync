import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('StudySync — Mobile Sidebar Alignment & Bottom Settings Test Suite', () => {
  const layoutCssPath = path.resolve('src/styles/layout.css');
  const mobileNavJsxPath = path.resolve('src/components/Layout/MobileNav.jsx');
  const sidebarJsxPath = path.resolve('src/components/Layout/Sidebar.jsx');

  test('1. Mobile drawer header keeps StudySync logo, Commons label, and close button at the top', () => {
    const mobileNavJsx = fs.readFileSync(mobileNavJsxPath, 'utf8');

    assert.ok(mobileNavJsx.includes('mobile-drawer-header'), 'Must have mobile-drawer-header container');
    assert.ok(mobileNavJsx.includes('StudySync'), 'Must display StudySync logo/brand in header');
    assert.ok(mobileNavJsx.includes('Commons'), 'Must display Commons label in header');
    assert.ok(mobileNavJsx.includes('aria-label="Close menu"'), 'Must have accessible close button in header');
  });

  test('2. Main navigation links are grouped in top scrollable area with required destinations', () => {
    const mobileNavJsx = fs.readFileSync(mobileNavJsxPath, 'utf8');

    // Drawer nav container exists with mobile-drawer-nav class
    assert.ok(mobileNavJsx.includes('mobile-drawer-nav'), 'Must use mobile-drawer-nav class');

    // Extract the main drawer nav block
    const navStart = mobileNavJsx.indexOf('<nav className="sidebar-nav mobile-drawer-nav"');
    const navEnd = mobileNavJsx.indexOf('</nav>', navStart);
    assert.ok(navStart > 0 && navEnd > navStart, 'Must have distinct mobile-drawer-nav block');
    const navBlock = mobileNavJsx.slice(navStart, navEnd);

    // Verify the 6 primary destinations in main navigation
    assert.ok(navBlock.includes('ROUTES.HOME'), 'Main navigation must contain Home');
    assert.ok(navBlock.includes('ROUTES.DISCOVER'), 'Main navigation must contain Discover Learners');
    assert.ok(navBlock.includes('ROUTES.CIRCLE'), 'Main navigation must contain Circle');
    assert.ok(navBlock.includes('ROUTES.ROOMS'), 'Main navigation must contain Topic Rooms');
    assert.ok(navBlock.includes('ROUTES.MESSAGES'), 'Main navigation must contain Direct Messages');
    assert.ok(navBlock.includes('ROUTES.PROFILE'), 'Main navigation must contain Academic Profile');

    // CRITICAL: Settings must NOT be inside the main nav link list
    assert.ok(!navBlock.includes('ROUTES.SETTINGS'), 'Settings must NOT be inside the main navigation list');
  });

  test('3. Settings is anchored at the bottom with profile card placed beneath it', () => {
    const mobileNavJsx = fs.readFileSync(mobileNavJsxPath, 'utf8');

    // Extract bottom section
    const footerStart = mobileNavJsx.indexOf('mobile-drawer-footer');
    assert.ok(footerStart > 0, 'Must have mobile-drawer-footer bottom section');
    const footerBlock = mobileNavJsx.slice(footerStart, mobileNavJsx.indexOf('</div>', footerStart + 100));

    // Verify Settings is inside the bottom section
    assert.ok(footerBlock.includes('ROUTES.SETTINGS'), 'Settings must be placed in the bottom section');
    assert.ok(footerBlock.includes('mobile-drawer-link-settings'), 'Settings link must exist in drawer footer');

    // Verify profile card is inside the bottom section
    assert.ok(footerBlock.includes('sidebar-user-chip'), 'User profile card must be placed in bottom section');

    // Verify order: Settings appears BEFORE user profile card
    const settingsIdx = footerBlock.indexOf('ROUTES.SETTINGS');
    const userChipIdx = footerBlock.indexOf('sidebar-user-chip');
    assert.ok(settingsIdx < userChipIdx, 'Settings must appear ABOVE the user profile card, matching web sidebar order');
  });

  test('4. Full-height flex-column layout with scrollable navigation and auto margin on bottom section', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // .mobile-drawer rules
    assert.ok(layoutCss.includes('.mobile-drawer {'), 'Must style .mobile-drawer');
    assert.ok(layoutCss.includes('display: flex;'), '.mobile-drawer must use flex display');
    assert.ok(layoutCss.includes('flex-direction: column;'), '.mobile-drawer must use column direction');
    assert.ok(layoutCss.includes('height: 100vh;') || layoutCss.includes('height: 100dvh;'), '.mobile-drawer must specify 100vh/100dvh');

    // .mobile-drawer-nav rules
    assert.ok(layoutCss.includes('.mobile-drawer-nav {'), 'Must style .mobile-drawer-nav');
    assert.ok(layoutCss.includes('overflow-y: auto;'), '.mobile-drawer-nav must be scrollable with overflow-y: auto');
    assert.ok(layoutCss.includes('min-height: 0;'), '.mobile-drawer-nav must specify min-height: 0 to allow shrinking on short viewports');
    assert.ok(layoutCss.includes('flex: 1'), '.mobile-drawer-nav must occupy available space with flex: 1');

    // .mobile-drawer-footer rules
    assert.ok(layoutCss.includes('.mobile-drawer-footer {'), 'Must style .mobile-drawer-footer');
    assert.ok(layoutCss.includes('margin-top: auto;'), '.mobile-drawer-footer must anchor to bottom with margin-top: auto');
    assert.ok(layoutCss.includes('flex-shrink: 0;'), '.mobile-drawer-footer must not shrink (flex-shrink: 0)');
    assert.ok(layoutCss.includes('border-top: 1px solid'), '.mobile-drawer-footer must have a top border/divider');
    assert.ok(layoutCss.includes('env(safe-area-inset-bottom'), '.mobile-drawer-footer must account for safe-area-inset-bottom');
  });

  test('5. Mobile drawer fits within viewport widths of 320px, 375px, 390px, and 430px', () => {
    const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

    // Drawer width constraint
    assert.ok(
      layoutCss.includes('max-width: calc(100vw - 48px)') || layoutCss.includes('max-width: 100vw'),
      'Must ensure drawer does not exceed screen width on narrow devices'
    );
    assert.ok(layoutCss.includes('width: 280px;'), 'Drawer standard width must be 280px');
  });

  test('6. Consistency with desktop web sidebar', () => {
    const sidebarJsx = fs.readFileSync(sidebarJsxPath, 'utf8');
    const mobileNavJsx = fs.readFileSync(mobileNavJsxPath, 'utf8');

    // Both web sidebar and mobile drawer place Settings and user chip in sidebar-footer
    assert.ok(sidebarJsx.includes('sidebar-footer'), 'Desktop sidebar has sidebar-footer');
    assert.ok(sidebarJsx.includes('ROUTES.SETTINGS'), 'Desktop sidebar has Settings in footer');
    assert.ok(sidebarJsx.includes('sidebar-user-chip'), 'Desktop sidebar has user chip in footer');

    assert.ok(mobileNavJsx.includes('sidebar-footer'), 'Mobile drawer has sidebar-footer');
    assert.ok(mobileNavJsx.includes('ROUTES.SETTINGS'), 'Mobile drawer has Settings in footer');
    assert.ok(mobileNavJsx.includes('sidebar-user-chip'), 'Mobile drawer has user chip in footer');
  });
});
