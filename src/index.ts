import { config } from "./core/config.js";
import { buildServer } from "./app.js";

async function main() {
  const server = await buildServer();

  try {
    const address = await server.listen({
      port: config.port,
      host: config.host,
    });
    server.log.info(`Sovereign Brain API (Node.js/TypeScript) listening at ${address}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
