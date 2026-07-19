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
  assert.equal(result.modules.automations.connected, false);
  assert.equal(result.modules.integrations.connected, false);
  assert.equal(result.modules.integrations.summary.connected, 0);
});

test('system status reports configured integrations without claiming connectivity', async () => {
  const env = {
    GITHUB_TOKEN: 'token',
    GITHUB_REPO: 'owner/repo',
    ALLOWED_ORIGIN: 'https://app.example',
  };
  const response = await worker.fetch(new Request('https://worker.example/api/status'), env, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.modules.integrations.connected, false);
  assert.equal(result.modules.integrations.summary.configured > 0, true);
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
  const request = new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'draft-pr' }),
  });
  const response = await worker.fetch(request, { GITHUB_TOKEN: 'token' }, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, false);
  assert.equal(result.scaffold, true);
  assert.equal(result.connected, false);
});

test('foundation integration check fails closed for unknown integrations', async () => {
  const request = new Request('https://worker.example/api/integrations/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ integrationId: 'unknown-system' }),
  });
  const response = await worker.fetch(request, {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.connected, false);
});

test('foundation integration control loop returns expected overnight steps', async () => {
  const response = await worker.fetch(new Request('https://worker.example/api/integrations/control-loop'), {}, {});
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.ok, true);
  assert.deepEqual(result.loop.map((step) => step.name), [
    'Capture',
    'Classify',
    'Plan',
    'Route',
    'Council',
    'Authorize Tools',
    'Remember',
    'Queue Work',
    'Draft PR',
    'Report Back',
  ]);
  assert.match(result.architecture, /CopelandOS inbox/);
  assert.match(result.morningReport.safety, /unsent draft/);
});
