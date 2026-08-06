// @para-doc [#csa-sec-error-handler]

/**
 * Redacts sensitive tokens (GitHub PATs, API keys) from error strings.
 */
export function sanitizeError(err: unknown, defaultMessage = 'Unknown error'): string {
  if (!err) return defaultMessage;

  let message = typeof err === 'string' ? err : err instanceof Error ? err.message : defaultMessage;
  if (!message) return defaultMessage;

  // Redact GitHub Personal Access Tokens (ghp_*, gho_*, ghu_*, ghs_*, ghr_*)
  message = message.replace(/gh[pousr]_[A-Za-z0-9_]{36,255}/g, '[REDACTED_TOKEN]');

  // Redact bearer tokens or secret keys in strings
  message = message.replace(/(bearer\s+|token=)[A-Za-z0-9._~+/-]+=*/gi, '$1[REDACTED_TOKEN]');

  return message;
}

/**
 * Generates a clean, sanitized JSON error Response for API routes.
 */
export function safeErrorResponse(
  err: unknown,
  publicMessage: string,
  status = 500
): Response {
  const sanitizedMsg = sanitizeError(err, publicMessage);
  
  // Log sanitized error internally for observability
  console.error(`[Error ${status}] ${publicMessage}:`, sanitizedMsg);

  const payload: Record<string, unknown> = {
    success: false,
    error: publicMessage,
  };

  // Include sanitized details only in development
  if (import.meta.env.DEV) {
    payload.details = sanitizedMsg;
  }

  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
