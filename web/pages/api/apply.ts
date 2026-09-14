import type { NextApiRequest, NextApiResponse } from 'next';
import { API_BASE } from '../../lib/api';
import { resolveLocaleFrom } from '../../lib/locale';

/**
 * POST /api/apply: proxies the template answers to the NestJS API
 * (server-to-server), which validates them and creates the Zendesk ticket.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }
  const locale = resolveLocaleFrom({
    req,
    res,
    query: req.query,
  } as never);
  const upstream = await fetch(
    `${API_BASE}/apply?lang=${encodeURIComponent(locale)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ answers: (req.body ?? {}).answers ?? null }),
    },
  );
  const body: unknown = await upstream.json().catch(() => null);
  res.status(upstream.status).json(body ?? {});
}
