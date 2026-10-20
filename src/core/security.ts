import crypto from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Equivalent to Python's secrets.compare_digest.
 */
export function isValidApiKey(incomingKey?: string | null): boolean {
  if (!incomingKey) return false;
  const clean = incomingKey.trim();
  const allowed = config.security.allowedApiKeys;

  return allowed.some((validKey) => {
    if (clean.length !== validKey.length) return false;
    return crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(validKey));
  });
}

/**
 * Fastify preHandler hook to verify incoming API keys:
 * 1. X-API-Key header
 * 2. Authorization: Bearer <key> header
 * 3. ?api_key=<key> query parameter
 *
 * Matches Python app.core.security.verify_api_key.
 */
export async function verifyApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (config.security.allowedApiKeys.length === 0) {
    return reply.status(500).send({
      detail: "Server API key is not configured",
    });
  }

  const apiKeyHeader = request.headers["x-api-key"] as string | undefined;

  let bearerToken: string | undefined;
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    bearerToken = authHeader.slice(7).trim();
  }

  const query = request.query as Record<string, string | undefined> | undefined;
  const apiKeyQuery = query?.api_key;

  const incoming = apiKeyHeader || bearerToken || apiKeyQuery;

  if (!isValidApiKey(incoming)) {
    return reply.status(401).send({
      detail: "Invalid or missing API key",
    });
  }
}
