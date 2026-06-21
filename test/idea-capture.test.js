import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';

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

// ── Stats endpoint ─────────────────────────────────────────────────────

test('GET /api/ideas/stats returns statistics object', async () => {
  // Capture at least one idea to ensure non-zero state
  await postIdea({ text: 'stats test idea', source: 'manual' });
  const request = makeRequest('/api/ideas/stats', { method: 'GET' });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.stats);
  assert.ok(typeof data.stats.total === 'number');
  assert.ok(typeof data.stats.confirmationRequired === 'number');
  assert.ok(data.stats.byStatus);
  assert.ok(data.stats.byCategory);
  assert.ok(data.stats.byRisk);
});

test('GET /api/ideas/stats total reflects captured ideas', async () => {
  const before = await (await worker.fetch(makeRequest('/api/ideas/stats', { method: 'GET' }), {}, {})).json();
  await postIdea({ text: 'another idea for stats', source: 'manual' });
  const after = await (await worker.fetch(makeRequest('/api/ideas/stats', { method: 'GET' }), {}, {})).json();
  assert.ok(after.stats.total >= before.stats.total + 1);
});

// ── Dismiss endpoint ───────────────────────────────────────────────────

test('POST /api/ideas/:id/dismiss marks idea as dismissed', async () => {
  const { data: created } = await postIdea({ text: 'dismiss this idea', source: 'manual' });
  const id = created.idea.id;
  const request = makeRequest(`/api/ideas/${id}/dismiss`, { method: 'POST', body: JSON.stringify({}) });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.idea.status, 'dismissed');
});

test('POST /api/ideas/:id/dismiss returns 404 for unknown id', async () => {
  const request = makeRequest('/api/ideas/nonexistent-id-xyz/dismiss', { method: 'POST', body: JSON.stringify({}) });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 404);
  assert.equal(data.ok, false);
});

// ── Brain status endpoint ──────────────────────────────────────────────

test('GET /api/brain/status returns pipeline status', async () => {
  const request = makeRequest('/api/brain/status', { method: 'GET' });
  const response = await worker.fetch(request, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(data.status);
  assert.ok(Array.isArray(data.status.stages));
  assert.ok(data.status.stages.length > 0);
  assert.ok(data.status.summary);
  assert.ok(data.status.generatedAt);
});

test('GET /api/brain/status stages all have id, name, and status', async () => {
  const request = makeRequest('/api/brain/status', { method: 'GET' });
  const response = await worker.fetch(request, {}, {});
  const { data } = { data: await response.json() };
  for (const stage of data.status.stages) {
    assert.ok(stage.id, `Stage missing id: ${JSON.stringify(stage)}`);
    assert.ok(stage.name, `Stage missing name: ${JSON.stringify(stage)}`);
    assert.ok(stage.status, `Stage missing status: ${JSON.stringify(stage)}`);
  }
});

// ── Urgency in classification ──────────────────────────────────────────

test('captured idea includes urgency field from classifier', async () => {
  const { data } = await postIdea({ text: 'urgent: fix production bug ASAP', source: 'manual' });
  assert.ok('urgency' in data.idea, 'idea should have urgency field');
  assert.equal(data.classification.urgency, 'high');
});

test('idea with low-priority keywords gets low urgency', async () => {
  const { data } = await postIdea({ text: 'someday I should reorganize my notes backlog', source: 'manual' });
  assert.equal(data.classification.urgency, 'low');
});

test('idea with explicit urgency field respects it', async () => {
  const { data } = await postIdea({ text: 'general task', source: 'manual', urgency: 'high' });
  assert.ok(data.idea.urgency === 'high');
});

// ── Vault note on capture ──────────────────────────────────────────────

test('captured idea includes vault note path in mock mode', async () => {
  const { data } = await postIdea({ text: 'remember to update the readme file', source: 'manual' });
  assert.ok(data.idea._vaultNote, 'captured idea should include _vaultNote');
  assert.ok(data.idea._vaultNote.path, '_vaultNote should have a path');
  assert.equal(data.idea._vaultNote.mode, 'mock');
});
