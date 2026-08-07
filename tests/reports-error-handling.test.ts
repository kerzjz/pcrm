// @para-doc [#csa-sec-error-suppression]
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as configGetHandler, POST as configPostHandler } from '../src/pages/api/crm/reports/config';
import { GET as previewGetHandler } from '../src/pages/api/crm/reports/preview';
import * as dbModule from '../src/lib/db';

describe('Reports API Error Suppression (v0.13.6 - CSA & Security)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/crm/reports/config should use safeErrorResponse and not leak err.message when DB throws', async () => {
    // Mock getDb to throw a simulated internal database error
    vi.spyOn(dbModule, 'getDb').mockImplementation(() => {
      throw new Error('D1_DATABASE_ERROR: internal sqlite error at line 54');
    });

    const request = new Request('http://localhost/api/crm/reports/config');
    const context: any = {
      request,
      url: new URL(request.url),
      locals: { user: { id: 'usr-1', username: 'admin', role: 'admin' } },
    };

    const response = await configGetHandler(context);
    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to load report config');

    // In production (import.meta.env.DEV === false), details MUST NOT leak raw err.message
    if (!import.meta.env.DEV) {
      expect(body.details).toBeUndefined();
    }
  });

  it('POST /api/crm/reports/config should use safeErrorResponse and not leak err.message when DB throws', async () => {
    vi.spyOn(dbModule, 'getDb').mockImplementation(() => {
      throw new Error('D1_DATABASE_ERROR: write failed due to lock');
    });

    const request = new Request('http://localhost/api/crm/reports/config', {
      method: 'POST',
      body: JSON.stringify({ orgName: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const context: any = {
      request,
      url: new URL(request.url),
      locals: { user: { id: 'usr-1', username: 'admin', role: 'admin' } },
    };

    const response = await configPostHandler(context);
    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to save report config');

    if (!import.meta.env.DEV) {
      expect(body.details).toBeUndefined();
    }
  });

  it('GET /api/crm/reports/preview should use safeErrorResponse and not leak err.message when DB throws', async () => {
    vi.spyOn(dbModule, 'getDb').mockImplementation(() => {
      throw new Error('D1_DATABASE_ERROR: failed to execute join query');
    });

    const request = new Request('http://localhost/api/crm/reports/preview?year=2026');
    const context: any = {
      request,
      url: new URL(request.url),
      locals: { user: { id: 'usr-1', username: 'admin', role: 'admin' } },
    };

    const response = await previewGetHandler(context);
    expect(response.status).toBe(500);
    const body = await response.json();

    expect(body.success).toBe(false);
    expect(body.error).toBe('Failed to generate report preview');

    if (!import.meta.env.DEV) {
      expect(body.details).toBeUndefined();
    }
  });
});
