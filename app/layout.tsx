import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// TODO: Replace with next/font/local once Parabolica font files are available.
// Place font files in public/fonts/ and swap this import.
const parabolica = Inter({
  variable: "--font-parabolica",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Spirit Church",
  description: "Events, notes, and resources from Spirit Church.",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Spirit Church",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f0",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={parabolica.variable}>
      <body className="antialiased">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
