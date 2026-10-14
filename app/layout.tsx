import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { bioFontVariables } from "@/components/bio-fonts";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Oslinke",
  description:
    "Comentou a palavra, recebeu o link na DM. Automação de Instagram sem programar.",
  applicationName: "Oslinke",
  // Installed on iPhone: opens full screen with the app's own icon and name.
  appleWebApp: { capable: true, title: "Oslinke", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f8f5f0",
  // Lets the bottom bar sit above the iPhone home indicator (env(safe-area-inset-*)).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${bioFontVariables} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
