import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import worker from '../worker.js';
import { _clearInbox } from '../src/ideaStore.js';

beforeEach(() => {
  _clearInbox();
});

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
  assert.ok(data.vault.ideaNote);
  assert.equal(data.vault.ideaNote.mode, 'mock');
  assert.ok(data.vault.dailyAppend);
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

test('POST /api/ideas/:id/plan marks idea planned and returns plan', async () => {
  const { data: created } = await postIdea({ text: 'plan the CopelandOS idea inbox polish', source: 'manual' });
  const id = created.idea.id;
  const planReq = makeRequest(`/api/ideas/${id}/plan`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  const response = await worker.fetch(planReq, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.idea.status, 'planned');
  assert.ok(Array.isArray(data.plan.steps));
});

test('POST /api/ideas/:id/dismiss archives idea without deleting it', async () => {
  const { data: created } = await postIdea({ text: 'dismiss this test idea', source: 'manual' });
  const id = created.idea.id;
  const dismissReq = makeRequest(`/api/ideas/${id}/dismiss`, { method: 'POST', body: '{}' });
  const response = await worker.fetch(dismissReq, {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'dismissed');

  const getResponse = await worker.fetch(makeRequest(`/api/ideas/${id}`), {}, {});
  const getData = await getResponse.json();
  assert.equal(getData.idea.id, id);
  assert.equal(getData.idea.status, 'dismissed');
});

test('GET /api/ideas/stats returns counts by status and risk', async () => {
  await postIdea({ text: 'deploy this later after review', source: 'manual' });
  await postIdea({ text: 'remember catalase lab analysis', source: 'siri' });
  const response = await worker.fetch(makeRequest('/api/ideas/stats'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.stats.total, 2);
  assert.equal(data.stats.byRisk.high, 1);
  assert.equal(data.stats.byStatus.new, 2);
});

test('GET /api/project-queue groups ideas by inferred project', async () => {
  const { data: created } = await postIdea({ text: 'fix JazzBackend rhythm tests', source: 'manual' });
  await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/cursor-prompt`, {
    method: 'POST',
    body: JSON.stringify({ project: 'jazz-backend' }),
  }), {}, {});
  const response = await worker.fetch(makeRequest('/api/project-queue'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  const jazzQueue = data.queues.find(queue => queue.projectId === 'jazz-backend');
  assert.ok(jazzQueue);
  assert.equal(jazzQueue.readyForCursor.length, 1);
});

test('GET /api/brain/status reports honest scaffold state', async () => {
  await postIdea({ text: 'remember catalase lab analysis', source: 'siri' });
  const response = await worker.fetch(makeRequest('/api/brain/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.safety.automaticExecution, false);
  assert.ok(data.pipeline.some(step => step.id === 'provider-router'));
  assert.equal(data.providers.some(provider => provider.configured), false);
});

test('GET /api/orchestration/status returns project queue summary', async () => {
  await postIdea({ text: 'build CopelandOS mobile dashboard panel', source: 'manual' });
  const response = await worker.fetch(makeRequest('/api/orchestration/status'), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.ok(Array.isArray(data.projectQueues));
  assert.ok(data.constraints.some(item => item.includes('not executed automatically')));
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

test('Cursor prompt includes required task-generation sections', async () => {
  const { data: created } = await postIdea({ text: 'improve CopelandOS provider router tests', source: 'manual' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/cursor-prompt`, {
    method: 'POST',
    body: JSON.stringify({ project: 'copelandos' }),
  }), {}, {});
  const data = await response.json();
  for (const section of ['REPO:', 'ISSUE OR IDEA ID:', 'GOAL:', 'FILES TO INSPECT:', 'CONSTRAINTS:', 'SAFETY RULES:', 'TESTS TO RUN:', 'DRAFT PR TITLE:', 'FORBIDDEN ACTIONS:']) {
    assert.ok(data.prompt.includes(section), `missing ${section}`);
  }
});

test('convert accepts requested vault note aliases', async () => {
  const { data: created } = await postIdea({ text: 'make this a decision log', source: 'manual' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ type: 'decision-log' }),
  }), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'converted-to-note');
  assert.match(data.document.path, /^Decisions\//);
  assert.equal(data.vault.mode, 'mock');
});
