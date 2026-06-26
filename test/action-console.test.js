import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';

test('Worker root serves the usable CopelandOS console', async () => {
  const response = await worker.fetch(new Request('https://worker.example/'), {}, {});
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /text\/html/);
  assert.match(html, /CopelandOS/);
  assert.match(html, /Create Gmail draft/);
  assert.match(html, /Save \/ preview note/);
  assert.match(html, /api\/capture\/idea/);
});

test('Hermes routes Mimo-style learning without tool execution', async () => {
  const request = new Request('https://worker.example/api/hermes/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'Use Mimo to teach me the Worker routing code', source: 'console' }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.agent, 'hermes');
  assert.equal(result.mode, 'router-only');
  assert.equal(result.route, 'mimo_learning_plan');
  assert.equal(result.providerRecommendation.primary, 'mimo-scaffold');
  assert.equal(result.providerRecommendation.connected, false);
  assert.ok(result.blockedActions.includes('send_email'));
  assert.ok(result.blockedActions.includes('merge_pr'));
});

test('Hermes blocks high-risk automation and produces a review prompt', async () => {
  const request = new Request('https://worker.example/api/hermes/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task: 'deploy and merge the PR then send email', source: 'console' }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.risk.level, 'high');
  assert.equal(result.requiresHumanApproval, true);
  assert.match(result.cursorPrompt, /Do not send email, merge PRs, deploy/);
});

test('Obsidian compatibility save uses safe mock vault path without credentials', async () => {
  const request = new Request('https://worker.example/api/obsidian/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'Console Note',
      folder: 'Inbox',
      content: 'Safe markdown note',
      agent: 'console',
      tags: ['test'],
    }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'mock');
  assert.equal(result.connected, false);
  assert.match(result.path, /^CopelandVault\/Inbox\/Console-Note\.md$/);
  assert.equal(result.permission.allowed, true);
});

test('Obsidian compatibility save blocks secrets and private student data', async () => {
  const secretRequest = new Request('https://worker.example/api/obsidian/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Bad', content: `sk-${'a'.repeat(30)}` }),
  });
  const secretResponse = await worker.fetch(secretRequest, {}, {});
  const secretResult = await secretResponse.json();
  assert.equal(secretResponse.status, 400);
  assert.match(secretResult.error, /secret/i);

  const studentRequest = new Request('https://worker.example/api/obsidian/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Student', content: 'Student ID should not be stored here.' }),
  });
  const studentResponse = await worker.fetch(studentRequest, {}, {});
  const studentResult = await studentResponse.json();
  assert.equal(studentResponse.status, 400);
  assert.match(studentResult.error, /private student data/i);
});

test('optional capture token protects public Shortcut intake when configured', async () => {
  const request = new Request('https://worker.example/api/capture/idea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Shortcut capture test', source: 'ios-shortcuts' }),
  });
  const blocked = await worker.fetch(request, { CAPTURE_TOKEN: 'secret-capture-token' }, {});
  assert.equal(blocked.status, 401);

  const allowed = await worker.fetch(new Request('https://worker.example/api/capture/idea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret-capture-token' },
    body: JSON.stringify({ text: 'Shortcut capture test', source: 'ios-shortcuts' }),
  }), { CAPTURE_TOKEN: 'secret-capture-token' }, {});
  const result = await allowed.json();
  assert.equal(allowed.status, 201);
  assert.equal(result.ok, true);
  assert.equal(result.idea.source, 'ios-shortcuts');
});
