import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";
import { loadProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";
export function generateMetadata(): Metadata {
  return { title: `${loadProfile().company_name} AI Management Office`, description: "Private, local AI business management" };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme");if(t!=="light")document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body>
        <Shell company={loadProfile().company_name}>{children}</Shell>
      </body>
    </html>
  );
}
