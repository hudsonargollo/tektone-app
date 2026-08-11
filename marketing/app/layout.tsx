import type { Metadata, Viewport } from "next";
import { Inter, EB_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import MotionProvider from "@/components/MotionProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-eb-garamond",
  style: ["italic"],
  weight: ["400", "500"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tektone.com.br"),
  title: "TEKTONE — A tecnologia certa para qualquer problema da sua empresa",
  description:
    "Transformamos necessidades empresariais em produtos, sistemas e ativos digitais construídos para gerar eficiência, diferenciação e escala.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "TEKTONE — A tecnologia certa para qualquer problema da sua empresa",
    description:
      "Transformamos necessidades empresariais em produtos, sistemas e ativos digitais construídos para gerar eficiência, diferenciação e escala.",
    url: "https://tektone.com.br",
    siteName: "TEKTONE",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#141618",
};

export const runtime = "edge";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${ebGaramond.variable} ${jetbrainsMono.variable} font-sans antialiased bg-ivory text-ink`}
      >
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
