import { env } from 'cloudflare:workers';
import { sanitizeError } from '@/lib/error-handler';

// @para-doc [operations-guide.md#5-huong-dan-khoi-phuc-du-lieu-database-disaster-recovery]
export async function POST(context: any) {
  // 1. Verify authentication & authorization
  const user = context.locals.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (user.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Read configuration from env (Cloudflare bindings fallback to process.env)
  const token = env.GITHUB_BACKUP_TOKEN || process.env.GITHUB_BACKUP_TOKEN;
  const owner = env.GITHUB_BACKUP_OWNER || process.env.GITHUB_BACKUP_OWNER;
  const repo = env.GITHUB_BACKUP_REPO || process.env.GITHUB_BACKUP_REPO;

  if (!token || !owner || !repo) {
    return new Response(
      JSON.stringify({ error: 'Missing GitHub backup configuration (Token, Owner, or Repo)' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Basic input validation
  const ownerRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  const repoRegex = /^[a-zA-Z0-9-_.]+$/;

  if (!ownerRegex.test(owner)) {
    return new Response(JSON.stringify({ error: 'Invalid GitHub owner format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (!repoRegex.test(repo)) {
    return new Response(JSON.stringify({ error: 'Invalid GitHub repository name format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pageel-crm-backup-client',
  };

  try {
    const res = await fetch(baseUrl, { headers });
    if (!res.ok) {
      let errorDetail = '';
      try {
        const errJson = await res.json() as any;
        if (errJson && errJson.message) {
          errorDetail = `: ${errJson.message}`;
        }
      } catch {}
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}${errorDetail}`);
    }

    const repoInfo = await res.json() as any;
    const permissions = repoInfo.permissions || {};
    const hasPushAccess = permissions.push || false;

    if (!hasPushAccess) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token does not have Push access to this repository. Please update permissions to Contents: Read & Write.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Connection successful! Token has read/write access.',
      repo: repoInfo.full_name,
      private: repoInfo.private,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const safeErrorMessage = sanitizeError(error);
    console.error('[Backup Test Connection Error]:', safeErrorMessage);
    return new Response(JSON.stringify({ success: false, error: safeErrorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
