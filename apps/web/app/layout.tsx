import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Manrope } from "next/font/google";
import { AuthProvider } from "./_api/AuthProvider";
import { getDictionary } from "./_content/i18n";
import { PWAProvider } from "./_pwa/PWAProvider";
import { ToastProvider } from "./_toast";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

// Manrope covers both Latin and Cyrillic, so mixed RU/EN headings render in a
// single typeface instead of falling back to Inter for Russian glyphs.
const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
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

const metadataCopy = getDictionary().common.metadata;
const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? metadataCopy.siteUrl);

export const metadata: Metadata = {
  metadataBase,
  title: {
    default: metadataCopy.title,
    template: `%s | ${metadataCopy.applicationName}`,
  },
  description: metadataCopy.description,
  keywords: [...metadataCopy.keywords],
  authors: [{ name: metadataCopy.applicationName }],
  creator: metadataCopy.applicationName,
  publisher: metadataCopy.applicationName,
  openGraph: {
    title: metadataCopy.title,
    description: metadataCopy.description,
    url: "/",
    siteName: metadataCopy.applicationName,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: metadataCopy.ogImageAlt,
      },
    ],
    locale: "ru_RU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: metadataCopy.title,
    description: metadataCopy.description,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [{ url: "/icons/realgo-logo.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/icons/realgo-logo.png", sizes: "512x512", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: metadataCopy.applicationName,
  },
  applicationName: metadataCopy.applicationName,
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0d1117",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${inter.variable} ${manrope.variable} ${jetBrainsMono.variable}`}
      lang="ru"
    >
      <body>
        <AuthProvider>
          <ToastProvider>
            <PWAProvider />
            <div className="site-shell">{children}</div>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
