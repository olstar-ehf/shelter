/**
 * Minimal GraphQL client for the NestJS GraphQL domain (island.is apps use
 * Apollo client; this prototype keeps the dependency surface small with a
 * typed fetch wrapper over POST /graphql).
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
const GRAPHQL_URL = `${API_BASE}/graphql`;

interface GraphQLBody {
  data?: unknown;
  errors?: { message: string }[];
}

export async function gqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables: variables ?? {} }),
    });
  } catch (err) {
    throw new Error(
      `Cannot reach the GraphQL API at ${GRAPHQL_URL}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  const body = (await res.json().catch(() => null)) as GraphQLBody | null;
  if (!body) {
    throw new Error(`GraphQL API returned HTTP ${res.status} without a body`);
  }
  if (body.errors && body.errors.length > 0) {
    // Resolver errors carry the localized message (BadRequestException etc.)
    throw new Error(body.errors[0].message);
  }
  return body.data as T;
}

export { API_BASE, GRAPHQL_URL };
