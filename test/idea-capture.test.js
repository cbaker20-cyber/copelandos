import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import worker from '../worker.js';
import { _clearInbox } from '../src/ideaStore.js';

beforeEach(() => _clearInbox());

function makeRequest(path, options = {}) {
  const url = `https://worker.example${path}`;
  return new Request(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
}

async function postIdea(body, env = {}) {
  const request = makeRequest('/api/capture/idea', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const response = await worker.fetch(request, env, {});
  return { response, data: await response.json() };
}

test('capture valid idea returns 201 with classified idea', async () => {
  const { response, data } = await postIdea({
    text: 'fix the JazzBackend rhythm triplet test',
    source: 'siri',
    tags: ['mobile', 'jazzbackend'],
  });
  assert.equal(response.status, 201);
  assert.equal(data.ok, true);
  assert.ok(data.idea.id, 'idea should have an id');
  assert.equal(data.idea.status, 'new');
  assert.equal(data.idea.source, 'siri');
  assert.ok(Array.isArray(data.idea.tags));
  assert.ok(data.idea.createdAt);
  assert.ok(data.idea.updatedAt);
  assert.ok(data.classification);
});

test('reject empty idea text returns 400', async () => {
  const { response, data } = await postIdea({ text: '', source: 'manual' });
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.ok(data.error.toLowerCase().includes('required'));
});

test('reject missing text field returns 400', async () => {
  const { response, data } = await postIdea({ source: 'manual' });
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test('reject oversized idea text returns 400', async () => {
  const { response, data } = await postIdea({ text: 'x'.repeat(5001), source: 'manual' });
  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.ok(data.error.toLowerCase().includes('exceed') || data.error.toLowerCase().includes('character'));
});

test('idea is saved with a safe non-empty id', async () => {
  const { data } = await postIdea({ text: 'remember catalase lab analysis notes', source: 'manual' });
  assert.ok(data.idea.id);
  assert.ok(typeof data.idea.id === 'string');
  assert.ok(data.idea.id.length > 0);
  assert.ok(!data.idea.id.includes('..'));
  assert.ok(!data.idea.id.includes('/'));
});

test('idea source defaults to manual when invalid source provided', async () => {
  const { data } = await postIdea({ text: 'test idea', source: 'unknown-source' });
  assert.equal(data.idea.source, 'manual');
});

test('valid sources are accepted', async () => {
  const sources = ['siri', 'shortcuts', 'mobile-web', 'dashboard', 'manual'];
  for (const source of sources) {
    const { response, data } = await postIdea({ text: `test from ${source}`, source });
    assert.equal(response.status, 201, `source '${source}' should be accepted`);
    assert.equal(data.idea.source, source);
  }
});

test('GET /api/ideas returns idea list', async () => {
  // First capture an idea
  await postIdea({ text: 'list test idea', source: 'manual' });
  const response = await worker.fetch(makeRequest('/api/ideas'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.ideas));
  assert.ok(typeof data.total === 'number');
});

test('GET /api/ideas/:id returns a specific idea', async () => {
  const { data: created } = await postIdea({ text: 'get by id test', source: 'manual' });
  const id = created.idea.id;
  const response = await worker.fetch(makeRequest(`/api/ideas/${id}`), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.idea.id, id);
  assert.equal(data.idea.text, 'get by id test');
});

test('GET /api/ideas/:id returns 404 for unknown id', async () => {
  const response = await worker.fetch(makeRequest('/api/ideas/nonexistent-id-999'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 404);
  assert.equal(data.ok, false);
});

test('POST /api/ideas/:id/triage updates idea status', async () => {
  const { data: created } = await postIdea({ text: 'triage test idea', source: 'manual' });
  const id = created.idea.id;
  const triageReq = makeRequest(`/api/ideas/${id}/triage`, {
    method: 'POST',
    body: JSON.stringify({ status: 'triaged', riskLevel: 'safe' }),
  });
  const response = await worker.fetch(triageReq, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.idea.status, 'triaged');
});

test('POST /api/capture/idea classifies coding tasks correctly', async () => {
  const { data } = await postIdea({ text: 'fix the bug in the authentication module', source: 'manual' });
  assert.equal(data.ok, true);
  assert.equal(data.classification.category, 'coding');
});

test('POST /api/capture/idea classifies email tasks as medium risk', async () => {
  const { data } = await postIdea({ text: 'email Mr. Welgoss about NHS eligibility', source: 'siri' });
  assert.equal(data.ok, true);
  assert.equal(data.classification.category, 'email');
  assert.equal(data.classification.riskLevel, 'medium');
  assert.equal(data.classification.confirmationRequired, true);
});

test('POST /api/capture/idea flags deploy as high risk', async () => {
  const { data } = await postIdea({ text: 'deploy this to Cloudflare now', source: 'manual' });
  assert.equal(data.ok, true);
  assert.equal(data.classification.riskLevel, 'high');
  assert.equal(data.classification.confirmationRequired, true);
});

test('POST /api/capture/idea flags delete files as high risk', async () => {
  const { data } = await postIdea({ text: 'delete all files in the temp directory', source: 'manual' });
  assert.equal(data.ok, true);
  assert.equal(data.classification.riskLevel, 'high');
});

test('POST /api/ideas/:id/cursor-prompt generates a prompt', async () => {
  const { data: created } = await postIdea({ text: 'implement a new API endpoint for idea capture', source: 'manual' });
  const id = created.idea.id;
  const promptReq = makeRequest(`/api/ideas/${id}/cursor-prompt`, {
    method: 'POST',
    body: JSON.stringify({ project: 'copelandos' }),
  });
  const response = await worker.fetch(promptReq, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(typeof data.prompt === 'string');
  assert.ok(data.prompt.length > 0);
  assert.equal(data.kind, 'cursor');
  assert.equal(data.idea.status, 'ready-for-cursor');
});

test('POST /api/ideas/:id/codex-prompt generates a prompt', async () => {
  const { data: created } = await postIdea({ text: 'review the architecture of the vault module', source: 'manual' });
  const id = created.idea.id;
  const promptReq = makeRequest(`/api/ideas/${id}/codex-prompt`, {
    method: 'POST',
    body: JSON.stringify({ project: 'copelandos' }),
  });
  const response = await worker.fetch(promptReq, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(typeof data.prompt === 'string');
  assert.equal(data.kind, 'codex');
});

test('Cursor prompt includes repo, constraints, and forbidden actions', async () => {
  const { data: created } = await postIdea({ text: 'add new feature to JazzBackend', source: 'manual' });
  const id = created.idea.id;
  const promptReq = makeRequest(`/api/ideas/${id}/cursor-prompt`, {
    method: 'POST',
    body: JSON.stringify({ project: 'jazz-backend' }),
  });
  const response = await worker.fetch(promptReq, {}, {});
  const data = await response.json();
  assert.ok(data.prompt.includes('cbaker20-cyber/JazzBackend'));
  assert.ok(data.prompt.toLowerCase().includes('forbidden') || data.prompt.toLowerCase().includes('constraints'));
});

test('capture returns an honest mock vault note when vault env is absent', async () => {
  const { response, data } = await postIdea({ text: 'remember catalase lab analysis notes', source: 'shortcuts' });
  assert.equal(response.status, 201);
  assert.equal(data.vault.ideaNote.connected, false);
  assert.equal(data.vault.ideaNote.mode, 'mock');
  assert.match(data.vault.ideaNote.path, /CopelandVault\/Inbox\/idea-/);
  assert.match(data.vault.dailyAppend, /Captured idea/);
});

test('GET /api/ideas/stats returns inbox counts', async () => {
  await postIdea({ text: 'email Mr. Welgoss about NHS', source: 'siri' });
  await postIdea({ text: 'deploy this to Cloudflare', source: 'manual' });
  const response = await worker.fetch(makeRequest('/api/ideas/stats'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.stats.total, 2);
  assert.equal(data.stats.confirmationRequired, 2);
  assert.equal(data.stats.byRisk.high, 1);
});

test('GET /api/brain/status exposes the working scaffold without execution', async () => {
  const response = await worker.fetch(makeRequest('/api/brain/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.status.executesActionsAutomatically, false);
  assert.ok(data.status.stages.some((stage) => stage.id === 'task-prompts'));
});

test('POST /api/ideas/:id/plan marks idea planned and returns brief', async () => {
  const { data: created } = await postIdea({ text: 'plan the CopelandOS mobile capture dashboard', source: 'dashboard' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/plan`, {
    method: 'POST',
    body: JSON.stringify({}),
  }), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'planned');
  assert.ok(data.plan.steps.length > 0);
  assert.ok(data.brief.title);
});

test('POST /api/ideas/:id/dismiss marks idea dismissed', async () => {
  const { data: created } = await postIdea({ text: 'low priority someday idea', source: 'manual' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/dismiss`, {
    method: 'POST',
    body: '{}',
  }), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'dismissed');
});

test('project queue groups captured ideas by configured project', async () => {
  await postIdea({ text: 'fix JazzBackend rhythm tests', source: 'siri' });
  await postIdea({ text: 'improve CopelandOS brain pipeline UI', source: 'dashboard' });
  const response = await worker.fetch(makeRequest('/api/project-queue'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.ok(data.queues.some((queue) => queue.projectId === 'jazz-backend'));
  assert.ok(data.queues.some((queue) => queue.projectId === 'copelandos'));
});

test('orchestration status is scaffolded and does not execute actions', async () => {
  const response = await worker.fetch(makeRequest('/api/orchestration/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.executesActions, false);
  assert.match(data.safety, /No deploys/i);
});

test('convert accepts explicit note type aliases', async () => {
  const { data: created } = await postIdea({ text: 'make this a task list for CopelandOS', project: 'copelandos' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ type: 'task-list' }),
  }), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.document.type, 'tasks');
  assert.equal(data.idea.status, 'converted-to-note');
});

test('Cursor prompt generation includes required handoff sections', async () => {
  const { data: created } = await postIdea({ text: 'build safe provider status panel', source: 'manual' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/cursor-prompt`, {
    method: 'POST',
    body: JSON.stringify({ project: 'copelandos' }),
  }), {}, {});
  const data = await response.json();
  for (const section of ['REPO:', 'ISSUE OR IDEA ID:', 'GOAL:', 'FILES TO INSPECT:', 'TESTS TO RUN:', 'DRAFT PR TITLE:', 'FORBIDDEN ACTIONS:']) {
    assert.ok(data.prompt.includes(section), `missing ${section}`);
  }
});
