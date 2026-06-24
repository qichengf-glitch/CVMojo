import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CV Mojo",
  description: "Tailor your resume and cover letter to any job in seconds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
