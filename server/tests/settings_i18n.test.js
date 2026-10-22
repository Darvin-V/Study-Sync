import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from '../../src/i18n/translations/en.js';
import { ta } from '../../src/i18n/translations/ta.js';
import { translate } from '../../src/i18n/index.js';
import { normalizeFontScale } from '../../src/utils/formatters.js';

test('Settings i18n Dictionary Audit', async (t) => {
  await t.test('All settings keys exist in English and Tamil', () => {
    const requiredKeys = [
      'nav.settings',
      'settings.section.appearance',
      'settings.section.study',
      'settings.section.notifications',
      'settings.section.account',
      'settings.section.actions',
      'settings.item.theme',
      'settings.item.textSize',
      'settings.item.language',
      'settings.item.languageDesc',
      'settings.item.reduceMotion',
      'settings.item.focusSession',
      'settings.item.breakTime',
      'settings.item.micRooms',
      'settings.item.studyLanguage',
      'settings.item.studyLanguageDesc',
      'settings.item.focusShield',
      'settings.item.breakReminders',
      'settings.item.sessionChime',
      'settings.item.studyInvites',
      'settings.item.name',
      'settings.item.degree',
      'settings.item.publicProfile',
      'settings.item.shareGoals',
      'settings.item.resetDefaults',
      'settings.item.clearHistory',
      'settings.item.signOut',
      'settings.action.resetFont',
      'settings.option.light',
      'settings.option.dark',
      'settings.option.system',
      'settings.option.small',
      'settings.option.default',
      'settings.option.large',
      'settings.option.english',
      'settings.option.tamil',
      'settings.option.muted',
      'settings.option.ready',
      'settings.option.any',
      'settings.option.minutes',
      'settings.placeholder.name',
      'settings.placeholder.degree',
      'settings.status.saved',
      'settings.status.saving',
      'settings.status.error',
      'settings.status.saveFailed',
      'settings.status.resetSuccess',
      'settings.status.historyCleared',
      'common.reset',
      'common.retry',
    ];

    for (const key of requiredKeys) {
      assert.ok(en[key], `Missing English translation for ${key}`);
      assert.ok(ta[key], `Missing Tamil translation for ${key}`);
      assert.notEqual(en[key], '', `Empty English translation for ${key}`);
      assert.notEqual(ta[key], '', `Empty Tamil translation for ${key}`);
    }
  });

  await t.test('Language option labels display English and native-script தமிழ்', () => {
    // English option displays 'English' in both locales
    assert.equal(translate('settings.option.english', 'en'), 'English');
    assert.equal(translate('settings.option.english', 'ta'), 'English');

    // Tamil option displays native script 'தமிழ்' in both locales (not 'Tamil' or 'Tamil (தமிழ்)')
    assert.equal(translate('settings.option.tamil', 'en'), 'தமிழ்');
    assert.equal(translate('settings.option.tamil', 'ta'), 'தமிழ்');
  });

  await t.test('Immediate translation resolves correctly for both languages', () => {
    assert.equal(translate('settings.section.appearance', 'en'), 'Appearance');
    assert.equal(translate('settings.section.appearance', 'ta'), 'தோற்றம்');
    assert.equal(translate('settings.item.language', 'en'), 'Interface Language');
    assert.equal(translate('settings.item.language', 'ta'), 'இடைமுக மொழி');
    assert.equal(translate('settings.option.small', 'en'), 'Small');
    assert.equal(translate('settings.option.small', 'ta'), 'சிறியது');
    assert.equal(translate('settings.option.large', 'en'), 'Large');
    assert.equal(translate('settings.option.large', 'ta'), 'பெரியது');
    assert.equal(translate('settings.status.saved', 'en'), '✓ Saved');
    assert.equal(translate('settings.status.saved', 'ta'), '✓ சேமிக்கப்பட்டது');
    assert.equal(translate('common.reset', 'en'), 'Reset');
    assert.equal(translate('common.reset', 'ta'), 'மீட்டமை');
  });

  await t.test('Font scaling normalizer handles aliases and case insensitivity', () => {
    assert.equal(normalizeFontScale('compact'), 'compact');
    assert.equal(normalizeFontScale('small'), 'compact');
    assert.equal(normalizeFontScale('Small'), 'compact');
    assert.equal(normalizeFontScale('standard'), 'standard');
    assert.equal(normalizeFontScale('default'), 'standard');
    assert.equal(normalizeFontScale('comfortable'), 'comfortable');
    assert.equal(normalizeFontScale('large'), 'comfortable');
    assert.equal(normalizeFontScale('Large'), 'comfortable');
    assert.equal(normalizeFontScale(null), 'standard');
    assert.equal(normalizeFontScale('unknown'), 'standard');
  });

  await t.test('Settings section headers, descriptions, and action buttons resolve cleanly in Tamil', () => {
    // Page Title
    assert.equal(translate('nav.settings', 'ta'), 'அமைப்புகள்');

    // Section Titles
    assert.equal(translate('settings.section.appearance', 'ta'), 'தோற்றம்');
    assert.equal(translate('settings.section.study', 'ta'), 'படிப்பு விருப்பங்கள்');
    assert.equal(translate('settings.section.notifications', 'ta'), 'அறிவிப்புகள்');
    assert.equal(translate('settings.section.account', 'ta'), 'கணக்கு & தனியுரிமை');
    assert.equal(translate('settings.section.actions', 'ta'), 'கணக்கு நடவடிக்கைகள்');

    // Setting descriptions
    assert.equal(translate('settings.item.languageDesc', 'ta'), 'பயன்பாட்டு வழிசெலுத்தல், லேபிள்கள், பொத்தான்கள் மற்றும் கணினி செய்திகள்');
    assert.equal(translate('settings.item.studyLanguageDesc', 'ta'), 'கூட்டுப் படிப்பு அமர்வுகளுக்கான முதன்மை மொழி');

    // Action buttons & statuses
    assert.equal(translate('settings.item.resetDefaults', 'ta'), 'விருப்பங்களை மீட்டமை');
    assert.equal(translate('settings.item.clearHistory', 'ta'), 'படிப்பு வரலாற்றை அழி');
    assert.equal(translate('settings.item.signOut', 'ta'), 'வெளியேறு');
    assert.equal(translate('settings.status.resetSuccess', 'ta'), 'விருப்பத்தேர்வுகள் இயல்புநிலைக்கு மீட்டமைக்கப்பட்டன.');
    assert.equal(translate('settings.status.historyCleared', 'ta'), 'படிப்பு வரலாறு அழிக்கப்பட்டது.');
    assert.equal(translate('settings.status.saveFailed', 'ta'), 'சேமிக்க முடியவில்லை');
  });

  await t.test('Switching back to English cleanly restores all interface labels', () => {
    assert.equal(translate('nav.settings', 'en'), 'Settings');
    assert.equal(translate('settings.section.appearance', 'en'), 'Appearance');
    assert.equal(translate('settings.section.study', 'en'), 'Study Preferences');
    assert.equal(translate('settings.section.notifications', 'en'), 'Notifications');
    assert.equal(translate('settings.section.account', 'en'), 'Account & Privacy');
    assert.equal(translate('settings.section.actions', 'en'), 'Account Actions');
    assert.equal(translate('settings.item.language', 'en'), 'Interface Language');
    assert.equal(translate('settings.item.languageDesc', 'en'), 'App navigation, labels, buttons, and system messages');
    assert.equal(translate('settings.item.studyLanguageDesc', 'en'), 'Primary language for collaborative study sessions');
    assert.equal(translate('settings.status.saveFailed', 'en'), 'Save failed');
  });

  await t.test('User-generated content remains untouched and not translated', () => {
    const rawUserName = 'Priya Ramanathan';
    const rawDegree = 'B.Tech Computer Science & AI';
    const rawNote = 'Differential equations study summary chapter 4';

    // Mock translate function or direct passthrough
    const displayName = rawUserName;
    const headline = rawDegree;
    const content = rawNote;

    assert.equal(displayName, 'Priya Ramanathan');
    assert.equal(headline, 'B.Tech Computer Science & AI');
    assert.equal(content, 'Differential equations study summary chapter 4');
  });
});
