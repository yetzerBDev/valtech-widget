import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import WidgetChrome from "./components/WidgetChrome";
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
  title: "Valtech",
  description: "Sistema de avalúos Valtech",
  icons: {
    icon: "/LOGO VALTECH.png",
  },
  other: {
    "google-site-verification": "uMFpcebvFpoh4_2FgXyZXBAQfDrft2C7_NZGR7VZfOc",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <WidgetChrome />
        {children}
      </body>
    </html>
  );
}
