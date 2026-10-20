import { FastifyError, FastifyReply, FastifyRequest } from "fastify";

/**
 * Global Fastify error handler.
 * Never forwards raw internal exception text (SQL errors, local IP addresses, file paths)
 * to callers holding only the shared API key.
 * Full details are logged server-side.
 */
export function globalErrorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);

  if (error.statusCode && error.statusCode < 500) {
    reply.status(error.statusCode).send({
      detail: error.message,
    });
    return;
  }

  reply.status(500).send({
    detail: "An internal error occurred while processing the chat request.",
  });
}
