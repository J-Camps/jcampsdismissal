"use client";
import dynamic from "next/dynamic";
import { ReactNode } from "react";

const ConvexClientProvider = dynamic(
  () => import("./ConvexClientProvider").then((m) => ({ default: m.ConvexClientProvider })),
  { ssr: false, loading: () => null }
);

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
