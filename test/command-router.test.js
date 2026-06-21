import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { routeCommand } from '../src/commandRouter.js';

const registry = JSON.parse(await readFile(new URL('../config/projects.json', import.meta.url), 'utf8'));
const models = JSON.parse(await readFile(new URL('../config/models.json', import.meta.url), 'utf8'));

test('command router handles status, projects, and project detail', () => {
  assert.equal(routeCommand('status', { registry, models }).command, 'status');
  assert.equal(routeCommand('projects', { registry, models }).projects.length, 5);
  assert.equal(routeCommand('project copelandos', { registry, models }).project.id, 'copelandos');
});

test('command router returns a planning route for free text', () => {
  const result = routeCommand('Plan my project review', { registry, models, env: {} });
  assert.equal(result.command, 'plan');
  assert.equal(result.permission.risk, 'SAFE');
  assert.equal(result.modelRoute.ok, false);
});
