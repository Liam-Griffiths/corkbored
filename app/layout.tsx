import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
    title: "corkbored",
    description: "I'm not sure what this is going to be.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body
            className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#fcfcfa] text-neutral-900 min-h-screen flex flex-col`}
        >
        <header className="flex items-center justify-between p-4 bg-neutral-800 text-white sticky top-0 z-10 h-20">
            <pre className="text-xs font-mono leading-none font-bold">
                {`   __   __   __        __   __   __   ___  __  
  /  \` /  \\ |__) |__/ |__) /  \\ |__) |__  |  \\ 
  \\__, \\__/ |  \\ |  \\ |__) \\__/ |  \\ |___ |__/ 
                                               `}
            </pre>
            <nav className="flex gap-4">
                {/* <a href="#" className="hover:text-neutral-300">Home</a> */}
            </nav>
        </header>
        <main className="p-4 flex-1">{children}</main>
        </body>
        </html>
    );
}
