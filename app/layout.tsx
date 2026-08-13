import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import WidgetChrome from "./components/WidgetChrome";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Valtech",
  description:
    "Plataforma privada para el control de solicitudes de avalúos.",
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
      lang="es"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("valtech-theme");if(t==="light"){document.documentElement.classList.remove("dark")}else{document.documentElement.classList.add("dark")}}catch(e){document.documentElement.classList.add("dark")}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <WidgetChrome />
        {children}
      </body>
    </html>
  );
}
