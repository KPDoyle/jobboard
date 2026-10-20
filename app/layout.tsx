import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "VANTAGE — Your next move. Make it matter.",
  description:
    "Find your next opportunity in legal, technology and finance. Apply, make trusted introductions and grow your career with VANTAGE.",
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
