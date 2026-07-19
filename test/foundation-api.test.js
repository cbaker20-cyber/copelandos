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
  const response = await worker.fetch(new Request('https://worker.example/api/status'), {
    MIMO_API_KEY: 'configured-token',
    ALLOWED_ORIGIN: 'https://worker.example',
  }, {});
  const result = await response.json();
  assert.equal(result.complete, false);
  assert.equal(result.modules.automations.connected, false);
  assert.ok(result.modules.automations.configured.includes('mimo'));
  assert.equal(result.modules.gmail.connected, false);
  assert.equal(result.modules.localAgent.connected, false);
  assert.equal(result.modules.githubSupervisor.connected, false);
  assert.equal(result.modules.integrations.connected, false);
  assert.equal(result.modules.integrations.summary.connected, 0);
});

test('foundation exposes read-only integration registry', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.validation.ok, true);
  assert.ok(result.integrations.some((integration) => integration.id === 'iphone-shortcuts'));
  assert.ok(result.integrations.every((integration) => integration.connected === false));
});

test('foundation integration check fails closed for scaffold-only integrations', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'draft-pr' }),
  }), { GITHUB_TOKEN: 'token' }, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, false);
  assert.equal(result.scaffold, true);
  assert.equal(result.connected, false);
});

test('foundation integration check fails closed for unknown integrations', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'unknown-system' }),
  }), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
});

test('foundation integration control loop returns full overnight architecture', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/control-loop'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.equal(result.loop.length, 10);
  assert.match(result.architecture, /CopelandOS inbox/);
  assert.match(result.morningReport.safety, /unsent draft/);
});
