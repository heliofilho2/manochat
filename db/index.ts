import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Supabase pelo transaction pooler (porta 6543). Pool pequeno: cada instância
 * da Vercel abre o seu, e quem segura as conexões de verdade é o pooler.
 * O certificado do Supabase não está na cadeia do Node, então a conexão é
 * cifrada sem validar a CA (não ponha sslmode na URL: ele sobrescreve isto).
 */
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

// Fecha as conexões ociosas antes da instância ser suspensa (Fluid Compute).
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
export * from "./schema";
