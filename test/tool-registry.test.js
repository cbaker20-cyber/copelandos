import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTool,
  listTools,
  listMcpServers,
  getMcpServer,
  checkToolPermission,
  checkMcpPermission,
  getRegistrySummary,
} from '../src/toolRegistry.js';

test('tool registry lists all tools', () => {
  const tools = listTools();
  assert.ok(Array.isArray(tools));
  assert.ok(tools.length > 0);
});

test('tool registry filters by category', () => {
  const blocked = listTools({ category: 'blocked' });
  assert.ok(Array.isArray(blocked));
  assert.ok(blocked.length > 0);
  assert.ok(blocked.every(t => t.category === 'blocked'));
});

test('tool registry blocks high-risk tools', () => {
  const result = checkToolPermission('gmail-send', 'send_message');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
  assert.equal(result.confirmation_required, true);
});

test('tool registry blocks deploy actions', () => {
  const result = checkToolPermission('deploy', 'deploy');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.confirmation_required, true);
});

test('tool registry blocks screen control', () => {
  const result = checkToolPermission('screen-control', 'take_screenshot');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.confirmation_required, true);
});

test('tool registry allows read-only github with permitted action', () => {
  const result = checkToolPermission('github-read', 'read_file');
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.confirmation_required, false);
});

test('tool registry blocks github merge', () => {
  const result = checkToolPermission('github-read', 'merge_pr');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test('tool registry requires confirmation for github issue creation', () => {
  const result = checkToolPermission('github-issue', 'create_issue');
  assert.equal(result.ok, true);
  assert.equal(result.confirmation_required, true);
});

test('tool registry allows vault write', () => {
  const result = checkToolPermission('obsidian-vault', 'write_note');
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
});

test('tool registry returns not-found for unregistered tool', () => {
  const result = checkToolPermission('random-mcp-tool-xyz', 'do_something');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
});

test('MCP registry is allowlist-first', () => {
  const result = checkMcpPermission('unknown-mcp-server-xyz', 'some_operation');
  assert.equal(result.ok, false);
  assert.equal(result.allowed, false);
  assert.equal(result.blocked, true);
});

test('MCP registry returns scaffold-only status for inactive servers', () => {
  const result = checkMcpPermission('obsidian-mcp', 'create_note');
  assert.equal(result.ok, false);
  assert.equal(result.scaffold, true);
});

test('MCP registry allows filesystem read operations', () => {
  const result = checkMcpPermission('filesystem-read', 'read_file');
  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
});

test('MCP registry blocks filesystem write', () => {
  const result = checkMcpPermission('filesystem-read', 'write_file');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
});

test('MCP GitHub requires confirmation for issue creation', () => {
  const result = checkMcpPermission('github-mcp', 'create_issue');
  assert.equal(result.ok, true);
  assert.equal(result.confirmation_required, true);
});

test('registry summary includes blocked tools list', () => {
  const summary = getRegistrySummary();
  assert.ok(Array.isArray(summary.blockedTools));
  assert.ok(summary.blockedTools.length > 0);
  assert.ok(summary.blockedTools.includes('gmail-send') || summary.blockedTools.includes('deploy'));
});

test('registry summary shows MCP policy', () => {
  const summary = getRegistrySummary();
  assert.ok(summary.mcpPolicy);
  assert.ok(summary.mcpPolicy.toLowerCase().includes('allowlist'));
});

test('tool registry blocks file deletion', () => {
  const result = checkToolPermission('files-delete', 'delete_file');
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.confirmation_required, true);
});

test('vault path note is allowed via obsidian vault tool', () => {
  const vault = getTool('obsidian-vault');
  assert.ok(vault);
  assert.ok(vault.allowedActions.includes('write_note'));
  assert.ok(!vault.blockedActions.includes('write_note'));
});
