import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk, Space_Mono } from "next/font/google";
import { getDictionary } from "./_content/i18n";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
  display: "swap",
});

const spaceMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-wordmark",
  weight: ["700"],
  display: "swap",
});

const metadataCopy = getDictionary().common.metadata;

export const metadata: Metadata = {
  title: metadataCopy.title,
  description: metadataCopy.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetBrainsMono.variable} ${spaceMono.variable}`}
      lang="ru"
    >
      <body>{children}</body>
    </html>
  );
}
