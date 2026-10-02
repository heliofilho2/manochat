import type { NextConfig } from "next";

/**
 * Optional "bio only" domain: set BIO_DOMAIN (e.g. links.example.com) and
 * BIO_USERNAME. That host serves the owner's link-in-bio at "/" and nothing
 * else of the app (no login, no dashboard).
 */
const bioHost = process.env.BIO_DOMAIN?.trim();
const bioUser = process.env.BIO_USERNAME?.trim().replace(/^@/, "");
const bioOnly = bioHost && bioUser && /^[A-Za-z0-9._]+$/.test(bioUser);
const escaped = bioUser?.replace(/\./g, "\\.");
const onBioHost = bioOnly ? [{ type: "host" as const, value: bioHost }] : [];

const nextConfig: NextConfig = {
  // Old English routes (bookmarks, Meta dashboard URLs) keep working.
  async redirects() {
    return [
      ...(bioOnly
        ? [
            {
              // Anything but the bio page, its click redirects, assets and files goes back to "/".
              source: `/:path((?!u/${escaped}(?:/|$)|r/|_next/|[^/]*\\.[^/]*$).+)`,
              has: onBioHost,
              destination: "/",
              permanent: false,
            },
          ]
        : []),
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

  async rewrites() {
    if (!bioOnly) return [];
    return {
      beforeFiles: [{ source: "/", has: onBioHost, destination: `/u/${bioUser}` }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
