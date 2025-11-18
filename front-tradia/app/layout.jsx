import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext"; // Asegúrate que la ruta es correcta
import { ServerErrorProvider } from "./context/ServerErrorContext";
import GlobalModals from "../components/GlobalModals"

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Amigo Translations - Legal Translations with AI",
  description: "Translations of Legal Document with LLM power",
  generator: "v0.dev",
  icons: {
    icon: "/favico.png", // Ruta relativa desde /public
  },
};


export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <ServerErrorProvider>
          <AuthProvider>
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
              {children}
              <GlobalModals />
            </div>
          </AuthProvider>
        </ServerErrorProvider>
      </body>
    </html>
  );
}
