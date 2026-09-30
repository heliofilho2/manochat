"use server";

import { db, deletionRequest } from "@/db";

export type DeletionResult = { ok: true; protocol: string } | { ok: false; error: string };

function newProtocol(now = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const n = String(Math.floor(1000 + Math.random() * 9000));
  return `MC-${now.getFullYear()}-${mm}${dd}-${n}`;
}

/** Public form: stores the request; a person handles it (max 30 days). */
export async function requestDeletion(user: string, email: string): Promise<DeletionResult> {
  const igUsername = user.trim().replace(/^@/, "");
  if (!igUsername || igUsername.length > 60) return { ok: false, error: "Informe seu @ do Instagram." };
  if (!/^\S+@\S+\.\S+$/.test(email.trim()) || email.length > 200) {
    return { ok: false, error: "Esse e-mail parece incompleto." };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const protocol = newProtocol();
    try {
      await db.insert(deletionRequest).values({ protocol, igUsername, email: email.trim() });
      return { ok: true, protocol };
    } catch {
      // Protocol collision (unique): try another number.
    }
  }
  return { ok: false, error: "Não conseguimos registrar agora. Tente de novo em instantes." };
}
