import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { extractRequestContext } from "../../core/context.js";
import { verifyApiKey } from "../../core/security.js";
import { BrainOrchestrator } from "../brain/orchestrator.js";
import { ChatRequestSchema } from "./schemas.js";

const orchestrator = new BrainOrchestrator();

export const chatRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Non-streaming chat endpoint (POST /api/v1/chat)
  server.post("/chat", { preHandler: verifyApiKey }, async (request, reply) => {
    const parseResult = ChatRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.format() });
    }

    const body = parseResult.data;
    // Trusted identity: X-User-Id is accepted only because verifyApiKey passed
    const ctx = extractRequestContext(request.headers);
    const effectiveUserId = ctx.userId || body.user_id;

    const result = await orchestrator.processMessage(body.message, {
      sessionId: body.session_id,
      userId: effectiveUserId,
      source: body.source || ctx.clientType,
      workspaceRoot: body.workspace_root,
      relativeFile: body.relative_file,
      language: body.language,
      selectionText: body.selection?.text,
      selectionStartLine: body.selection?.start_line,
      selectionEndLine: body.selection?.end_line,
      userTimezone: body.timezone,
      userCountry: body.country,
    });

    return reply.send({
      response: result.response,
      session_id: result.sessionId,
      confirmation: result.confirmation,
      trace_id: result.traceId,
    });
  });

  // Streaming chat endpoint (POST /api/v1/chat/stream)
  server.post("/chat/stream", { preHandler: verifyApiKey }, async (request, reply) => {
    const parseResult = ChatRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: parseResult.error.format() });
    }

    const body = parseResult.data;
    // Trusted identity: X-User-Id is accepted only because verifyApiKey passed
    const ctx = extractRequestContext(request.headers);
    const effectiveUserId = ctx.userId || body.user_id;

    // We write the SSE body to the raw socket ourselves, so take the reply out of
    // Fastify's lifecycle. Headers set through `reply` (including the CORS
    // plugin's onRequest headers) are not flushed by raw writes - copy them over.
    reply.hijack();
    for (const [name, value] of Object.entries(reply.getHeaders())) {
      if (value !== undefined) reply.raw.setHeader(name, value);
    }
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Abort controller cancels upstream processing if the browser client disconnects.
    // Listen on the response: on Node >= 16 `request.raw` emits "close" as soon as
    // the request body has been consumed, not when the client goes away.
    const abortController = new AbortController();
    reply.raw.on("close", () => {
      if (!reply.raw.writableEnded) {
        abortController.abort();
      }
    });

    try {
      const stream = orchestrator.processMessageStream(
        body.message,
        {
          sessionId: body.session_id,
          userId: effectiveUserId,
          source: body.source || ctx.clientType,
          workspaceRoot: body.workspace_root,
          relativeFile: body.relative_file,
          language: body.language,
          selectionText: body.selection?.text,
          selectionStartLine: body.selection?.start_line,
          selectionEndLine: body.selection?.end_line,
          userTimezone: body.timezone,
          userCountry: body.country,
        },
        abortController.signal,
      );

      for await (const chunk of stream) {
        if (abortController.signal.aborted) break;
        reply.raw.write(chunk);
      }
      reply.raw.end();
    } catch (err: any) {
      request.log.error(err, "Chat stream failed");
      reply.raw.end();
    }
  });
};
