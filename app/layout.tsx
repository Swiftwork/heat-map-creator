import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Provider } from "@/components/chakra/provider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Heat Map Creator",
  description: "Heat Map Creator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <Provider>
          {children}
        </Provider>
      </body>
    </html>
  );
}
