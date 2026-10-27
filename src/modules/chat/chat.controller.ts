import { FastifyReply, FastifyRequest } from "fastify";
import { extractRequestContext } from "../../core/context.js";
import { BrainOrchestrator, ProcessMessageOptions } from "../brain/orchestrator.service.js";
import { ChatRequest, ChatRequestSchema } from "./chat.schemas.js";

function toProcessOptions(body: ChatRequest, request: FastifyRequest): ProcessMessageOptions {
  // Trusted identity: X-User-Id is accepted only because verifyApiKey passed
  const ctx = extractRequestContext(request.headers);
  return {
    sessionId: body.session_id,
    userId: ctx.userId || body.user_id,
    source: body.source || ctx.clientType,
    workspaceRoot: body.workspace_root,
    relativeFile: body.relative_file,
    language: body.language,
    selectionText: body.selection?.text,
    selectionStartLine: body.selection?.start_line,
    selectionEndLine: body.selection?.end_line,
    userTimezone: body.timezone,
    userCountry: body.country,
  };
}

export function createChatController(orchestrator: BrainOrchestrator) {
  return {
    // POST /api/v1/chat
    async chat(request: FastifyRequest, reply: FastifyReply) {
      const parseResult = ChatRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: parseResult.error.format() });
      }

      const body = parseResult.data;
      const result = await orchestrator.processMessage(body.message, toProcessOptions(body, request));

      return reply.send({
        response: result.response,
        session_id: result.sessionId,
        confirmation: result.confirmation,
        trace_id: result.traceId,
      });
    },

    // POST /api/v1/chat/stream
    async chatStream(request: FastifyRequest, reply: FastifyReply) {
      const parseResult = ChatRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({ error: parseResult.error.format() });
      }

      const body = parseResult.data;

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
          toProcessOptions(body, request),
          abortController.signal,
        );

        for await (const chunk of stream) {
          if (abortController.signal.aborted) break;
          reply.raw.write(chunk);
        }
        if (!reply.raw.writableEnded) reply.raw.end();
      } catch (err: any) {
        // Python parity (orchestrator.py:300/387): an upstream failure mid-stream terminates
        // the HTTP response cleanly without injecting dedicated error frames.
        // Full error stays server-side in logs.
        request.log.error(err, "Chat stream failed");
        if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      }
    },
  };
}
