import type { NextApiRequest, NextApiResponse } from 'next';
import { submitApplication } from '../../lib/api';
import { resolveLocaleFrom } from '../../lib/locale';

/**
 * POST /api/apply: submits the template answers to the NestJS GraphQL
 * domain (server-to-server), which validates them and creates the Zendesk
 * ticket. GraphQL resolver errors carry the localized message.
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
  try {
    const result = await submitApplication(
      (req.body ?? {}).answers ?? null,
      locale,
    );
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
