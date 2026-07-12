import { ClerkProvider } from "@clerk/nextjs";
import { NextSSRPlugin } from "@uploadthing/react/next-ssr-plugin";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { extractRouterConfig } from "uploadthing/server";
import { ourFileRouter } from "@/app/api/uploadthing/core";
import { clerkConfig } from "@/lib/clerk-config";
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
  title: "ContentAI — Build & Generate Content with AI",
  description:
    "Create content, generate posters, tweets, photos, and more with AI-powered tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl={clerkConfig.signInUrl}
      signUpUrl={clerkConfig.signUpUrl}
      signInFallbackRedirectUrl={clerkConfig.signInFallbackRedirectUrl}
      signUpFallbackRedirectUrl={clerkConfig.signUpFallbackRedirectUrl}
      signInForceRedirectUrl={clerkConfig.signInForceRedirectUrl}
      signUpForceRedirectUrl={clerkConfig.signUpForceRedirectUrl}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <NextSSRPlugin routerConfig={extractRouterConfig(ourFileRouter)} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
