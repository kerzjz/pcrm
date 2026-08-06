// @para-doc [#csa-sec-turnstile]

export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
  challengeTs?: string;
  hostname?: string;
}

/**
 * Verifies a Cloudflare Turnstile CAPTCHA response token with the siteverify API.
 * 
 * Graceful Degradation: If secretKey is null/undefined (not configured),
 * verification is skipped and returns success: true.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  secretKey: string | null | undefined,
  remoteIp?: string
): Promise<TurnstileVerifyResult> {
  // 1. Graceful degradation: skip verification if secret key is not set
  if (!secretKey || secretKey.trim() === '') {
    console.warn('[Turnstile] Secret key not configured — skipping Turnstile verification.');
    return { success: true };
  }

  // 2. Validate token presence
  if (!token || token.trim() === '') {
    return {
      success: false,
      errorCodes: ['missing-input-response'],
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await res.json() as any;

    return {
      success: Boolean(data.success),
      errorCodes: data['error-codes'] || [],
      challengeTs: data.challenge_ts,
      hostname: data.hostname,
    };
  } catch (err: any) {
    console.error('[Turnstile Verification Exception]:', err?.message || err);
    // Graceful degradation on network timeout/failure: fail-open with log
    return {
      success: true,
      errorCodes: ['internal-network-error'],
    };
  }
}
