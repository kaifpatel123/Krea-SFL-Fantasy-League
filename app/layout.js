import { Anton, Work_Sans } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
})

const workSans = Work_Sans({
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
})

export const metadata = {
  title: 'SFL Fantasy | SFL Sports Club X Economics Club',
  description: 'Fantasy league, tables and stats for the SIAS Football League',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${anton.variable} ${workSans.variable} font-body min-h-screen`}>
        <Nav />
        <main className="max-w-6xl mx-auto px-4">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
