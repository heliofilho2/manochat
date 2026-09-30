import { Fraunces, JetBrains_Mono, Nunito, Playfair_Display, Space_Grotesk } from "next/font/google";

/**
 * Fonts the bio page can use. `preload: false` keeps them off the critical
 * path of every other page: a font file is only fetched when text on screen
 * actually uses it.
 */
const serif = Fraunces({ variable: "--font-bio-serif", subsets: ["latin"], display: "swap", preload: false });
const mono = JetBrains_Mono({ variable: "--font-bio-mono", subsets: ["latin"], display: "swap", preload: false });
const rounded = Nunito({ variable: "--font-bio-rounded", subsets: ["latin"], display: "swap", preload: false });
const display = Space_Grotesk({ variable: "--font-bio-display", subsets: ["latin"], display: "swap", preload: false });
const elegant = Playfair_Display({ variable: "--font-bio-elegant", subsets: ["latin"], display: "swap", preload: false });

export const bioFontVariables = [serif, mono, rounded, display, elegant].map((f) => f.variable).join(" ");

export const FONT_LABELS: Record<string, string> = {
  jakarta: "Moderna",
  serif: "Serifada",
  mono: "Código",
  rounded: "Arredondada",
  display: "Impacto",
  elegant: "Elegante",
};
