import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "VANTAGE — Your next move. Make it matter.",
  description:
    "Discover your next move in legal, technology and finance. Explore a talent marketplace demo where great connections could unlock professional growth.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
