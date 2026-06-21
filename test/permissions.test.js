import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRisk, evaluatePermission, RISK } from '../src/permissions.js';

test('permission engine classifies representative actions', () => {
  assert.equal(classifyRisk('read status'), RISK.SAFE);
  assert.equal(classifyRisk('create Gmail draft'), RISK.MEDIUM);
  assert.equal(classifyRisk('merge PR'), RISK.HIGH);
  assert.equal(classifyRisk('unknown dangerous thing'), RISK.HIGH);
});

test('high-risk actions remain blocked even when confirmed', () => {
  const result = evaluatePermission('send_email', { confirmed: true });
  assert.equal(result.allowed, false);
  assert.equal(result.confirmation_required, true);
  assert.equal(result.risk, RISK.HIGH);
});

test('medium-risk actions require confirmation', () => {
  assert.equal(evaluatePermission('run_approved_test').allowed, false);
  assert.equal(evaluatePermission('run_approved_test', { confirmed: true }).allowed, true);
});
