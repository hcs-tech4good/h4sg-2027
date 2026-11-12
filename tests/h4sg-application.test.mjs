import test from 'node:test';
import assert from 'node:assert/strict';
import { H4SG_FIELDS, validateH4sgDetails, wordCount, isH4sgFieldVisible } from '../src/lib/h4sg-application.ts';

function validAnswers() {
  const answers = {};
  for (const f of H4SG_FIELDS) {
    if (f.when || f.kind === 'teammates') continue;
    answers[f.key] = f.kind === 'multi' ? [f.options[0]] : f.options?.[0] ?? 'An answer';
  }
  answers.school_email = 'student@example.edu';
  return answers;
}

test('complete application accepts photography opt-out and no preferred teammates', () => {
  const details = { ...validAnswers(), photo_consent: 'I do not consent' };
  assert.equal(validateH4sgDetails(details).error, undefined);
});

test('requires an answer to every nonconditional source question', () => {
  for (const field of H4SG_FIELDS.filter((f) => !f.when && f.kind !== 'teammates')) {
    const details = validAnswers();
    delete details[field.key];
    assert.ok(validateH4sgDetails(details).error, field.key);
  }
});

test('conditional attendance, individual-team, sharing, and Other answers are required only when relevant', () => {
  for (const [key, value, dependent] of [
    ['full_attendance', 'No', 'attendance_explanation'],
    ['application_mode', 'Individually', 'individual_plan'],
    ['sponsor_sharing', 'Other', 'sponsor_sharing_other'],
    ['tools', ['Other'], 'tools_other'],
    ['referral_sources', ['Other'], 'referral_other'],
  ]) {
    const details = { ...validAnswers(), [key]: value };
    assert.ok(validateH4sgDetails(details).error, dependent);
    details[dependent] = dependent === 'individual_plan' ? 'Group' : 'Explanation';
    assert.equal(validateH4sgDetails(details).error, undefined, dependent);
  }
});

test('enforces 150- and 100-word essay limits without truncating drafts', () => {
  for (const key of ['built_project', 'social_issue', 'team_contribution', 'social_impact_idea']) {
    const limit = key === 'social_impact_idea' ? 100 : 150;
    const details = { ...validAnswers(), [key]: 'word '.repeat(limit).trim() };
    assert.equal(validateH4sgDetails(details).error, undefined);
    details[key] += ' extra';
    assert.match(validateH4sgDetails(details).error, /words or fewer/);
  }
  assert.equal(wordCount('  one\n two\tthree  '), 3);
  assert.equal(wordCount('  '), 0);
});

test('rejects underage declarations, invalid email, choices, data shapes, and more than three teammates', () => {
  for (const overrides of [
    { over_18: 'No' }, { school_email: 'invalid' }, { coding_ability: '11' },
    { photo_consent: 'unknown' }, { tools: 'Python' },
    { preferred_teammates: ['A', 'B', 'C', 'D'] }, { unknown_field: 'x' },
  ]) assert.ok(validateH4sgDetails({ ...validAnswers(), ...overrides }).error);
  for (const invalid of [null, [], 'text']) assert.ok(validateH4sgDetails(invalid).error);
});

test('individual applicants do not display group teammate fields', () => {
  const f = H4SG_FIELDS.find((f) => f.key === 'preferred_teammates');
  assert.equal(isH4sgFieldVisible(f, { application_mode: 'Individually' }), false);
  assert.equal(isH4sgFieldVisible(f, { application_mode: 'Group' }), true);
});
