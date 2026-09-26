import { authenticated, configured } from '../lib/auth.js';

async function api(path, teamId) {
  const url = new URL(path, 'https://api.vercel.com');
  if (teamId) url.searchParams.set('teamId', teamId);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw Error(`Vercel API ${response.status}: ${url.pathname}`);
  return response.json();
}

async function all(path, key, teamId) {
  let until = null; const output = [];
  for (let page = 0; page < 20; page++) {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('limit', '100');
    if (until) url.searchParams.set('until', String(until));
    const data = await api(url.pathname + url.search, teamId);
    output.push(...(data[key] || []));
    if (!data.pagination?.next || data.pagination.next === until) break;
    until = data.pagination.next;
  }
  return output;
}

async function card(project, scope) {
  let domains = [];
  try {
    const data = await api(`/v9/projects/${encodeURIComponent(project.id)}/domains?production=true&verified=true&redirects=false&limit=100`, scope.id);
    domains = (data.domains || []).filter(d => d.name && d.verified !== false && !d.gitBranch && !d.customEnvironmentId && !d.redirect);
  } catch { /* Still show projects with inaccessible or missing domains. */ }
  domains.sort((a,b) => Number(b.name.endsWith('.vercel.app')) - Number(a.name.endsWith('.vercel.app')) || a.name.length - b.name.length);
  const host = domains[0]?.name || null;
  const framework = project.framework ? project.framework.replace(/[-_]/g, ' ') : 'Webseite';
  return { id: project.id, name: project.name.replace(/[-_]+/g, ' ').replace(/\b\p{L}/gu, c => c.toUpperCase()),
    description: `${framework.charAt(0).toUpperCase() + framework.slice(1)}-Projekt auf Vercel`,
    url: host ? `https://${host}` : null, host, scope: scope.name };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Methode nicht erlaubt' });
  if (!configured()) return res.status(503).json({ error: 'VERCEL_TOKEN und PORTAL_PASSWORD fehlen.' });
  if (!authenticated(req)) return res.status(401).json({ error: 'Anmeldung erforderlich' });
  try {
    const warnings = []; let teams = [];
    try { teams = await all('/v2/teams', 'teams'); } catch { warnings.push('Teams konnten nicht geladen werden.'); }
    const ids = (process.env.VERCEL_TEAM_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
    const scopes = [{ id: null, name: 'Persönlich' }, ...teams.map(t => ({ id: t.id, name: t.name || t.slug || 'Team' }))];
    for (const id of ids) if (!scopes.some(s => s.id === id)) scopes.push({ id, name: 'Team' });
    const groups = await Promise.all(scopes.map(async scope => {
      try { return { scope, projects: await all('/v9/projects', 'projects', scope.id) }; }
      catch (e) { warnings.push(`${scope.name}: ${e.message}`); return { scope, projects: [] }; }
    }));
    if (groups.every(x => !x.projects.length) && warnings.length) throw Error(warnings.join(' '));
    // Vercel's cursor pagination can overlap at page boundaries. Keep one card
    // per project ID even when the same project is returned by multiple pages
    // or scopes.
    const uniqueProjects = new Map();
    for (const { scope, projects } of groups) {
      for (const project of projects) {
        const key = project.id || `${scope.id || 'personal'}:${project.name}`;
        if (!uniqueProjects.has(key)) uniqueProjects.set(key, { project, scope });
      }
    }
    const tasks = [...uniqueProjects.values()];
    const sites = [];
    for (let i=0; i<tasks.length; i+=8) sites.push(...await Promise.all(tasks.slice(i,i+8).map(x => card(x.project, x.scope))));
    sites.sort((a,b) => a.name.localeCompare(b.name, 'de'));
    res.status(200).json({ sites, warnings, updatedAt: new Date().toISOString() });
  } catch (e) { res.status(502).json({ error: `Vercel-Abfrage fehlgeschlagen: ${e.message}` }); }
}
