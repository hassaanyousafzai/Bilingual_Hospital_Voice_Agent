"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useUIStore } from "@/store/useUIStore";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 15_000 } },
      })
  );
  const language = useUIStore((s) => s.language);

  // Keep the document direction/lang in sync with the selected language.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
