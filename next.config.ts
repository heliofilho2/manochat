import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Old English routes (bookmarks, Meta dashboard URLs) keep working.
  async redirects() {
    return [
      { source: "/login", destination: "/", permanent: true },
      { source: "/dashboard", destination: "/painel", permanent: true },
      { source: "/automations", destination: "/automacoes", permanent: true },
      { source: "/automations/new", destination: "/automacoes/nova", permanent: true },
      { source: "/automations/:id", destination: "/automacoes/:id", permanent: true },
      { source: "/inbox", destination: "/entrada", permanent: true },
      { source: "/privacy", destination: "/privacidade", permanent: true },
      { source: "/data-deletion", destination: "/exclusao-de-dados", permanent: true },
    ];
  },
};

export default nextConfig;
