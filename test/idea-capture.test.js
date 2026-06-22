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

function makeKv() {
  const store = new Map();
  return {
    async get(key, type) {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) {
      store.set(key, value);
    },
    store,
  };
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

test('capture supports single tag and KV-backed inbox storage', async () => {
  const kv = makeKv();
  const env = { IDEAS_KV: kv };
  const { data: created } = await postIdea({
    text: 'remember catalase lab analysis',
    source: 'shortcuts',
    tag: 'Lab Notes',
  }, env);
  assert.equal(created.storage.inbox, 'kv');
  assert.equal(created.storage.durable, true);
  assert.ok(created.idea.tags.includes('lab-notes'));

  const response = await worker.fetch(makeRequest('/api/ideas'), env, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ideas.some(idea => idea.id === created.idea.id), true);
});

test('idea stats reports storage mode honestly', async () => {
  const kv = makeKv();
  const env = { IDEA_INBOX: kv };
  await postIdea({ text: 'queue this CopelandOS idea', source: 'manual', project: 'copelandos' }, env);
  const response = await worker.fetch(makeRequest('/api/ideas/stats'), env, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.storage.mode, 'kv');
  assert.equal(data.storage.durable, true);
  assert.ok(data.byProject.copelandos >= 1);
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

test('POST /api/ideas/:id/plan marks idea planned without execution', async () => {
  const { data: created } = await postIdea({ text: 'make a plan for CopelandOS dashboard polish', source: 'manual' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/plan`, {
    method: 'POST',
    body: JSON.stringify({}),
  }), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'planned');
  assert.ok(Array.isArray(data.plan.steps));
});

test('POST /api/ideas/:id/dismiss dismisses without execution', async () => {
  const { data: created } = await postIdea({ text: 'dismiss this idea later', source: 'manual' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/dismiss`, {
    method: 'POST',
    body: JSON.stringify({}),
  }), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'dismissed');
  assert.equal(data.execute, false);
});

test('POST /api/ideas/:id/convert supports daily note append', async () => {
  const { data: created } = await postIdea({ text: 'remember this on today daily note', source: 'manual' });
  const response = await worker.fetch(makeRequest(`/api/ideas/${created.idea.id}/convert`, {
    method: 'POST',
    body: JSON.stringify({ type: 'daily' }),
  }), {}, {});
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.idea.status, 'converted-to-note');
  assert.equal(data.document.type, 'daily');
  assert.equal(data.document.append, true);
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
