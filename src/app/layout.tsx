import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import { CookieBanner } from "@/components/CookieBanner"
import { FloatingPackageBubbles } from "@/components/FloatingPackageBubbles"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Osanchez Barbearia | Agendamento de Barbearia Premium",
  description: "Vivencie o estilo e cuidado premium na Osanchez Barbearia. Agende seu horário com os melhores profissionais de forma prática e rápida.",
  keywords: ["barbearia", "agendamento", "corte de cabelo", "barba", "Osanchez", "Premium"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Osanchez",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: 'dark' }}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground transition-colors duration-200">
        <ThemeProvider>
          {children}
          <CookieBanner />
          <FloatingPackageBubbles />
        </ThemeProvider>
      </body>
    </html>
  )
}
