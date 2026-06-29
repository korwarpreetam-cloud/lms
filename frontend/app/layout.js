import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "solutiions.com — Learn. Grow. Serve. | Premium LMS Platform",
  description:
    "solutiions.com is a modern Learning Management System that empowers organizations to deliver, manage, and track training programs. Use our service or buy a custom LMS solution.",
  keywords:
    "LMS, learning management system, online training, e-learning, course management, solutiions",
  openGraph: {
    title: "solutiions.com — Learn. Grow. Serve.",
    description:
      "A premium Learning Management System for modern organizations. Use our service or buy your own.",
    type: "website",
  },
};

import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import ToastContainer from "../components/shared/Toast";

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistMono.variable} h-full antialiased`}>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ToastProvider>
            {children}
            <ToastContainer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
