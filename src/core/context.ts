export type ClientType = "web" | "extension" | "cli" | "unknown";

export interface RequestContext {
  userId: string | null;
  clientType: ClientType;
  conversationId: string | null;
  sessionId: string | null;
  correlationId: string | null;
}

export function extractRequestContext(headers: Record<string, string | string[] | undefined>): RequestContext {
  const getHeader = (key: string): string | null => {
    const target = key.toLowerCase();
    let val = headers[target];
    if (val === undefined) {
      const match = Object.keys(headers).find((k) => k.toLowerCase() === target);
      if (match) val = headers[match];
    }
    if (!val) return null;
    return Array.isArray(val) ? val[0] || null : val;
  };

  // Python parity: raw_client_type = request.headers.get("X-Client-Type", "").strip().lower()
  const rawClientType = (getHeader("x-client-type") || "unknown").trim().toLowerCase();
  const clientType: ClientType = ["web", "extension", "cli"].includes(rawClientType)
    ? (rawClientType as ClientType)
    : "unknown";

  return {
    userId: getHeader("x-user-id"),
    clientType,
    conversationId: getHeader("x-conversation-id"),
    sessionId: getHeader("x-session-id"),
    correlationId: getHeader("x-correlation-id") || getHeader("x-request-id"),
  };
}
