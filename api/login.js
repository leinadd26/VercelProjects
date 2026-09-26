import { configured, issueSession, passwordMatches } from '../lib/auth.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Methode nicht erlaubt' });
  if (!configured()) return res.status(503).json({ error: 'VERCEL_TOKEN und PORTAL_PASSWORD fehlen.' });
  if (!passwordMatches(req.body?.password)) return res.status(401).json({ error: 'Passwort stimmt nicht.' });
  issueSession(res);
  return res.status(200).json({ ok: true });
}
