import { Pool } from "pg";
import { config } from "./config.js";

let pool: Pool | null = null;

/** Created on first use, so importing this module opens no connections. */
export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await getDbPool().connect();
    try {
      await client.query("SELECT 1");
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    return false;
  }
}
