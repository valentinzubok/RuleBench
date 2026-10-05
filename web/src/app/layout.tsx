import type { Metadata } from "next";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "RuleBench",
  description:
    "A moderation ruling with no moderator: on GenLayer Studio Dev (chain 61997) reported content is frozen at filing, validators agree whether it breaks a published rule, and an appeal gets a second consensus round.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
