/**
 * Per-automation funnel: how many people came in, got the first DM, tapped the
 * button and received the link. Pure, so the counting rules are unit-tested.
 */

export interface FunnelAuto {
  id: string;
  name: string;
  kind: "comment" | "story";
  /** The first DM carries a button that must be tapped to release the link. */
  gated: boolean;
}

export interface EntryCount {
  automationId: string;
  /** Comments (or story replies) that matched. */
  entries: number;
  /** Of those, first DMs that went out. */
  sent: number;
}

export interface TapCount {
  automationId: string;
  taps: number;
  /** Taps that ended with the link delivered. */
  linkSent: number;
}

export interface FunnelRow {
  id: string;
  name: string;
  kind: "comment" | "story";
  entries: number;
  dms: number;
  /** null when the automation has no button step. */
  taps: number | null;
  delivered: number;
  /** delivered / entries, 0–100, or null with no entries. */
  rate: number | null;
}

export function buildAutomationFunnel(autos: FunnelAuto[], entries: EntryCount[], taps: TapCount[]): FunnelRow[] {
  const e = new Map(entries.map((x) => [x.automationId, x]));
  const t = new Map(taps.map((x) => [x.automationId, x]));

  return autos
    .map((a): FunnelRow => {
      const en = e.get(a.id);
      const tp = t.get(a.id);
      const entriesN = en?.entries ?? 0;
      const dms = en?.sent ?? 0;
      // Comment automations with a button deliver on the tap. Everything else
      // (and story replies, whose follow check happens before the DM) delivers
      // with the first DM.
      const buttonStep = a.kind === "comment" && a.gated;
      const delivered = buttonStep ? (tp?.linkSent ?? 0) : dms;
      return {
        id: a.id,
        name: a.name || "Sem nome",
        kind: a.kind,
        entries: entriesN,
        dms,
        taps: buttonStep ? (tp?.taps ?? 0) : null,
        delivered,
        rate: entriesN > 0 ? Math.min(100, (delivered / entriesN) * 100) : null,
      };
    })
    .filter((r) => r.entries > 0 || (r.taps ?? 0) > 0)
    .sort((x, y) => y.entries - x.entries);
}
