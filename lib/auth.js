import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = () => `${process.env.PORTAL_PASSWORD || ''}\0${process.env.VERCEL_TOKEN || ''}`;
const sign = value => createHmac('sha256', secret()).update(value).digest('hex');
export const configured = () => Boolean(process.env.PORTAL_PASSWORD && process.env.VERCEL_TOKEN);

export function authenticated(req) {
  if (!configured()) return false;
  const cookie = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('portal_session='));
  const [expiry, mac] = (cookie || '').slice('portal_session='.length).split('.');
  return /^\d{13}$/.test(expiry || '') && /^[a-f0-9]{64}$/.test(mac || '') && Number(expiry) > Date.now()
    && timingSafeEqual(Buffer.from(mac), Buffer.from(sign(expiry)));
}

export function passwordMatches(input) {
  const a = Buffer.from(String(input || ''));
  const b = Buffer.from(process.env.PORTAL_PASSWORD || '');
  return configured() && a.length === b.length && timingSafeEqual(a, b);
}

export function issueSession(res) {
  const expiry = String(Date.now() + 7 * 86400000);
  res.setHeader('Set-Cookie', `portal_session=${expiry}.${sign(expiry)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`);
}
