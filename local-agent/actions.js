import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { hostname, platform, release, uptime } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { evaluatePermission, normalizeAction } from '../src/permissions.js';
import { sanitizePathSegment, validateVaultContent } from '../src/vault.js';

const execFileAsync = promisify(execFile);

function findRepository(allowlist, repoId) {
  return (allowlist.repositories || []).find((repo) => repo.id === repoId) || null;
}

export function validateActionRequest(action, payload = {}, allowlist = {}, { confirmed = false } = {}) {
  const normalized = normalizeAction(action);
  const permission = evaluatePermission(normalized, { confirmed });
  if (!permission.allowed) return permission;

  if (normalized === 'open_url') {
    let url;
    try { url = new URL(payload.url); } catch { return { ok: false, allowed: false, risk: permission.risk, message: 'Invalid URL.' }; }
    const allowed = url.protocol === 'obsidian:' || (allowlist.allowedUrlOrigins || []).includes(url.origin);
    if (!allowed) return { ok: false, allowed: false, risk: permission.risk, message: 'URL origin is not allowlisted.' };
  }

  if (normalized === 'open_obsidian_uri') {
    let uri;
    try { uri = new URL(payload.uri); } catch { return { ok: false, allowed: false, risk: permission.risk, message: 'Invalid Obsidian URI.' }; }
    if (uri.protocol !== 'obsidian:') return { ok: false, allowed: false, risk: permission.risk, message: 'Only obsidian: URIs are allowed.' };
  }

  if (['open_project_folder', 'run_approved_test'].includes(normalized) && !findRepository(allowlist, payload.repoId)) {
    return { ok: false, allowed: false, risk: permission.risk, message: 'Repository is not allowlisted.' };
  }

  if (normalized === 'run_approved_test') {
    const repo = findRepository(allowlist, payload.repoId);
    if (!(repo.testCommands || []).some((test) => test.id === payload.testId)) {
      return { ok: false, allowed: false, risk: permission.risk, message: 'Test command is not allowlisted.' };
    }
  }

  if (normalized === 'write_local_vault_note' && !allowlist.vault?.enabled) {
    return { ok: false, allowed: false, risk: permission.risk, message: 'Local vault writes are disabled.' };
  }

  return permission;
}

function launch(executable, args) {
  const child = spawn(executable, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

async function openUri(uri) {
  if (platform() !== 'win32') throw new Error('The v1 local launcher supports Windows only.');
  launch('rundll32.exe', ['url.dll,FileProtocolHandler', uri]);
}

export async function executeAllowedAction(action, payload = {}, allowlist = {}) {
  const normalized = normalizeAction(action);

  if (normalized === 'read_status') {
    return { ok: true, status: { hostname: hostname(), platform: platform(), release: release(), uptimeSeconds: Math.floor(uptime()) } };
  }

  if (normalized === 'open_url' || normalized === 'open_obsidian_uri') {
    await openUri(payload.url || payload.uri);
    return { ok: true, opened: true };
  }

  if (normalized === 'open_project_folder') {
    const repo = findRepository(allowlist, payload.repoId);
    if (platform() !== 'win32') throw new Error('Project-folder launch supports Windows only.');
    launch('explorer.exe', [repo.path]);
    return { ok: true, opened: repo.id };
  }

  if (normalized === 'start_cursor') {
    const app = allowlist.applications?.cursor;
    if (!app?.enabled) throw new Error('Cursor launch is disabled in the allowlist.');
    launch(app.executable, app.args || []);
    return { ok: true, started: 'cursor' };
  }

  if (normalized === 'start_vscode_tunnel') {
    const app = allowlist.applications?.vscodeTunnel;
    if (!app?.enabled) throw new Error('VS Code tunnel is disabled in the allowlist.');
    launch(app.executable, app.args || []);
    return { ok: true, started: 'vscode_tunnel' };
  }

  if (normalized === 'run_approved_test') {
    const repo = findRepository(allowlist, payload.repoId);
    const test = repo.testCommands.find((item) => item.id === payload.testId);
    const result = await execFileAsync(test.command, test.args || [], {
      cwd: repo.path,
      timeout: 120000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    return { ok: true, testId: test.id, stdout: result.stdout.slice(-12000), stderr: result.stderr.slice(-12000) };
  }

  if (normalized === 'write_local_vault_note') {
    const content = validateVaultContent(payload.content, { containsPrivateStudentData: payload.containsPrivateStudentData === true });
    const folder = sanitizePathSegment(payload.folder || 'Inbox', 'Inbox');
    const filename = `${sanitizePathSegment(payload.title || 'note')}.md`;
    const root = path.resolve(allowlist.vault.path);
    const target = path.resolve(root, folder, filename);
    if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Vault path escaped the allowlisted root.');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, { encoding: 'utf8', flag: 'wx' });
    return { ok: true, written: path.relative(root, target) };
  }

  if (normalized === 'repo_statuses') {
    const statuses = [];
    for (const repo of allowlist.repositories || []) {
      const result = await execFileAsync('git', ['-C', repo.path, 'status', '--short', '--branch'], {
        timeout: 15000,
        windowsHide: true,
      });
      statuses.push({ id: repo.id, status: result.stdout.trim() });
    }
    return { ok: true, repositories: statuses };
  }

  throw new Error('Action is not implemented by the local agent.');
}
