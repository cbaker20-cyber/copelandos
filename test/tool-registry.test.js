import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getTool, listTools, checkToolAction, checkMcpServer, listMcpServers } from '../src/toolRegistry.js';

describe('tool registry — lookup', () => {
  it('returns a tool by id', () => {
    const tool = getTool('github-read-repo');
    assert.ok(tool, 'tool found');
    assert.equal(tool.id, 'github-read-repo');
    assert.equal(tool.riskLevel, 'safe');
    assert.equal(tool.category, 'read-only');
  });

  it('returns null for unknown tool id', () => {
    const tool = getTool('totally-fake-tool-xyz');
    assert.equal(tool, null);
  });

  it('lists tools filtered by family', () => {
    const githubTools = listTools({ family: 'github' });
    assert.ok(githubTools.length > 0);
    assert.ok(githubTools.every((t) => t.family === 'github'));
  });

  it('lists tools filtered by category', () => {
    const blocked = listTools({ category: 'blocked' });
    assert.ok(blocked.length > 0);
    assert.ok(blocked.every((t) => t.category === 'blocked'));
  });
});

describe('tool registry — action check', () => {
  it('allows a safe action on a read-only tool', () => {
    const result = checkToolAction('github-read-repo', 'list_files');
    assert.equal(result.allowed, true);
    assert.equal(result.confirmationRequired, false);
  });

  it('blocks an action that is in the blocked list for a tool', () => {
    const result = checkToolAction('github-read-repo', 'merge_pr');
    assert.equal(result.allowed, false);
    assert.equal(result.confirmationRequired, true);
  });

  it('blocks any action on a blocked tool', () => {
    const result = checkToolAction('gmail-send', 'send_email');
    assert.equal(result.allowed, false);
    assert.equal(result.confirmationRequired, true);
  });

  it('blocks an unregistered tool', () => {
    const result = checkToolAction('not-a-tool', 'do_something');
    assert.equal(result.allowed, false);
    assert.equal(result.riskLevel, 'high');
  });

  it('requires confirmation for local-agent-action', () => {
    const result = checkToolAction('local-agent-action', 'open_project_folder');
    assert.equal(result.allowed, false, 'local agent actions always require confirmation');
    assert.equal(result.confirmationRequired, true);
  });

  it('blocks arbitrary_shell for local-agent-action', () => {
    const result = checkToolAction('local-agent-action', 'arbitrary_shell');
    assert.equal(result.allowed, false);
    assert.equal(result.confirmationRequired, true);
  });

  it('blocks delete_file', () => {
    const result = checkToolAction('file-delete', 'delete_file');
    assert.equal(result.allowed, false);
    assert.equal(result.confirmationRequired, true);
  });

  it('blocks deploy', () => {
    const result = checkToolAction('deploy', 'deploy');
    assert.equal(result.allowed, false);
    assert.equal(result.confirmationRequired, true);
  });
});

describe('MCP registry — allowlist policy', () => {
  it('approves an allowlisted server', () => {
    const result = checkMcpServer('filesystem-read-only');
    assert.equal(result.allowed, true);
    assert.equal(result.status, 'approved');
  });

  it('blocks a blocked server', () => {
    const result = checkMcpServer('arbitrary-shell');
    assert.equal(result.allowed, false);
    assert.equal(result.status, 'blocked');
  });

  it('blocks an unregistered server', () => {
    const result = checkMcpServer('random-unreviewed-mcp-server');
    assert.equal(result.allowed, false);
    assert.equal(result.status, 'not-registered');
  });

  it('marks pending-review servers as not allowed', () => {
    const result = checkMcpServer('github-supervisor');
    assert.equal(result.allowed, false);
    assert.equal(result.status, 'pending-review');
  });

  it('lists all MCP servers with correct structure', () => {
    const list = listMcpServers();
    assert.ok(list.policy === 'allowlist-first');
    assert.ok(Array.isArray(list.allowlisted));
    assert.ok(Array.isArray(list.blocked));
    assert.ok(Array.isArray(list.pendingReview));
  });
});
