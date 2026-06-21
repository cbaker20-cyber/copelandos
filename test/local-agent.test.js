import assert from 'node:assert/strict';
import test from 'node:test';

import { validateActionRequest } from '../local-agent/actions.js';

const allowlist = {
  allowedUrlOrigins: ['https://github.com'],
  repositories: [{
    id: 'copelandos',
    path: 'C:\\safe\\copelandos',
    testCommands: [{ id: 'tests', command: 'npm.cmd', args: ['test'] }],
  }],
  vault: { enabled: false },
};

test('local agent permits allowlisted URLs and blocks other origins', () => {
  assert.equal(validateActionRequest('open_url', { url: 'https://github.com/cbaker20-cyber' }, allowlist).allowed, true);
  assert.equal(validateActionRequest('open_url', { url: 'https://evil.example' }, allowlist).allowed, false);
});

test('local agent test commands require confirmation and exact allowlist match', () => {
  assert.equal(validateActionRequest('run_approved_test', { repoId: 'copelandos', testId: 'tests' }, allowlist).confirmation_required, true);
  assert.equal(validateActionRequest('run_approved_test', { repoId: 'copelandos', testId: 'tests' }, allowlist, { confirmed: true }).allowed, true);
  assert.equal(validateActionRequest('run_approved_test', { repoId: 'copelandos', testId: 'other' }, allowlist, { confirmed: true }).allowed, false);
});

test('local agent never permits arbitrary shell', () => {
  const result = validateActionRequest('arbitrary_shell', { command: 'whoami' }, allowlist, { confirmed: true });
  assert.equal(result.allowed, false);
  assert.equal(result.risk, 'HIGH');
});
