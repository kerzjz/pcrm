// @para-doc [#csa-sec-error-handler]
import { describe, it, expect } from 'vitest';
import { sanitizeError, safeErrorResponse } from '../src/lib/error-handler';

describe('Centralized Error Handler (S3.11)', () => {
  it('should return default message for null or undefined errors', () => {
    expect(sanitizeError(null)).toBe('Unknown error');
    expect(sanitizeError(undefined)).toBe('Unknown error');
  });

  it('should redact sensitive tokens like GitHub PATs from error message', () => {
    const err = new Error('Failed to connect to github with ghp_1234567890abcdef1234567890abcdef1234');
    const sanitized = sanitizeError(err);
    expect(sanitized).not.toContain('ghp_1234567890abcdef1234567890abcdef1234');
    expect(sanitized).toContain('[REDACTED_TOKEN]');
  });

  it('should format safeErrorResponse as JSON Response object', async () => {
    const response = safeErrorResponse(new Error('Database timeout'), 'Operation failed', 500);
    expect(response.status).toBe(500);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Operation failed');
  });
});
