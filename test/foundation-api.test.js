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
  assert.equal(result.modules.integrations.connected, true);
  assert.ok(result.modules.integrations.safetyBoundary.includes('no live connection is implied'));
});

test('integration routes expose control loop without execution', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/control-loop'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.dispatchPolicy.automaticExecution, false);
  assert.equal(result.dispatchPolicy.draftPrOnly, true);
  assert.ok(result.architecture.includes('CopelandOS inbox'));
});

test('integration action checks block unsafe actions', async () => {
  const request = new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'provider-router', action: 'fake_connected_state' }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});
