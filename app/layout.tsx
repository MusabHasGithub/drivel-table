import type { Metadata } from "next";
import { Geist, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Editorial type stack from the Lightbook Lite design:
//   - Geist            → UI sans
//   - Instrument Serif → italic display + serif accents
//   - JetBrains Mono   → code-y / type-card example values
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drivel — sort the chaos of people you've met",
  description:
    "Dump unstructured notes about someone you met. An LLM auto-extracts facts into a shared, dynamic-column table. Add a column anytime — old rows are re-extracted automatically.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline pre-hydration script: read the saved theme from localStorage
            and stamp data-theme on the <html> element BEFORE React paints.
            Prevents the light→dark flash on reload for users who picked dark. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('drivel.theme');
                var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.dataset.theme = theme;
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
