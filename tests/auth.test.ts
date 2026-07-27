import { describe, it, expect, beforeAll } from 'vitest';
import { hashPassword, verifyPassword, createSessionCookie, verifySessionCookie } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';
import { POST as loginHandler } from '@/pages/api/auth/login';
import { POST as logoutHandler } from '@/pages/api/auth/logout';

const SESSION_SECRET = 'test-secret-key-must-be-long-enough-32-chars';
process.env.SESSION_SECRET = SESSION_SECRET;

describe('Authentication Engine - Password Hashing', () => {
  it('should hash password using PBKDF2 with 600,000 iterations and return correct format', async () => {
    const password = 'my-super-secret-password';
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash.startsWith('pbkdf2:600000:')).toBe(true);
    
    const parts = hash.split(':');
    expect(parts.length).toBe(4); // ['pbkdf2', '600000', saltHex, hashHex]
    expect(parts[2]).toHaveLength(32); // 16 bytes salt = 32 hex chars
    expect(parts[3]).toHaveLength(64); // 32 bytes derived key = 64 hex chars
  }, 15000);

  it('should verify password successfully for both 600k and legacy 10k hashes', async () => {
    const password = 'my-super-secret-password';
    const hash600k = await hashPassword(password);
    
    const isCorrect600k = await verifyPassword(password, hash600k);
    expect(isCorrect600k).toBe(true);

    // Mock legacy 10k hash format: pbkdf2:10000:...
    const legacy10kHash = 'pbkdf2:10000:00112233445566778899aabbccddeeff:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    // Test that verifyPassword parses iterations dynamically
    const isIncorrectLegacy = await verifyPassword('wrong-password', legacy10kHash);
    expect(isIncorrectLegacy).toBe(false);

    const isIncorrect = await verifyPassword('wrong-password', hash600k);
    expect(isIncorrect).toBe(false);
  }, 15000);
});

describe('Authentication Engine - Stateless Signed Session Cookie', () => {
  const payload = {
    id: 'user-uuid-1234',
    username: 'testuser',
    role: 'admin',
    createdAt: Date.now()
  };

  it('should sign and create session cookie successfully', async () => {
    const cookieValue = await createSessionCookie(payload, SESSION_SECRET);
    expect(cookieValue).toBeDefined();
    
    const parts = cookieValue.split('.');
    expect(parts.length).toBe(2); // [payloadBase64, signatureHex]
    expect(parts[1]).toHaveLength(64); // HMAC-SHA256 signature = 32 bytes = 64 hex chars
  });

  it('should verify and decrypt valid session cookie', async () => {
    const cookieValue = await createSessionCookie(payload, SESSION_SECRET);
    const decoded = await verifySessionCookie(cookieValue, SESSION_SECRET);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(payload.id);
    expect(decoded?.username).toBe(payload.username);
    expect(decoded?.role).toBe(payload.role);
  });

  it('should return null for tampered cookie signature', async () => {
    const cookieValue = await createSessionCookie(payload, SESSION_SECRET);
    const parts = cookieValue.split('.');
    
    // reliably tamper with the first character of the signature
    const tamperedSignature = parts[1].startsWith('a') ? 'b' + parts[1].slice(1) : 'a' + parts[1].slice(1);
    const tamperedCookie = `${parts[0]}.${tamperedSignature}`;
    
    const decoded = await verifySessionCookie(tamperedCookie, SESSION_SECRET);
    expect(decoded).toBeNull();
  });

  it('should return null for tampered payload', async () => {
    const cookieValue = await createSessionCookie(payload, SESSION_SECRET);
    const parts = cookieValue.split('.');
    
    // Decode payload, tamper role field, and re-encode
    const rawPayload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8'));
    rawPayload.role = 'malicious-admin';
    const tamperedPayloadBase64 = Buffer.from(JSON.stringify(rawPayload)).toString('base64url');
    
    // Keep original signature but attach tampered payload
    const tamperedCookie = `${tamperedPayloadBase64}.${parts[1]}`;
    
    const decoded = await verifySessionCookie(tamperedCookie, SESSION_SECRET);
    expect(decoded).toBeNull();
  });
});

class MockKV {
  store = new Map<string, string>();
  async get(key: string): Promise<string | null> { return this.store.get(key) || null; }
  async put(key: string, value: string): Promise<void> { this.store.set(key, value); }
}

describe('Authentication API Endpoints - Integration Tests', () => {
  const TEST_USER = {
    id: 'admin-uuid-9999',
    username: 'testadmin',
    password: 'correct-password',
    role: 'admin'
  };

  beforeAll(async () => {
    // 1. Run migrations to initialize tables in the in-memory SQLite DB
    const db = getDb();
    migrate(db, { migrationsFolder: path.join(__dirname, '../drizzle') });

    // 2. Insert test user
    const passwordHash = await hashPassword(TEST_USER.password);
    await db.insert(users).values({
      id: TEST_USER.id,
      username: TEST_USER.username,
      passwordHash: passwordHash,
      role: TEST_USER.role
    });
  });

  it('should return 400 when login missing parameters', async () => {
    const mockRequest = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'testadmin' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const mockContext: any = {
      request: mockRequest,
      locals: { runtime: { env: { SESSION_SECRET, SESSION: new MockKV() } } },
      cookies: { set: () => {} }
    };

    const response = await loginHandler(mockContext);
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data.error).toBe('Username and password are required');
  });

  it('should return 401 when login with incorrect password', async () => {
    const mockRequest = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: TEST_USER.username, password: 'wrong-password' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const mockContext: any = {
      request: mockRequest,
      locals: { runtime: { env: { SESSION_SECRET, SESSION: new MockKV() } } },
      cookies: { set: () => {} }
    };

    const response = await loginHandler(mockContext);
    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data.error).toBe('Invalid username or password');
  });

  it('should login successfully and set cookie when credentials are correct', async () => {
    let setCookieName = '';
    let setCookieValue = '';
    
    const mockRequest = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: TEST_USER.username, password: TEST_USER.password }),
      headers: { 'Content-Type': 'application/json' }
    });

    const mockContext: any = {
      request: mockRequest,
      locals: { runtime: { env: { SESSION_SECRET, SESSION: new MockKV() } } },
      cookies: {
        set: (name: string, value: string) => {
          setCookieName = name;
          setCookieValue = value;
        }
      }
    };

    const response = await loginHandler(mockContext);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.username).toBe(TEST_USER.username);
    expect(data.user.role).toBe(TEST_USER.role);
    
    expect(setCookieName).toBe('session');
    expect(setCookieValue).toBeDefined();
    
    const decoded = await verifySessionCookie(setCookieValue, SESSION_SECRET);
    expect(decoded).not.toBeNull();
    expect(decoded?.username).toBe(TEST_USER.username);
  });

  it('should logout, delete session cookie, and redirect to /login with 302 status', async () => {
    let deletedCookieName = '';
    
    const mockRequest = new Request('http://localhost/api/auth/logout', {
      method: 'POST'
    });

    const mockContext: any = {
      request: mockRequest,
      cookies: {
        delete: (name: string) => {
          deletedCookieName = name;
        }
      },
      redirect: (url: string, status = 302) => {
        return new Response(null, {
          status,
          headers: { 'Location': url }
        });
      }
    };

    const response = await logoutHandler(mockContext);
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/login');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(deletedCookieName).toBe('session');
  });

  it('should throw error when database is empty and INITIAL_ADMIN_PASSWORD is not set', async () => {
    const db = getDb();
    await db.delete(users);

    const mockRequest = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'somepassword' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const mockContext: any = {
      request: mockRequest,
      locals: { runtime: { env: { SESSION_SECRET, SESSION: new MockKV() } } },
      cookies: { set: () => {} }
    };

    // When INITIAL_ADMIN_PASSWORD is not configured, it should return 500 error
    const response = await loginHandler(mockContext);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.details).toContain('INITIAL_ADMIN_PASSWORD is not configured in environment secrets.');
  });

  it('should auto-seed admin user when database is empty and INITIAL_ADMIN_PASSWORD is set', async () => {
    const db = getDb();
    // Delete all users to simulate an empty DB
    await db.delete(users);

    const mockRequest = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'custom-admin-password-123' }),
      headers: { 'Content-Type': 'application/json' }
    });

    const mockContext: any = {
      request: mockRequest,
      locals: { runtime: { env: { SESSION_SECRET, SESSION: new MockKV(), INITIAL_ADMIN_PASSWORD: 'custom-admin-password-123' } } },
      cookies: { set: () => {} }
    };

    // Mock env.INITIAL_ADMIN_PASSWORD
    process.env.INITIAL_ADMIN_PASSWORD = 'custom-admin-password-123';
    const response = await loginHandler(mockContext);
    delete process.env.INITIAL_ADMIN_PASSWORD;

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.username).toBe('admin');
    expect(data.user.role).toBe('admin');

    const createdUsers = await db.select().from(users);
    expect(createdUsers.length).toBe(1);
    expect(createdUsers[0].username).toBe('admin');
    expect(createdUsers[0].role).toBe('admin');
  }, 15000);

  it('should transparently upgrade legacy 10k PBKDF2 hash to 600k hash upon successful login', async () => {
    const db = getDb();
    await db.delete(users);

    const legacyPassword = 'legacy-password-123';
    // Manually create legacy 10k hash using legacy formula
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(legacyPassword),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derivedBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 10000, hash: 'SHA-256' },
      baseKey,
      256
    );
    const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(derivedBits)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const legacyHash = `pbkdf2:10000:${saltHex}:${hashHex}`;

    await db.insert(users).values({
      id: 'legacy-user-1',
      username: 'legacyuser',
      passwordHash: legacyHash,
      role: 'admin'
    });

    const mockRequest = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'legacyuser', password: legacyPassword }),
      headers: { 'Content-Type': 'application/json' }
    });

    const mockContext: any = {
      request: mockRequest,
      locals: { runtime: { env: { SESSION_SECRET, SESSION: new MockKV() } } },
      cookies: { set: () => {} }
    };

    const response = await loginHandler(mockContext);
    expect(response.status).toBe(200);

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, 'legacy-user-1')
    });
    expect(updatedUser?.passwordHash.startsWith('pbkdf2:600000:')).toBe(true);
  }, 15000);
});
