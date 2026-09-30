/**
 * Turns the raw insight buckets (keys like "19h", "Qui", "REEL") into the
 * labels and sentences the dashboard shows. Pure, so it is unit-tested.
 */
import type { Bucket, Insights } from "./insights";
import { fmt } from "../format";

const WEEKDAY_FULL: Record<string, string> = {
  Dom: "Domingo",
  Seg: "Segunda-feira",
  Ter: "Terça-feira",
  Qua: "Quarta-feira",
  Qui: "Quinta-feira",
  Sex: "Sexta-feira",
  "Sáb": "Sábado",
};
const WEEKDAY_PLURAL: Record<string, string> = {
  Dom: "domingos",
  Seg: "segundas",
  Ter: "terças",
  Qua: "quartas",
  Qui: "quintas",
  Sex: "sextas",
  "Sáb": "sábados",
};
const FORMAT: Record<string, [string, string]> = {
  REEL: ["Reel", "Reels"],
  VIDEO: ["Vídeo", "Vídeos"],
  IMAGE: ["Imagem", "Imagens"],
  CAROUSEL_ALBUM: ["Carrossel", "Carrosséis"],
  DESCONHECIDO: ["Outro", "Outros"],
};

export function hourLabel(key: string): string {
  const h = Number(key.replace("h", ""));
  if (Number.isNaN(h)) return key;
  return `${h}h – ${(h + 1) % 24}h`;
}

export interface RankRow {
  label: string;
  conv: string;
  pct: string;
  posts: number;
  /** 0-100, relative to the best row. */
  width: number;
}

export function pctLabel(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(".", ",")}%`;
}

export function toRows(buckets: Bucket[], label: (key: string) => string, limit = 5): RankRow[] {
  const top = buckets.slice(0, limit);
  const max = Math.max(1, ...top.map((b) => b.conversions));
  return top.map((b) => ({
    label: label(b.key),
    conv: fmt(b.conversions),
    pct: pctLabel(b.rate),
    posts: b.posts,
    width: Math.round((b.conversions / max) * 100),
  }));
}

export function rankings(i: Insights) {
  return {
    hora: toRows(i.byHour, hourLabel),
    dia: toRows(i.byWeekday, (k) => WEEKDAY_FULL[k] ?? k),
    formato: toRows(i.byFormat, (k) => FORMAT[k]?.[0] ?? k),
    tema: toRows(i.byTheme, (k) => k),
  };
}

/** "Reels de #receitafacil, às quintas, entre 19h e 20h." or null without enough data. */
export function bestCombo(i: Insights): string | null {
  const fmtB = i.byFormat[0];
  const day = i.byWeekday[0];
  const hour = i.byHour[0];
  if (!fmtB || !day || !hour || fmtB.conversions === 0) return null;
  const h = Number(hour.key.replace("h", ""));
  const theme = i.byTheme[0];
  const parts = [
    `${FORMAT[fmtB.key]?.[1] ?? fmtB.key}${theme ? ` de ${theme.key}` : ""}`,
    `às ${WEEKDAY_PLURAL[day.key] ?? day.key}`,
    `entre ${h}h e ${(h + 1) % 24}h`,
  ];
  return `${parts.join(", ")}.`;
}
