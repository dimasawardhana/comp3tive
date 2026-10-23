/**
 * Shared server primitives, split out of `index.ts` so modules like the AI
 * route can use them without a circular import (index imports ai for its
 * route table; ai needs ApiError/json/Env).
 */

/** A refusal with an HTTP status. Anything else reaching the top is a 500. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/**
 * The Worker's environment.
 *
 * `Cloudflare.Env` is what `wrangler types` generated from `wrangler.jsonc`, so
 * the `DB` binding is declared there and checked against the config rather than
 * restated here. The optional secrets are set with `wrangler secret put` and
 * deliberately absent from the config file: `GOOGLE_CLIENT_ID` gates the Google
 * routes, and the AI_* trio gates the AI chat route — optional the same way, so
 * a deployment without them answers 503 instead of failing to start.
 */
export type Env = Cloudflare.Env & {
  GOOGLE_CLIENT_ID?: string;
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
};
