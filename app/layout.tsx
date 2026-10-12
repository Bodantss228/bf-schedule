import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Расписание · БФ ПНИПУ",
  description:
    "Расписание групп и преподавателей Березниковского филиала ПНИПУ",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Расписание",
    statusBarStyle: "default",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#047857",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
