import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Noto_Sans_Tamil,
  Noto_Sans_Bengali,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Oriya,
} from "next/font/google";
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

// Bengali webfont (self-hosted by next/font). Bengali glyphs fall through to
// this in the body font-family — the Windows system Bengali face (Nirmala UI)
// renders cramped, so we bring the wider Noto Sans Bengali instead.
const notoSansBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["latin", "bengali"],
});

// Punjabi + Odia webfonts (self-hosted by next/font), same per-glyph fallback
// pattern — the Windows system faces for Gurmukhi/Oriya are cramped.
const notoSansGurmukhi = Noto_Sans_Gurmukhi({
  variable: "--font-gurmukhi",
  subsets: ["latin", "gurmukhi"],
});

const notoSansOriya = Noto_Sans_Oriya({
  variable: "--font-oriya",
  subsets: ["latin", "oriya"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansTamil.variable} ${notoSansBengali.variable} ${notoSansGurmukhi.variable} ${notoSansOriya.variable} h-full antialiased`}
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
