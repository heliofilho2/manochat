import type { MetadataRoute } from "next";

/** Installable app: opens straight into the dashboard, full screen, in the brand colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/painel",
    name: "Oslinke",
    short_name: "Oslinke",
    description: "Automação de Instagram: comentou a palavra, recebeu o link na DM.",
    lang: "pt-BR",
    start_url: "/painel?origem=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f5f0",
    theme_color: "#f8f5f0",
    categories: ["business", "productivity", "social"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Fluxos", url: "/fluxos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Caixa de entrada", url: "/entrada", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Automações", url: "/automacoes", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
