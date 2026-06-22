import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../worker.js';

test('foundation exposes the project registry', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/projects'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.projects.length, 5);
  assert.equal(result.projects.some((project) => project.id === 'copelandos'), true);
});

test('high-risk remote actions return confirmation_required without execution', async () => {
  const request = new Request('https://worker.example/api/remote/request-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send_email', confirmed: true }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();
  assert.equal(response.status, 409);
  assert.equal(result.ok, false);
  assert.equal(result.confirmation_required, true);
  assert.equal(result.risk, 'HIGH');
});

test('system status never fakes disconnected integrations', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/status'), {}, {});
  const result = await response.json();
  assert.equal(result.complete, false);
  assert.equal(result.modules.gmail.connected, false);
  assert.equal(result.modules.localAgent.connected, false);
  assert.equal(result.modules.githubSupervisor.connected, false);
  assert.equal(result.modules.integrations.connected, false);
  assert.ok(result.modules.integrations.total >= 7);
});

test('foundation exposes integration registry without live connection claims', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.ok(result.integrations.some((integration) => integration.id === 'ios-shortcuts'));
  assert.ok(result.summary.flow.includes('draft PR'));
  assert.equal(result.integrations.every((integration) => integration.connected === false), true);
});

test('foundation exposes individual integration status', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/safe-tool-mcp-registry'), {}, {});
  const result = await response.json();

  assert.equal(response.status, 200);
  assert.equal(result.integration.id, 'safe-tool-mcp-registry');
  assert.equal(result.integration.configured, true);
  assert.equal(result.integration.connected, false);
});
