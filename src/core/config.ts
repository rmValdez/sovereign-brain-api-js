import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().default("8001").transform((v) => parseInt(v, 10)),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://postgres:mysecretpassword@localhost:5434/sovereign_brain"),

  // Ollama configuration (supports both Python and JS naming)
  OLLAMA_BASE_URL: z.string().optional(),
  OLLAMA_URL: z.string().optional(),
  OLLAMA_GENERAL_MODEL: z.string().optional(),
  DEFAULT_CHAT_MODEL: z.string().optional(),
  OLLAMA_CODING_MODEL: z.string().default("qwen3:8b"),
  OLLAMA_PLANNER_MODEL: z.string().optional(),
  PLANNER_MODEL: z.string().optional(),
  OLLAMA_EMBEDDING_MODEL: z.string().optional(),
  EMBEDDING_MODEL: z.string().optional(),
  OLLAMA_NUM_CTX: z.string().default("8192").transform((v) => parseInt(v, 10)),
  OLLAMA_KEEP_ALIVE: z.string().default("5m"),
  // Timeouts in ms (TS-only: Python's Ollama client has none). Request = total for
  // non-streaming calls; stream idle = longest gap between streamed chunks, incl. the first.
  OLLAMA_REQUEST_TIMEOUT_MS: z.string().default("300000").transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),
  OLLAMA_STREAM_IDLE_TIMEOUT_MS: z.string().default("120000").transform((v) => parseInt(v, 10))
    .pipe(z.number().int().positive()),

  // Security (same three variables as Python's settings.allowed_api_keys; no
  // default key - with none configured, protected routes refuse every request)
  API_KEY: z.string().default(""),
  API_KEYS: z.string().default(""),
  BRAIN_API_KEY: z.string().default(""),
  ALLOWED_API_KEYS: z.string().default(""), // JS-only legacy alias for API_KEYS

  // Relevance distance cutoff
  KNOWLEDGE_SEARCH_MAX_DISTANCE: z.string().default("0.50").transform((v) => parseFloat(v)),
  MEMORY_SEARCH_MAX_DISTANCE: z.string().default("0.50").transform((v) => parseFloat(v)),

  // CORS
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("❌ Fatal Configuration Error: Invalid environment variables:");
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

const env = parsedEnv.data;

// Union of every configured key, matching Python's settings.allowed_api_keys
const rawAllowedKeys = [
  ...new Set(
    [env.API_KEY, env.BRAIN_API_KEY, ...env.API_KEYS.split(","), ...env.ALLOWED_API_KEYS.split(",")]
      .map((k) => k.trim())
      .filter(Boolean),
  ),
];

const corsOrigins = env.CORS_ALLOWED_ORIGINS
  ? env.CORS_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [
      "http://localhost:3008",
      "http://127.0.0.1:3008",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ];

export const config = {
  port: env.PORT,
  host: env.HOST,
  nodeEnv: env.NODE_ENV,

  database: {
    url: env.DATABASE_URL,
  },

  ollama: {
    url: (env.OLLAMA_BASE_URL || env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, ""),
    defaultChatModel: env.OLLAMA_GENERAL_MODEL || env.DEFAULT_CHAT_MODEL || "qwen3:8b",
    codingModel: env.OLLAMA_CODING_MODEL || "qwen3:8b",
    plannerModel: env.OLLAMA_PLANNER_MODEL || env.PLANNER_MODEL || "hermes3:8b",
    embeddingModel: env.OLLAMA_EMBEDDING_MODEL || env.EMBEDDING_MODEL || "nomic-embed-text",
    numCtx: env.OLLAMA_NUM_CTX,
    keepAlive: env.OLLAMA_KEEP_ALIVE,
    requestTimeoutMs: env.OLLAMA_REQUEST_TIMEOUT_MS,
    streamIdleTimeoutMs: env.OLLAMA_STREAM_IDLE_TIMEOUT_MS,
  },

  security: {
    apiKey: env.API_KEY,
    allowedApiKeys: rawAllowedKeys,
  },

  cors: {
    allowedOrigins: corsOrigins,
  },

  search: {
    knowledgeMaxDistance: env.KNOWLEDGE_SEARCH_MAX_DISTANCE,
    memoryMaxDistance: env.MEMORY_SEARCH_MAX_DISTANCE,
  },
};

export type AppConfig = typeof config;
