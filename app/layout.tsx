import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Tamil webfont (self-hosted by next/font). Used via per-glyph fallback so
// English stays in Geist while Tamil renders in Noto Sans Tamil
// (see globals.css body font-family).
const notoSansTamil = Noto_Sans_Tamil({
  variable: "--font-tamil",
  subsets: ["latin", "tamil"],
});

export const metadata: Metadata = {
  title: "Bridge — AI Elder Care Assistant",
  description: "Connecting generations through AI. Speak in your language, family hears it in theirs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansTamil.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('bridge-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
