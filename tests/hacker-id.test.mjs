import test from 'node:test';
import assert from 'node:assert/strict';
import { generateHackerId, normalizeHackerId } from '../src/lib/hacker-id.ts';

test('new Hacker IDs use H- with seven digits and normalize unchanged', () => {
  for (let i = 0; i < 100; i++) {
    const id = generateHackerId();
    assert.match(id, /^H-[1-9][0-9]{6}$/);
    assert.equal(normalizeHackerId(id), id);
  }
});

test('manual check-in normalizes current, legacy, and numeric shorthand IDs', () => {
  for (const input of ['H-1234567', 'h-1234567', 'h 1234567', 'HH-1234567', 'hh 1234567', '1234567', ' HH-1234567 ']) {
    assert.equal(normalizeHackerId(input), 'H-1234567', input);
  }
});

test('malformed IDs and unrelated prefixes are rejected', () => {
  for (const input of ['', '123456', '12345678', 'H-123456a', 'ABC-1234567', 'HHH-1234567', 'H-123 4567', 'HKP_1234567']) {
    assert.equal(normalizeHackerId(input), null, input);
  }
});
