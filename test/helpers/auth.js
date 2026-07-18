export const TEST_API_AUTH_TOKEN = 'test-api-auth-token-32chars-min';

export function withApiAuth(env = {}) {
  return { API_AUTH_TOKEN: TEST_API_AUTH_TOKEN, ...env };
}

export function bearerAuthHeaders(extra = {}) {
  return { Authorization: `Bearer ${TEST_API_AUTH_TOKEN}`, ...extra };
}
