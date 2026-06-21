import toolsConfig from '../config/tools.json' with { type: 'json' };
import mcpConfig from '../config/mcp-servers.json' with { type: 'json' };

const ALL_TOOLS = toolsConfig.tools;
const MCP_POLICY = mcpConfig;

export const TOOL_CATEGORIES = Object.freeze({
  READ_ONLY: 'read-only',
  DRAFT_ONLY: 'draft-only',
  SAFE_WRITE: 'safe-write',
  CONFIRMATION_REQUIRED: 'confirmation-required',
  BLOCKED: 'blocked',
});

export const RISK_LEVELS = Object.freeze({ SAFE: 'safe', MEDIUM: 'medium', HIGH: 'high' });

/**
 * Get a tool by ID.
 */
export function getTool(id) {
  return ALL_TOOLS.find((t) => t.id === id) || null;
}

/**
 * List all tools, optionally filtered by family or category.
 */
export function listTools({ family, category } = {}) {
  return ALL_TOOLS.filter((t) => {
    if (family && t.family !== family) return false;
    if (category && t.category !== category) return false;
    return true;
  });
}

/**
 * Check whether a specific action is allowed for a tool.
 *
 * Returns { allowed, reason, confirmationRequired, riskLevel }
 */
export function checkToolAction(toolId, action) {
  const tool = getTool(toolId);

  if (!tool) {
    return {
      allowed: false,
      confirmationRequired: true,
      riskLevel: 'high',
      reason: `Tool '${toolId}' is not in the registry. Only allowlisted tools are permitted.`,
    };
  }

  if (tool.category === TOOL_CATEGORIES.BLOCKED) {
    return {
      allowed: false,
      confirmationRequired: true,
      riskLevel: 'high',
      reason: `Tool '${toolId}' is in the blocked category. Action '${action}' is not permitted.`,
    };
  }

  const normalizedAction = String(action || '').toLowerCase().trim();

  if (tool.blockedActions.includes(normalizedAction)) {
    return {
      allowed: false,
      confirmationRequired: true,
      riskLevel: 'high',
      reason: `Action '${action}' is explicitly blocked for tool '${toolId}'.`,
    };
  }

  if (!tool.allowedActions.includes(normalizedAction)) {
    return {
      allowed: false,
      confirmationRequired: true,
      riskLevel: tool.riskLevel,
      reason: `Action '${action}' is not in the allowlist for tool '${toolId}'.`,
    };
  }

  if (tool.confirmationRequired || tool.riskLevel === 'high') {
    return {
      allowed: false,
      confirmationRequired: true,
      riskLevel: tool.riskLevel,
      reason: `Tool '${toolId}' action '${action}' requires explicit human confirmation.`,
    };
  }

  return {
    allowed: true,
    confirmationRequired: false,
    riskLevel: tool.riskLevel,
    reason: `Action '${action}' is allowed for tool '${toolId}'.`,
    tool: publicToolSummary(tool),
  };
}

/**
 * Check whether an MCP server is allowlisted.
 */
export function checkMcpServer(serverId) {
  const blocked = MCP_POLICY.blocked.find((b) => b.id === serverId);
  if (blocked) {
    return {
      allowed: false,
      status: 'blocked',
      reason: blocked.reason,
    };
  }

  const approved = MCP_POLICY.allowlistedServers.find((s) => s.id === serverId);
  if (approved) {
    return {
      allowed: true,
      status: 'approved',
      server: approved,
      reason: `MCP server '${serverId}' is allowlisted.`,
    };
  }

  const pending = MCP_POLICY.pendingReview.find((s) => s.id === serverId);
  if (pending) {
    return {
      allowed: false,
      status: 'pending-review',
      reason: `MCP server '${serverId}' is pending review. Do not install until approved.`,
    };
  }

  return {
    allowed: false,
    status: 'not-registered',
    reason: `MCP server '${serverId}' is not in the registry. CopelandOS uses an allowlist-first policy. Add it to config/mcp-servers.json after review.`,
  };
}

/**
 * List all MCP server statuses.
 */
export function listMcpServers() {
  return {
    policy: MCP_POLICY.policy,
    allowlisted: MCP_POLICY.allowlistedServers.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      status: s.status,
      allowedCapabilities: s.allowedCapabilities,
    })),
    pendingReview: MCP_POLICY.pendingReview.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      status: s.status,
    })),
    blocked: MCP_POLICY.blocked.map((s) => ({ id: s.id, reason: s.reason })),
  };
}

/**
 * Return a public (safe) summary of a tool, without internal implementation details.
 */
export function publicToolSummary(tool) {
  return {
    id: tool.id,
    family: tool.family,
    displayName: tool.displayName,
    description: tool.description,
    riskLevel: tool.riskLevel,
    category: tool.category,
    confirmationRequired: tool.confirmationRequired,
    allowedActions: tool.allowedActions,
  };
}
