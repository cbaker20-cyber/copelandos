import toolsConfig from '../config/tools.json' with { type: 'json' };
import mcpConfig from '../config/mcp-servers.json' with { type: 'json' };

const TOOLS = toolsConfig.tools;
const MCP_SERVERS = mcpConfig.servers;
const HIGH_RISK_ACTION_PATTERN = /\b(send|delete|deploy|merge|shell|screen|keyboard|mouse|publish|release|install|secret|rm|rmdir|unlink)\b/i;

export function getTool(id) {
  return TOOLS.find(t => t.id === id) || null;
}

export function listTools({ category, family } = {}) {
  let tools = TOOLS;
  if (category) tools = tools.filter(t => t.category === category);
  if (family) tools = tools.filter(t => t.family === family);
  return tools;
}

export function listMcpServers({ status } = {}) {
  let servers = MCP_SERVERS;
  if (status) servers = servers.filter(s => s.status === status);
  return servers;
}

export function getMcpServer(id) {
  return MCP_SERVERS.find(s => s.id === id) || null;
}

export function checkToolPermission(toolId, action) {
  const tool = getTool(toolId);
  if (!tool) {
    return {
      ok: false,
      allowed: false,
      reason: `Tool '${toolId}' is not in the registry.`,
      confirmation_required: true,
    };
  }

  if (tool.category === 'blocked') {
    return {
      ok: false,
      allowed: false,
      reason: `Tool '${toolId}' is permanently blocked.`,
      confirmation_required: tool.riskLevel === 'high',
      blocked: true,
      riskLevel: tool.riskLevel,
    };
  }

  if (action && tool.blockedActions.includes(action)) {
    return {
      ok: false,
      allowed: false,
      reason: `Action '${action}' is blocked for tool '${toolId}'.`,
      confirmation_required: tool.riskLevel === 'high' || HIGH_RISK_ACTION_PATTERN.test(action),
      blocked: true,
      riskLevel: tool.riskLevel,
    };
  }

  if (action && !tool.allowedActions.includes(action)) {
    return {
      ok: false,
      allowed: false,
      reason: `Action '${action}' is not in the allowed actions for '${toolId}'.`,
      confirmation_required: tool.confirmationRequired,
    };
  }

  if (tool.riskLevel === 'high') {
    return {
      ok: false,
      allowed: false,
      reason: `Tool '${toolId}' is high-risk and requires human confirmation.`,
      confirmation_required: true,
      riskLevel: 'high',
    };
  }

  if (tool.confirmationRequired) {
    return {
      ok: true,
      allowed: true,
      confirmation_required: true,
      riskLevel: tool.riskLevel,
      reason: `Tool '${toolId}' is allowed but requires explicit human confirmation.`,
    };
  }

  return {
    ok: true,
    allowed: true,
    confirmation_required: false,
    riskLevel: tool.riskLevel,
    reason: `Tool '${toolId}' action '${action || 'any allowed action'}' is permitted.`,
  };
}

export function checkMcpPermission(serverId, operation) {
  const server = getMcpServer(serverId);
  if (!server) {
    return {
      ok: false,
      allowed: false,
      reason: `MCP server '${serverId}' is not in the allowlist registry.`,
      blocked: true,
      policyNote: mcpConfig.policy,
    };
  }

  if (server.status === 'scaffold-only') {
    return {
      ok: false,
      allowed: false,
      reason: `MCP server '${serverId}' is scaffolded but not yet active.`,
      scaffold: true,
    };
  }

  if (operation && server.blockedOperations && server.blockedOperations.includes(operation)) {
    return {
      ok: false,
      allowed: false,
      reason: `Operation '${operation}' is blocked for MCP server '${serverId}'.`,
      blocked: true,
      confirmation_required: server.riskLevel === 'high' || HIGH_RISK_ACTION_PATTERN.test(operation),
      riskLevel: server.riskLevel,
    };
  }

  if (operation && server.allowedOperations && !server.allowedOperations.includes(operation)) {
    return {
      ok: false,
      allowed: false,
      reason: `Operation '${operation}' is not in the allowed operations for '${serverId}'.`,
      confirmation_required: true,
    };
  }

  const requiresConfirmation = server.status === 'allowed-with-confirmation';
  return {
    ok: true,
    allowed: !requiresConfirmation,
    confirmation_required: requiresConfirmation,
    reason: requiresConfirmation
      ? `MCP server '${serverId}' requires human confirmation for '${operation}'.`
      : `MCP server '${serverId}' operation '${operation}' is permitted.`,
  };
}

export function getRegistrySummary() {
  const categories = {};
  for (const tool of TOOLS) {
    if (!categories[tool.category]) categories[tool.category] = 0;
    categories[tool.category]++;
  }

  return {
    totalTools: TOOLS.length,
    totalMcpServers: MCP_SERVERS.length,
    categories,
    mcpPolicy: mcpConfig.policy,
    blockedTools: TOOLS.filter(t => t.category === 'blocked').map(t => t.id),
    activeMcpServers: MCP_SERVERS.filter(s => s.status === 'allowed' || s.status === 'allowed-with-confirmation').map(s => s.id),
    scaffoldedMcpServers: MCP_SERVERS.filter(s => s.status === 'scaffold-only').map(s => s.id),
  };
}
