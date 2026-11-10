import { AppFrame } from "@/components/layout/AppFrame";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame pill="Guest">{children}</AppFrame>;
}
