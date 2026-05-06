import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"] });

export const metadata = {
  title: "Ultra Trading Bot — Dashboard",
  description: "Ultra Trading SaaS — Automated MT5 trading bot with real-time performance monitoring, strategy configuration, and trade history.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        />
      </head>
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
