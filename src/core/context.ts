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
    const val = headers[key.toLowerCase()];
    if (!val) return null;
    return Array.isArray(val) ? val[0] || null : val;
  };

  const rawClientType = getHeader("x-client-type") || "unknown";
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
