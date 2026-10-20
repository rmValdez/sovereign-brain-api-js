import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { config } from "./core/config.js";
import { chatRoutes } from "./modules/chat/routes.js";
import { checkDatabaseConnection } from "./core/database.js";
import { globalErrorHandler } from "./core/error-handler.js";

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.nodeEnv === "development" ? "info" : "warn",
    },
  });

  // Attach global sanitized error handler (masks internal DB errors/IPs)
  server.setErrorHandler(globalErrorHandler);

  // Restrict CORS: Dynamic localhost in dev/test, explicit allowlist in production
  await server.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like curl, server-to-server, or same-origin)
      if (!origin) {
        return cb(null, true);
      }

      if (config.nodeEnv !== "production") {
        // In development/test, trust all localhost/127.0.0.1 ports
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return cb(null, true);
        }
      }

      // Check configured allowlist
      if (config.cors.allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      // Disallowed origin: omit CORS headers (the browser blocks the response),
      // matching Python's CORSMiddleware rather than failing the request with a 500
      return cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "X-User-Id", "X-Client-Type"],
  });

  // Health check endpoint (GET /health)
  server.get("/health", async () => {
    const dbOk = await checkDatabaseConnection();
    return {
      status: "ok",
      environment: config.nodeEnv,
      database: dbOk ? "connected" : "disconnected",
      ollama_url: config.ollama.url,
      timestamp: new Date().toISOString(),
    };
  });

  // Register API modules under /api/v1
  await server.register(chatRoutes, { prefix: "/api/v1" });

  return server;
}
