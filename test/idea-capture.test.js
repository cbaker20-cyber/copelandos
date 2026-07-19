import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';
import { bearerAuthHeaders, withApiAuth } from './helpers/auth.js';

function makeRequest(path, options = {}) {
  const url = `https://worker.example${path}`;
  return new Request(url, {
    headers: { 'Content-Type': 'application/json', ...bearerAuthHeaders(), ...options.headers },
    ...options,
  });
}

async function postIdea(body, env = {}) {
  const request = makeRequest('/api/capture/idea', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const response = await worker.fetch(request, withApiAuth(env), {});
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
  assert.equal(data.vault.ideaNote.mode, 'mock');
  assert.equal(data.vault.dailyAppend.mode, 'mock');
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

test('single tag and project fields are sanitized on capture', async () => {
  const { data } = await postIdea({
    text: 'remember catalase lab analysis',
    source: 'shortcuts',
    tag: 'Mobile Idea!',
    project: '../unsafe/project',
  });
  assert.deepEqual(data.idea.tags, ['mobile-idea']);
  assert.equal(data.idea.project, null);
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

test('GET /api/ideas/stats and /api/project-queue summarize inbox', async () => {
  await postIdea({ text: 'queue this CopelandOS idea', source: 'manual', project: 'copelandos' });
  const statsResponse = await worker.fetch(makeRequest('/api/ideas/stats'), {}, {});
  const stats = await statsResponse.json();
  assert.equal(statsResponse.status, 200);
  assert.ok(stats.stats.total >= 1);

  const queueResponse = await worker.fetch(makeRequest('/api/project-queue'), {}, {});
  const queue = await queueResponse.json();
  assert.equal(queueResponse.status, 200);
  assert.ok(Array.isArray(queue.queues.copelandos));
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

test('POST /api/ideas/:id/plan and dismiss update idea status without execution', async () => {
  const { data: created } = await postIdea({ text: 'plan a safe docs update', source: 'manual' });
  const id = created.idea.id;
  const planResponse = await worker.fetch(makeRequest(`/api/ideas/${id}/plan`, {
    method: 'POST',
    body: JSON.stringify({}),
  }), {}, {});
  const planned = await planResponse.json();
  assert.equal(planResponse.status, 200);
  assert.equal(planned.idea.status, 'planned');
  assert.ok(planned.plan.steps.length > 0);

  const dismissResponse = await worker.fetch(makeRequest(`/api/ideas/${id}/dismiss`, {
    method: 'POST',
    body: '{}',
  }), {}, {});
  const dismissed = await dismissResponse.json();
  assert.equal(dismissResponse.status, 200);
  assert.equal(dismissed.idea.status, 'dismissed');
});

test('POST /api/ideas/:id/convert accepts requested note type aliases', async () => {
  const { data: created } = await postIdea({ text: 'capture a research note about catalase', source: 'manual' });
  const id = created.idea.id;
  const convertReq = makeRequest(`/api/ideas/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ type: 'research-note' }),
  });
  const response = await worker.fetch(convertReq, withApiAuth(), {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'converted-to-note');
  assert.match(data.document.path, /^Research\//);
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

test('brain and orchestration status endpoints are honest scaffolds', async () => {
  const brainResponse = await worker.fetch(makeRequest('/api/brain/status'), {}, {});
  const brain = await brainResponse.json();
  assert.equal(brainResponse.status, 200);
  assert.equal(brain.execution, 'disabled');
  assert.equal(brain.council, 'mock-mode');

  const orchestrationResponse = await worker.fetch(makeRequest('/api/orchestration/status'), {}, {});
  const orchestration = await orchestrationResponse.json();
  assert.equal(orchestrationResponse.status, 200);
  assert.equal(orchestration.automaticExecution, false);
  assert.equal(orchestration.mode, 'orchestration-registry');
  assert.ok(orchestration.pipeline.includes('agent orchestration registry'));
  assert.ok(orchestration.agents.length >= 6);
});
