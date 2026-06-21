import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('project registry loads all required projects', async () => {
  const registry = JSON.parse(await readFile(new URL('../config/projects.json', import.meta.url), 'utf8'));
  const ids = registry.projects.map((project) => project.id);

  assert.deepEqual(ids, [
    'score-scanner',
    'jazz-backend',
    'connectome-perturbation',
    'band-council-agent',
    'copelandos',
  ]);
  for (const project of registry.projects) {
    assert.ok(project.repo);
    assert.ok(project.taskSource);
    assert.ok(project.safeActions.length);
    assert.ok(project.forbiddenActions.length);
    assert.ok(project.status);
  }
});
