import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyApiKey } from "../../core/security.js";
import { BrainOrchestrator } from "../brain/orchestrator.service.js";
import { createChatController } from "./chat.controller.js";

export interface ChatRoutesOptions {
  orchestrator: BrainOrchestrator;
}

export const chatRoutes: FastifyPluginAsync<ChatRoutesOptions> = async (
  server: FastifyInstance,
  { orchestrator },
) => {
  const controller = createChatController(orchestrator);

  server.post("/chat", { preHandler: verifyApiKey }, controller.chat);
  server.post("/chat/stream", { preHandler: verifyApiKey }, controller.chatStream);
};
