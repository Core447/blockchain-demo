import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ReactQueryProvider from "@/utils/ReacyQueryProvider";
import { BlockChainProvider } from "@/context/blockchain";
import { ConnectionProvider } from "@/context/connectionContext";
import { OpenPGPProvider } from "@/context/openpgp";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Blockchain",
  description: "Learn about blockchains",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ReactQueryProvider>
          <ConnectionProvider>
            <OpenPGPProvider>
              <BlockChainProvider>
                {children}
              </BlockChainProvider>
            </OpenPGPProvider>
          </ConnectionProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
