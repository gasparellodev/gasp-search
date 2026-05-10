import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/**
 * Auto Showroom font stack (issue #198 / #F1 Sprint 0).
 *
 * Fontes carregadas globalmente via CSS vars `--font-geist` e `--font-geist-mono`
 * mas só ativadas quando `data-theme="auto-showroom"` está presente no `<html>`
 * (escopo: rotas `/sites/[slug]/*`). App interno gasp-search continua usando
 * Apple SK (font stack `-apple-system` em `globals.css` `@theme`).
 *
 * Pesos restritos a 400/500/600 per DESIGN.md (single weight stack — proibido
 * 700+).
 */
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: {
    default: "Gasp Search",
    template: "%s · Gasp Search",
  },
  description:
    "Captação, qualificação e gestão de leads para desenvolvimento de sites e automação.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geist.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
