import "./globals.css";
import PWARegister from "@/components/PWARegister";

export const metadata = {
  title: "Satyam Stars International School",
  description: "School Management System — Satyam Stars International School, Surat, Gujarat",
  manifest: "/manifest.json",
  icons: {
    icon: "/school-logo.jpg",
    apple: "/school-logo.jpg",
    shortcut: "/school-logo.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Satyam School",
  },
};

export const viewport = {
  themeColor: "#1e3a5f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
