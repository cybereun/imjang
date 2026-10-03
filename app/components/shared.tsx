"use client";
// 원본 client/src/App.tsx 상단의 공용 타입·헬퍼·상수·아이콘을 모은 모듈.
// SafeAreaTopScrim은 SDK 컴포넌트 대신 로컬로 대체한다.
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api, type ApiResponse } from "@/lib/api-client";

export function SafeAreaTopScrim({ backgroundColor }: { backgroundColor: string }) {
  return <div style={{ height: "env(safe-area-inset-top)", backgroundColor }} aria-hidden="true" />;
}

export type Property = ApiResponse<typeof api, "listProperties">["properties"][number];
export type Detail = ApiResponse<typeof api, "getPropertyDetail">;
export type GeocodeCandidate = ApiResponse<typeof api, "geocodeProperty">["candidates"][number];
export type AreaCandidate = ApiResponse<typeof api, "geocodeArea">["candidates"][number];
export type Tab = "dashboard" | "field" | "sources" | "listings";
export type ListingSummary = ApiResponse<typeof api, "listListings">["listings"][number];
export type ListingDetailData = ApiResponse<typeof api, "getListing">;
export type AppView = "records" | "map" | "compare" | "decision" | "settings" | "tracking" | "courses";
export type Lens = "invest" | "reside";
export type WatchListItem = ApiResponse<typeof api, "listWatchItems">["items"][number];
export type WatchDetailData = ApiResponse<typeof api, "getWatchDetail">;
export type PriceAlertItem = ApiResponse<typeof api, "listPriceAlerts">["alerts"][number];
export type AlertType = PriceAlertItem["type"];
export type TourCourseListItem = ApiResponse<typeof api, "listTourCourses">["courses"][number];
export type TourCourseDetailData = ApiResponse<typeof api, "getTourCourse">;
export type TourCourseStop = TourCourseDetailData["stops"][number];
export type VoiceMemo = ApiResponse<typeof api, "getPropertyDetail">["voiceMemos"][number];

export const API_KEY_STORAGE_KEY = "imjang:molit-api-key";

export function readSavedApiKey(): string {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export const CHECKLIST_GROUPS: ReadonlyArray<{ title: string; items: ReadonlyArray<readonly [string, string]> }> = [
  { title: "단지·외부", items: [["entrance", "단지 진입 동선"], ["noise", "도로·생활 소음"], ["slope", "경사와 보행 환경"]] },
  { title: "건물·공용", items: [["parking", "주차 여유"], ["hall", "현관·복도 관리"], ["elevator", "엘리베이터 상태"]] },
  { title: "세대 내부", items: [["sunlight", "채광·향"], ["ventilation", "환기·냄새"], ["water", "수압·누수 흔적"], ["layout", "동선·수납"]] },
  { title: "생활권", items: [["transit", "대중교통 접근"], ["groceries", "장보기·생활상권"], ["school", "학교·돌봄 동선"]] },
] as const;

export const money = (value: number | null) => {
  if (value === null) return "—";
  if (value >= 10000) {
    const eok = Math.floor(value / 10000);
    const man = value % 10000;
    return man ? `${eok}억 ${man.toLocaleString("ko-KR")}만` : `${eok}억`;
  }
  return `${value.toLocaleString("ko-KR")}만`;
};

export const pyeong = (sqm: number) => sqm / 3.3058;

export const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;

export const formatWalkMinutes = (minutes: number) => {
  if (minutes <= 0) return "0분";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `약 ${minutes}분`;
  return rest === 0 ? `약 ${hours}시간` : `약 ${hours}시간 ${rest}분`;
};

export const formatVisitDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`))
  : "날짜 미정";

export const CHECKLIST_LABELS: ReadonlyMap<string, string> = new Map(
  CHECKLIST_GROUPS.flatMap((group) => group.items.map(([key, label]) => [key, label] as const)),
);

export const formatDuration = (sec: number | null) => {
  if (sec === null || Number.isNaN(sec)) return null;
  const total = Math.max(0, Math.round(sec));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export type TradeType = "sale" | "jeonse" | "wolse";
export type ListingStatus = "active" | "hold" | "done" | "closed";

export const TRADE_TYPE_LABEL: Record<TradeType, string> = { sale: "매매", jeonse: "전세", wolse: "월세" };
export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = { active: "추적중", hold: "보류", done: "거래완료", closed: "종료" };
export const LISTING_STATUS_ORDER: ListingStatus[] = ["active", "hold", "done", "closed"];

export const listingDongHo = (dong: string, ho: string) => {
  const parts = [dong ? `${dong}동` : "", ho ? `${ho}호` : ""].filter(Boolean);
  return parts.join(" ");
};

export const listingPriceText = (tradeType: TradeType, priceMan: number, monthlyRentMan: number | null) =>
  tradeType === "wolse" ? `${money(priceMan)} / ${money(monthlyRentMan ?? 0)}` : money(priceMan);

export function Icon({ name, size = 20 }: { name: "plus" | "pin" | "route" | "camera" | "mic" | "refresh" | "trash" | "edit" | "back" | "check" | "search" | "settings" | "eye" | "eyeOff" | "key" | "compare" | "bell" | "up" | "down" | "locate" | "info"; size?: number }) {
  const paths: Record<typeof name, ReactNode> = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    locate: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.5" fill="currentColor" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    route: <><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h3a3 3 0 0 0 3-3v-5a3 3 0 0 1 3-3h1" /></>,
    camera: <><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3" /></>,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 8A7 7 0 0 1 18 7l2 5M17.9 16A7 7 0 0 1 6 17l-2-5" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /></>,
    edit: <><path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20Z" /><path d="m14.5 6.3 3.2 3.2" /></>,
    back: <><path d="m15 18-6-6 6-6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.4.24.75.6 1 1 .18.3.3.68.4 1.1h.1v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></>,
    eyeOff: <><path d="m3 3 18 18" /><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.1 2.8M6.5 6.5C4 8.2 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3.1-.5" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M16 7l2 2M13.5 9.5l2 2" /></>,
    compare: <><path d="M8 4v16M16 4v16" /><path d="M4 8h8M12 16h8" /><circle cx="8" cy="8" r="2" /><circle cx="16" cy="16" r="2" /></>,
    bell: <><path d="M6 9a6 6 0 1 1 12 0c0 4.5 1.5 6 2.5 7H3.5c1-1 2.5-2.5 2.5-7Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    up: <><path d="m18 15-6-6-6 6" /></>,
    down: <><path d="m6 9 6 6 6-6" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

// 지도 마커 html은 문자열을 그대로 DOM에 넣으므로, 외부·사용자 입력 문자열은 반드시 이스케이프한다.
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => (ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;"));
}

export const defaultMapCenter: [number, number] = [36.5, 127.8];

// VWorld(국토교통부 브이월드) Base 타일. WMTS는 {z}/{y}/{x} 순서다.
// 키가 없으면 타일 레이어를 만들지 않고 등록 안내를 띄운다.
export const VWORLD_TILE_BASE = "https://api.vworld.kr/req/wmts/1.0.0";
export const VWORLD_ATTRIBUTION = '&copy; <a href="https://www.vworld.kr" target="_blank" rel="noreferrer">공간정보 오픈플랫폼 브이월드</a> 국토교통부';

export function vworldTileUrl(apiKey: string): string {
  return `${VWORLD_TILE_BASE}/${encodeURIComponent(apiKey)}/Base/{z}/{y}/{x}.png`;
}

export function useVworldTileUrl() {
  const config = useQuery({ queryKey: ["map-tile-config"], queryFn: () => api.getMapTileConfig({}) });
  const apiKey = config.data?.configured ? config.data.apiKey : null;
  return { tileUrl: apiKey ? vworldTileUrl(apiKey) : null, configured: Boolean(apiKey), isPending: config.isPending };
}

