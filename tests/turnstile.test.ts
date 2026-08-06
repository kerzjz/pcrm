// @para-doc [#csa-sec-turnstile]
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { verifyTurnstile } from '../src/lib/turnstile';

describe('Cloudflare Turnstile Verification Utility (S3.12)', () => {
  const SECRET_KEY = '0x4AAAAAAAx-mock-secret-key';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should skip verification and return success when secret key is missing (graceful degradation)', async () => {
    const result = await verifyTurnstile('token-123', null);
    expect(result.success).toBe(true);
  });

  it('should return missing-input-response error when token is missing', async () => {
    const result = await verifyTurnstile(null, SECRET_KEY);
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('missing-input-response');
  });

  it('should return success when Turnstile API returns success true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
    } as Response);

    const result = await verifyTurnstile('valid-token', SECRET_KEY);
    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should return failure when Turnstile API returns success false', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }),
    } as Response);

    const result = await verifyTurnstile('invalid-token', SECRET_KEY);
    expect(result.success).toBe(false);
    expect(result.errorCodes).toContain('invalid-input-response');
  });
});
