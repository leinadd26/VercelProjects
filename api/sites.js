import { createSign } from 'node:crypto';
import { authenticated, configured } from '../lib/auth.js';

const timeout = () => AbortSignal.timeout(9000);

async function vercelApi(path, teamId) {
  const url = new URL(path, 'https://api.vercel.com');
  if (teamId) url.searchParams.set('teamId', teamId);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` }, signal: timeout() });
  if (!response.ok) throw Error(`Vercel API ${response.status}`);
  return response.json();
}

async function vercelAll(path, key, teamId) {
  let until = null; const output = [];
  for (let page = 0; page < 20; page++) {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('limit', '100');
    if (until) url.searchParams.set('until', String(until));
    const data = await vercelApi(url.pathname + url.search, teamId);
    output.push(...(data[key] || []));
    if (!data.pagination?.next || data.pagination.next === until) break;
    until = data.pagination.next;
  }
  return output;
}

function prettyName(value) {
  return String(value || '').replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, c => c.toUpperCase());
}

async function vercelCard(project, scope) {
  let domains = [];
  try {
    const data = await vercelApi(`/v9/projects/${encodeURIComponent(project.id)}/domains?production=true&verified=true&redirects=false&limit=100`, scope.id);
    domains = (data.domains || []).filter(d => d.name && d.verified !== false && !d.gitBranch && !d.customEnvironmentId && !d.redirect);
  } catch { /* Keep projects even when their domain list cannot be read. */ }
  domains.sort((a,b) => Number(b.name.endsWith('.vercel.app')) - Number(a.name.endsWith('.vercel.app')) || a.name.length - b.name.length);
  const host = domains[0]?.name || null;
  const framework = project.framework ? project.framework.replace(/[-_]/g, ' ') : 'Webseite';
  return { id: `vercel:${project.id}`, source: 'Vercel', name: prettyName(project.name),
    description: `${framework.charAt(0).toUpperCase() + framework.slice(1)}-Projekt auf Vercel`,
    url: host ? `https://${host}` : null, host, scope: scope.name };
}

async function loadVercel(warnings) {
  let teams = [];
  try { teams = await vercelAll('/v2/teams', 'teams'); } catch { warnings.push('Vercel: Teams konnten nicht geladen werden.'); }
  const ids = (process.env.VERCEL_TEAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
  const scopes = [{ id: null, name: 'Persönlich' }, ...teams.map(t => ({ id: t.id, name: t.name || t.slug || 'Team' }))];
  for (const id of ids) if (!scopes.some(s => s.id === id)) scopes.push({ id, name: 'Team' });
  const groups = await Promise.all(scopes.map(async scope => {
    try { return { scope, projects: await vercelAll('/v9/projects', 'projects', scope.id) }; }
    catch (e) { warnings.push(`${scope.name}: Vercel-Projekte konnten nicht geladen werden (${e.message}).`); return { scope, projects: [] }; }
  }));
  const unique = new Map();
  for (const { scope, projects } of groups) for (const project of projects) {
    const key = project.id || `${scope.id || 'personal'}:${project.name}`;
    if (!unique.has(key)) unique.set(key, { project, scope });
  }
  const tasks = [...unique.values()]; const sites = [];
  for (let i=0; i<tasks.length; i+=8) sites.push(...await Promise.all(tasks.slice(i,i+8).map(x => vercelCard(x.project, x.scope))));
  return sites;
}

async function githubJSON(url, token, notFoundIsEmpty = false) {
  const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'meine-webseiten-portal' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers, signal: timeout() });
  if (notFoundIsEmpty && response.status === 404) return null;
  if (!response.ok) throw Error(`GitHub API ${response.status}`);
  return response.json();
}

async function githubRepositories(username, token) {
  const repos = [];
  for (let page = 1; page <= 20; page++) {
    const url = token
      ? `https://api.github.com/user/repos?affiliation=owner&per_page=100&page=${page}&sort=updated`
      : `https://api.github.com/users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&page=${page}&sort=updated`;
    const batch = await githubJSON(url, token);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter(repo => repo.has_pages && (!token || repo.owner?.login?.toLowerCase() === username.toLowerCase()));
}

function safeHttpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
}

async function githubCard(repo, token) {
  const pages = await githubJSON(`https://api.github.com/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/pages`, token, true);
  if (!pages) return null;
  const fallback = repo.name.toLowerCase() === `${repo.owner.login.toLowerCase()}.github.io`
    ? `https://${repo.owner.login}.github.io/`
    : `https://${repo.owner.login}.github.io/${repo.name}/`;
  const url = safeHttpsUrl(pages.html_url) || fallback;
  return { id: `github-pages:${repo.id}`, source: 'GitHub Pages', name: prettyName(repo.name),
    description: repo.description || `GitHub Pages · ${repo.full_name}`, url,
    host: new URL(url).host, scope: repo.owner.login };
}

async function loadGitHubPages(warnings) {
  const username = process.env.GITHUB_USERNAME || 'leinadd26';
  const token = process.env.GITHUB_TOKEN || '';
  try {
    const repos = await githubRepositories(username, token);
    const sites = [];
    for (let i=0; i<repos.length; i+=8) {
      const cards = await Promise.all(repos.slice(i,i+8).map(async repo => {
        try { return await githubCard(repo, token); }
        catch (e) { warnings.push(`GitHub Pages: ${repo.full_name} konnte nicht geprüft werden (${e.message}).`); return null; }
      }));
      sites.push(...cards.filter(Boolean));
    }
    if (!token) warnings.push('GitHub Pages: Ohne GITHUB_TOKEN werden nur öffentliche Repositories erfasst.');
    return sites;
  } catch (e) {
    warnings.push(`GitHub Pages konnten nicht geladen werden (${e.message}).`);
    return [];
  }
}

let firebaseTokenCache;
async function firebaseAccessToken() {
  if (firebaseTokenCache && firebaseTokenCache.expiresAt > Date.now() + 60000) return firebaseTokenCache.token;
  let account;
  try { account = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ''); }
  catch { throw Error('FIREBASE_SERVICE_ACCOUNT_JSON ist kein gültiges JSON.'); }
  if (!account.client_email || !account.private_key) throw Error('FIREBASE_SERVICE_ACCOUNT_JSON benötigt client_email und private_key.');
  const tokenUri = account.token_uri || 'https://oauth2.googleapis.com/token';
  if (!tokenUri.startsWith('https://')) throw Error('Ungültiger Token-Endpunkt.');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.readonly',
    aud: tokenUri,
    iat: now,
    exp: now + 3600
  })).toString('base64url')}`;
  const assertion = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(account.private_key, 'base64url')}`;
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion });
  const response = await fetch(tokenUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, signal: timeout() });
  if (!response.ok) throw Error(`Google OAuth ${response.status}`);
  const data = await response.json();
  firebaseTokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000 };
  return firebaseTokenCache.token;
}

async function firebaseJSON(url, token, notFoundIsEmpty = false) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: timeout() });
  if (notFoundIsEmpty && response.status === 404) return null;
  if (!response.ok) throw Error(`Firebase API ${response.status}`);
  return response.json();
}

async function firebaseProjects(token) {
  const projects = []; let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const url = new URL('https://firebase.googleapis.com/v1beta1/projects');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await firebaseJSON(url, token);
    projects.push(...(data.results || []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return projects;
}

async function firebaseSitesForProject(project, token) {
  const sites = []; let pageToken = '';
  for (let page = 0; page < 20; page++) {
    const url = new URL(`https://firebasehosting.googleapis.com/v1beta1/projects/${encodeURIComponent(project.projectId)}/sites`);
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const data = await firebaseJSON(url, token, true);
    if (!data) return sites;
    sites.push(...(data.sites || []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return sites;
}

async function loadFirebaseHosting(warnings) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    warnings.push('Firebase Hosting: Firebase-Lesezugriff fehlt noch; FIREBASE_SERVICE_ACCOUNT_JSON in Vercel hinterlegen.');
    return [];
  }
  try {
    const token = await firebaseAccessToken();
    const projects = await firebaseProjects(token);
    const sites = [];
    for (let i=0; i<projects.length; i+=5) {
      const groups = await Promise.all(projects.slice(i,i+5).map(async project => {
        try { return await firebaseSitesForProject(project, token); }
        catch (e) { warnings.push(`Firebase Hosting: ${project.projectId} konnte nicht geprüft werden (${e.message}).`); return []; }
      }));
      for (let j=0; j<groups.length; j++) {
        const project = projects[i+j];
        for (const site of groups[j]) {
          const siteId = site.siteId || site.name?.split('/').at(-1);
          const url = safeHttpsUrl(site.defaultUrl) || (siteId ? `https://${siteId}.web.app` : null);
          if (!url) continue;
          sites.push({ id: `firebase:${site.name || `${project.projectId}/${siteId}`}`, source: 'Firebase Hosting',
            name: prettyName(siteId), description: `Firebase Hosting · ${project.displayName || project.projectId}`,
            url, host: new URL(url).host, scope: project.displayName || project.projectId });
        }
      }
    }
    return sites;
  } catch (e) {
    warnings.push(`Firebase Hosting konnte nicht geladen werden (${e.message}).`);
    return [];
  }
}

function uniqueByDestination(sites) {
  const found = new Map();
  for (const site of sites) {
    const key = site.url ? (() => { const url = new URL(site.url); return `${url.origin}${url.pathname.replace(/\/$/, '')}`; })() : site.id;
    if (!found.has(key)) found.set(key, site);
  }
  return [...found.values()];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Methode nicht erlaubt' });
  if (!configured()) return res.status(503).json({ error: 'VERCEL_TOKEN und PORTAL_PASSWORD fehlen.' });
  if (!authenticated(req)) return res.status(401).json({ error: 'Anmeldung erforderlich' });
  const warnings = [];
  try {
    const [vercelSites, githubSites, firebaseSites] = await Promise.all([
      loadVercel(warnings), loadGitHubPages(warnings), loadFirebaseHosting(warnings)
    ]);
    const sites = uniqueByDestination([...vercelSites, ...githubSites, ...firebaseSites]);
    sites.sort((a,b) => a.name.localeCompare(b.name, 'de') || a.source.localeCompare(b.source, 'de'));
    res.status(200).json({ sites, warnings: [...new Set(warnings)], updatedAt: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ error: `Seiten konnten nicht geladen werden: ${e.message}` });
  }
}
