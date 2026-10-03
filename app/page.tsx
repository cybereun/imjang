"use client";
// 루트 페이지: QueryClientProvider + 새 QueryClient로 <App/> 렌더.
// 지도 컴포넌트(MapExplorer·CourseView)는 AppShell 내부에서 next/dynamic + { ssr: false }로 로드된다.
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./components/AppShell";

export default function Page() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}
