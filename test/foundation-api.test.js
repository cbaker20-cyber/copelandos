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
  assert.ok(result.modules.integrations.count >= 10);
});

test('integration routes expose registry and control loop safely', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.ok(result.integrations.some((integration) => integration.id === 'iphone-shortcuts'));
  assert.ok(result.integrations.every((integration) => !JSON.stringify(integration).includes('some-secret')));

  const controlLoopResponse = await worker.fetch(new Request('https://worker.example/api/integrations/control-loop'), {}, {});
  const controlLoop = await controlLoopResponse.json();
  assert.equal(controlLoopResponse.status, 200);
  assert.ok(controlLoop.architecture.includes('CopelandOS inbox'));
});

test('integration check blocks unsafe operations', async () => {
  const request = new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'gmail-draft', operation: 'send_message' }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});
