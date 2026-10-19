import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/env";
import * as schema from "./schema";
import { SUPABASE_ROOT_CA } from "./supabase-ca";

/**
 * Supabase pelo transaction pooler (porta 6543). Pool pequeno: cada instância
 * da Vercel abre o seu, e quem segura as conexões de verdade é o pooler.
 * TLS validado pela CA raiz do Supabase (não ponha sslmode na URL: ele
 * sobrescreve esta configuração).
 */
const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true },
  max: 5,
});

// Fecha as conexões ociosas antes da instância ser suspensa (Fluid Compute).
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
export * from "./schema";
