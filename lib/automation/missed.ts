/**
 * Finds people who tapped an automation's button but never received its link,
 * by reading the stored webhook payloads (taps in, our own echoes out).
 * Pure so it can be unit-tested against real payload shapes.
 */
import { parseUnlockPayload } from "./flow";

interface Messaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  postback?: { payload?: string };
  message?: { is_echo?: boolean } & Record<string, unknown>;
}

export interface MissedTapper {
  igsid: string;
  /** Time of their most recent tap (ms). */
  lastTapAt: number;
}

export function findMissedTappers(payloads: unknown[], automationId: string, link: string | null): MissedTapper[] {
  const firstTap = new Map<string, number>();
  const lastTap = new Map<string, number>();
  const gotLink = new Map<string, number[]>();

  for (const p of payloads) {
    const entries = (p as { entry?: { id?: string; messaging?: Messaging[] }[] })?.entry ?? [];
    for (const entry of entries) {
      for (const m of entry.messaging ?? []) {
        const ts = m.timestamp ?? 0;
        if (m.postback && parseUnlockPayload(m.postback.payload) === automationId && m.sender?.id) {
          const id = m.sender.id;
          firstTap.set(id, Math.min(firstTap.get(id) ?? Infinity, ts));
          lastTap.set(id, Math.max(lastTap.get(id) ?? 0, ts));
        } else if (m.message?.is_echo && m.recipient?.id && link && JSON.stringify(m.message).includes(link)) {
          const list = gotLink.get(m.recipient.id) ?? [];
          list.push(ts);
          gotLink.set(m.recipient.id, list);
        }
      }
    }
  }

  const missed: MissedTapper[] = [];
  for (const [igsid, first] of firstTap) {
    // Echoes can land a moment "before" the tap's own timestamp; allow a small skew.
    const received = (gotLink.get(igsid) ?? []).some((t) => t >= first - 2000);
    if (!received) missed.push({ igsid, lastTapAt: lastTap.get(igsid)! });
  }
  return missed.sort((a, b) => b.lastTapAt - a.lastTapAt);
}
