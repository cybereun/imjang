import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fileToBase64, SafeAreaTopScrim } from "@hatch/space-sdk/client";
import { divIcon, type LatLngBoundsExpression } from "leaflet";
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import { ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import "leaflet/dist/leaflet.css";
import { api, type ApiResponse } from "./api";

type Property = ApiResponse<typeof api, "listProperties">["properties"][number];
type Detail = ApiResponse<typeof api, "getPropertyDetail">;
type GeocodeCandidate = ApiResponse<typeof api, "geocodeProperty">["candidates"][number];
type AreaCandidate = ApiResponse<typeof api, "geocodeArea">["candidates"][number];
type Tab = "dashboard" | "field" | "sources" | "listings";
type ListingSummary = ApiResponse<typeof api, "listListings">["listings"][number];
type ListingDetailData = ApiResponse<typeof api, "getListing">;
type AppView = "records" | "map" | "compare" | "decision" | "settings" | "tracking" | "courses";
type Lens = "invest" | "reside";
type WatchListItem = ApiResponse<typeof api, "listWatchItems">["items"][number];
type WatchDetailData = ApiResponse<typeof api, "getWatchDetail">;
type PriceAlertItem = ApiResponse<typeof api, "listPriceAlerts">["alerts"][number];
type AlertType = PriceAlertItem["type"];
type TourCourseListItem = ApiResponse<typeof api, "listTourCourses">["courses"][number];
type TourCourseDetailData = ApiResponse<typeof api, "getTourCourse">;
type TourCourseStop = TourCourseDetailData["stops"][number];
type VoiceMemo = ApiResponse<typeof api, "getPropertyDetail">["voiceMemos"][number];

const API_KEY_STORAGE_KEY = "imjang:molit-api-key";

function readSavedApiKey(): string {
  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

const CHECKLIST_GROUPS: ReadonlyArray<{ title: string; items: ReadonlyArray<readonly [string, string]> }> = [
  { title: "단지·외부", items: [["entrance", "단지 진입 동선"], ["noise", "도로·생활 소음"], ["slope", "경사와 보행 환경"]] },
  { title: "건물·공용", items: [["parking", "주차 여유"], ["hall", "현관·복도 관리"], ["elevator", "엘리베이터 상태"]] },
  { title: "세대 내부", items: [["sunlight", "채광·향"], ["ventilation", "환기·냄새"], ["water", "수압·누수 흔적"], ["layout", "동선·수납"]] },
  { title: "생활권", items: [["transit", "대중교통 접근"], ["groceries", "장보기·생활상권"], ["school", "학교·돌봄 동선"]] },
] as const;

const money = (value: number | null) => {
  if (value === null) return "—";
  if (value >= 10000) {
    const eok = Math.floor(value / 10000);
    const man = value % 10000;
    return man ? `${eok}억 ${man.toLocaleString("ko-KR")}만` : `${eok}억`;
  }
  return `${value.toLocaleString("ko-KR")}만`;
};

const pyeong = (sqm: number) => sqm / 3.3058;

const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;

const formatWalkMinutes = (minutes: number) => {
  if (minutes <= 0) return "0분";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `약 ${minutes}분`;
  return rest === 0 ? `약 ${hours}시간` : `약 ${hours}시간 ${rest}분`;
};

const formatVisitDate = (value: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T00:00:00`))
  : "날짜 미정";

const CHECKLIST_LABELS: ReadonlyMap<string, string> = new Map(
  CHECKLIST_GROUPS.flatMap((group) => group.items.map(([key, label]) => [key, label] as const)),
);

const formatDuration = (sec: number | null) => {
  if (sec === null || Number.isNaN(sec)) return null;
  const total = Math.max(0, Math.round(sec));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

type TradeType = "sale" | "jeonse" | "wolse";
type ListingStatus = "active" | "hold" | "done" | "closed";

const TRADE_TYPE_LABEL: Record<TradeType, string> = { sale: "매매", jeonse: "전세", wolse: "월세" };
const LISTING_STATUS_LABEL: Record<ListingStatus, string> = { active: "추적중", hold: "보류", done: "거래완료", closed: "종료" };
const LISTING_STATUS_ORDER: ListingStatus[] = ["active", "hold", "done", "closed"];

const listingDongHo = (dong: string, ho: string) => {
  const parts = [dong ? `${dong}동` : "", ho ? `${ho}호` : ""].filter(Boolean);
  return parts.join(" ");
};

const listingPriceText = (tradeType: TradeType, priceMan: number, monthlyRentMan: number | null) =>
  tradeType === "wolse" ? `${money(priceMan)} / ${money(monthlyRentMan ?? 0)}` : money(priceMan);

function Icon({ name, size = 20 }: { name: "plus" | "pin" | "route" | "camera" | "mic" | "refresh" | "trash" | "edit" | "back" | "check" | "search" | "settings" | "eye" | "eyeOff" | "key" | "compare" | "bell" | "up" | "down" | "locate" | "info"; size?: number }) {
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

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

// 지도 마커 html은 문자열을 그대로 DOM에 넣으므로, 외부·사용자 입력 문자열은 반드시 이스케이프한다.
function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => (ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === '"' ? "&quot;" : "&#39;"));
}

export function App() {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["properties"], queryFn: () => api.listProperties({}) });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formExisting, setFormExisting] = useState<Property | null>(null);
  const [view, setView] = useState<AppView>("records");
  const [courseViewId, setCourseViewId] = useState<number | null>(null);
  const [apiKey, setApiKey] = useState(readSavedApiKey);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [lens, setLens] = useState<Lens>("invest");
  const didInitialAutoSelect = useRef(false);

  useEffect(() => {
    if (!list.data) return;

    if (!didInitialAutoSelect.current) {
      didInitialAutoSelect.current = true;
      const first = list.data.properties[0];
      if (selectedId === null && first) setSelectedId(first.id);
      return;
    }

    if (selectedId !== null && !list.data.properties.some((item) => item.id === selectedId)) {
      setSelectedId(list.data.properties[0]?.id ?? null);
    }
  }, [list.data, selectedId]);

  const detail = useQuery({
    queryKey: ["property", selectedId],
    queryFn: () => api.getPropertyDetail({ id: selectedId ?? 0 }),
    enabled: selectedId !== null,
  });

  const unreadAlerts = useQuery({
    queryKey: ["price-alerts", "unread-count"],
    queryFn: async () => (await api.listPriceAlerts({ unreadOnly: true, limit: 1 })).unreadCount,
    staleTime: 30000,
  });

  const selectProperty = (id: number) => {
    setSelectedId(id);
    setTab("dashboard");
  };

  const openCourseView = (courseId: number | null) => {
    setCourseViewId(courseId);
    setView("courses");
  };

  const openNewProperty = () => {
    setFormExisting(null);
    setShowForm(true);
  };

  if (list.isPending) {
    return <div className="loading-screen"><span className="loading-mark" />임장 노트를 여는 중…</div>;
  }

  if (list.error) {
    return <div className="loading-screen">매물 목록을 불러오지 못했습니다.</div>;
  }

  const properties = list.data?.properties ?? [];
  const unreadAlertCount = unreadAlerts.data ?? 0;

  return (
    <div className={`app-shell ${view !== "records" ? "map-mode" : ""}`}>
      <SafeAreaTopScrim backgroundColor="var(--bg)" />
      {view === "settings" ? (
        <SettingsView apiKey={apiKey} onApiKeyChange={setApiKey} onBack={() => setView("records")} />
      ) : view === "tracking" ? (
        <PriceTrackingView apiKey={apiKey} onBack={() => setView("records")} />
      ) : view === "decision" ? (
        <DecisionHub onBack={() => setView("compare")} onOpenProperty={(id) => { selectProperty(id); setView("records"); }} />
      ) : view === "compare" ? (
        <ComparisonView properties={properties} onBack={() => setView("records")} onOpenProperty={(id) => { selectProperty(id); setView("records"); }} onOpenDecision={() => setView("decision")} onOpenCourse={openCourseView} />
      ) : view === "courses" ? (
        <CourseView
          key={courseViewId ?? "root"}
          initialSelectedId={courseViewId}
          properties={properties}
          onBack={() => setView("records")}
          onOpenProperty={(id) => { selectProperty(id); setView("records"); }}
        />
      ) : view === "map" ? (
        <MapExplorer
          properties={properties}
          apiKey={apiKey}
          onBack={() => setView("records")}
          onOpenSettings={() => setView("settings")}
          onAdd={openNewProperty}
          onSelect={(id) => {
            selectProperty(id);
            setView("records");
          }}
        />
      ) : (
        <>
          <aside className={`property-rail ${selectedId ? "mobile-hidden" : ""}`}>
            <div className="rail-toolbar">
              <div>
                <p className="eyebrow">현장 보드</p>
                <p className="rail-count">매물 {properties.length}곳</p>
              </div>
              <div className="rail-actions">
                <button className="icon-button" aria-label="설정 열기" onClick={() => setView("settings")}><Icon name="settings" size={19} /></button>
                <button className="icon-button" aria-label="단지·매물 비교 열기" onClick={() => setView("compare")}><Icon name="compare" size={19} /></button>
                <button className="icon-button tracking-nav" aria-label="시세 트래킹 열기" onClick={() => setView("tracking")}><Icon name="bell" size={19} />{unreadAlertCount > 0 && <span className="nav-badge" aria-label={`${unreadAlertCount}개의 읽지 않은 알림`}>{unreadAlertCount > 99 ? "99+" : unreadAlertCount}</span>}</button>
                <button className="icon-button" aria-label="임장 코스 열기" onClick={() => openCourseView(null)}><Icon name="route" size={19} /></button>
                <button className="map-button rail-map-link" onClick={() => setView("map")}><Icon name="pin" size={17} /> 지도</button>
                <button className="icon-button accent" aria-label="새 매물 등록" onClick={openNewProperty}><Icon name="plus" /></button>
              </div>
            </div>
            {properties.length === 0 ? (
              <EmptyState onAdd={openNewProperty} />
            ) : (
              <div className="property-list">
                {properties.map((property, index) => (
                  <button key={property.id} className={`property-row ${selectedId === property.id ? "active" : ""}`} onClick={() => selectProperty(property.id)}>
                    <span className="property-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="property-row-copy">
                      <strong>{property.name}</strong>
                      <span>{property.address}</span>
                      <span className="property-meta">{pyeong(property.areaSqm).toFixed(1)}평 · {money(property.askingPriceMan)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>

          <main className={`detail-stage ${selectedId ? "mobile-visible" : ""}`}>
            {selectedId === null ? (
              <div className="desktop-empty"><div className="pin-orbit"><Icon name="pin" size={34} /></div><h2>첫 임장지를 등록하세요</h2><p>주소를 좌표로 확인한 뒤 가격 판단과 현장 기록을 한곳에 모읍니다.</p><div className="empty-actions"><button className="secondary-button" onClick={() => setView("map")}><Icon name="pin" /> 지도에서 찾기</button><button className="primary-button" onClick={openNewProperty}><Icon name="plus" /> 매물 등록</button></div></div>
            ) : detail.isPending ? (
              <div className="loading-screen"><span className="loading-mark" />매물 기록을 불러오는 중…</div>
            ) : detail.data?.property ? (
              <PropertyWorkspace
                detail={detail.data}
                tab={tab}
                lens={lens}
                onTab={setTab}
                onLens={setLens}
                onBack={() => setSelectedId(null)}
                onEdit={() => {
                  setFormExisting(detail.data?.property ?? null);
                  setShowForm(true);
                }}
              />
            ) : (
              <div className="loading-screen">선택한 매물을 찾을 수 없습니다.</div>
            )}
          </main>
        </>
      )}

      {showForm && (
        <PropertyForm
          existing={formExisting}
          onClose={() => setShowForm(false)}
          onSaved={(id) => {
            setShowForm(false);
            setSelectedId(id);
            setView("records");
            void queryClient.invalidateQueries({ queryKey: ["properties"] });
            void queryClient.invalidateQueries({ queryKey: ["property", id] });
          }}
        />
      )}
    </div>
  );
}

function ServerKeyCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["server-key-status"], queryFn: () => api.getServerServiceKeyStatus({}) });
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const check = useMutation({
    mutationFn: () => api.checkOfficialApiConnection({ serviceKey: input.trim() || undefined }),
    onMutate: () => setMessage(null),
  });
  const saveMutation = useMutation({
    mutationFn: () => api.saveServerServiceKey({ serviceKey: input.trim() }),
    onSuccess: (result) => {
      setMessage(result.message);
      setInput("");
      check.reset();
      void queryClient.invalidateQueries({ queryKey: ["server-key-status"] });
      void queryClient.invalidateQueries({ queryKey: ["auto-check"] });
    },
    onError: () => setMessage("서버 인증키 등록 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."),
  });
  const removeMutation = useMutation({
    mutationFn: () => api.removeServerServiceKey({}),
    onSuccess: (result) => {
      setMessage(result.message);
      setInput("");
      check.reset();
      void queryClient.invalidateQueries({ queryKey: ["server-key-status"] });
      void queryClient.invalidateQueries({ queryKey: ["auto-check"] });
    },
    onError: () => setMessage("서버 인증키 삭제 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."),
  });
  const connected = check.data?.status === "ok";
  const configured = status.data?.configured === true;

  return (
    <section className="settings-form settings-form-wide" aria-labelledby="server-key-heading">
      <div className="settings-section-head">
        <div><h3 id="server-key-heading">서버 인증키</h3><p>자동 확인(매일 이른 아침) 전용. 서버에 보관되어 예약된 시세 확인이 사용합니다.</p></div>
        <span className={`status-dot ${configured ? "connected" : ""}`}>{configured ? "등록됨" : "미등록"}</span>
      </div>
      {status.data?.ownerOnly === true ? (
        <p className="key-help" role="status">서버 인증키 등록과 삭제는 앱 소유자만 사용할 수 있습니다.</p>
      ) : status.isPending ? (
        <p className="key-help" role="status">서버 인증키 상태를 확인하는 중…</p>
      ) : status.error || !status.data ? (
        <p className="key-help" role="status">서버 인증키 상태를 불러오지 못했습니다. <button type="button" className="ghost-link" onClick={() => status.refetch()}>다시 시도</button></p>
      ) : configured ? (
        <>
          <p className="key-help">등록된 키: <strong>{status.data.masked ?? "—"}</strong>{status.data.updatedAt ? ` · ${new Date(status.data.updatedAt).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} 등록` : ""}</p>
          <p className="key-help">키를 바꾸려면 삭제한 뒤 새로 등록하세요.</p>
          {message && <p className="storage-status saved" role="status">{message}</p>}
          <div className="settings-actions">
            <button type="button" className="secondary-button" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()}><Icon name="trash" size={17} />{removeMutation.isPending ? "삭제 중…" : "서버 인증키 삭제"}</button>
          </div>
        </>
      ) : (
        <>
          <label className="key-field">
            <span>일반 인증키</span>
            <div>
              <input
                aria-label="서버에 등록할 공공데이터포털 일반 인증키"
                type={show ? "text" : "password"}
                value={input}
                onChange={(event) => { setInput(event.target.value); check.reset(); setMessage(null); }}
                placeholder="인코딩 또는 디코딩 키 입력"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button type="button" aria-label={show ? "서버 인증키 숨기기" : "서버 인증키 보기"} onClick={() => setShow((value) => !value)}><Icon name={show ? "eyeOff" : "eye"} size={18} /></button>
            </div>
          </label>
          <p className="key-help">%가 포함된 인코딩 키와 디코딩 키를 모두 사용할 수 있습니다. 연결 확인 후 등록하면 서버에 보관되어 매일 이른 아침 자동 시세 확인에 사용됩니다.</p>
          {check.data && <div className={`connection-result ${connected ? "success" : "error"}`} role="status"><strong>{connected ? "연결 확인 완료" : "연결을 확인하지 못했습니다"}</strong><p>{check.data.message}</p></div>}
          {check.error && <div className="connection-result error" role="status"><strong>연결 확인 중 오류가 발생했습니다</strong><p>잠시 후 다시 시도해 주세요.</p></div>}
          {message && <p className="storage-status" role="status">{message}</p>}
          <div className="settings-actions">
            <button type="button" className="secondary-button" disabled={!connected || saveMutation.isPending} onClick={() => saveMutation.mutate()}><Icon name="key" size={17} />{saveMutation.isPending ? "등록 중…" : "서버에 등록"}</button>
            <button type="button" className="primary-button" disabled={input.trim().length < 10 || check.isPending} onClick={() => check.mutate()}><Icon name="refresh" size={17} />{check.isPending ? "확인 중…" : "연결 확인"}</button>
          </div>
        </>
      )}
    </section>
  );
}

function SettingsView({ apiKey, onApiKeyChange, onBack }: { apiKey: string; onApiKeyChange: (value: string) => void; onBack: () => void }) {
  const [showKey, setShowKey] = useState(false);
  const [savedKey, setSavedKey] = useState(readSavedApiKey);
  const [storageMessage, setStorageMessage] = useState<string | null>(savedKey ? "저장된 인증키를 불러왔습니다." : null);
  const checkConnection = useMutation({
    mutationFn: () => api.checkOfficialApiConnection({ serviceKey: apiKey.trim() || undefined }),
    onMutate: () => setStorageMessage(null),
  });
  const connected = checkConnection.data?.status === "ok";
  const saved = Boolean(savedKey) && savedKey === apiKey.trim();

  const saveKey = () => {
    if (!connected || !apiKey.trim()) return;
    try {
      window.localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
      setSavedKey(apiKey.trim());
      setStorageMessage("이 브라우저에 인증키를 저장했습니다.");
    } catch {
      setStorageMessage("브라우저 저장소를 사용할 수 없어 저장하지 못했습니다.");
    }
  };

  const clearKey = () => {
    try {
      window.localStorage.removeItem(API_KEY_STORAGE_KEY);
    } catch {
      // The field can still be cleared when browser storage is unavailable.
    }
    setSavedKey("");
    setStorageMessage("저장된 인증키를 삭제했습니다.");
    onApiKeyChange("");
    checkConnection.reset();
  };

  return <main className="settings-page">
    <header className="settings-header">
      <button className="icon-button" aria-label="현장 보드로 돌아가기" onClick={onBack}><Icon name="back" /></button>
      <div><p className="eyebrow">데이터 연결</p><h1>설정</h1></div>
      <span />
    </header>
    <div className="settings-layout">
      <section className="settings-intro">
        <div className="settings-symbol"><Icon name="key" size={28} /></div>
        <p className="eyebrow">국토교통부 실거래가</p>
        <h2>공공데이터포털 인증키</h2>
        <p>발급받은 일반 인증키를 입력하면 지도에서 시·구별 아파트 매매·전월세 실거래를 조회할 수 있습니다.</p>
      </section>

      <section className="settings-form" aria-labelledby="api-key-heading">
        <div className="settings-section-head">
          <div><h3 id="api-key-heading">API 연결</h3><p>상세 API를 먼저 확인하고, 지원되지 않으면 기본 API로 자동 전환합니다.</p></div>
          <span className={`status-dot ${connected ? "connected" : ""}`}>{connected ? "연결됨" : "미확인"}</span>
        </div>
        <label className="key-field">
          <span>일반 인증키</span>
          <div>
            <input
              aria-label="공공데이터포털 일반 인증키"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => { onApiKeyChange(event.target.value); checkConnection.reset(); setStorageMessage(null); }}
              placeholder="인코딩 또는 디코딩 키 입력"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <button type="button" aria-label={showKey ? "인증키 숨기기" : "인증키 보기"} onClick={() => setShowKey((value) => !value)}><Icon name={showKey ? "eyeOff" : "eye"} size={18} /></button>
          </div>
        </label>
        <p className="key-help">%가 포함된 인코딩 키와 디코딩 키를 모두 사용할 수 있습니다. 연결 확인 후 저장하면 이 브라우저에만 보관되어 다음 실행 때 자동으로 불러옵니다. 매일 이른 아침 자동 시세 확인은 아래 '서버 인증키'로 동작합니다.</p>
        {checkConnection.data && <div className={`connection-result ${connected ? "success" : "error"}`} role="status"><strong>{connected ? "연결 확인 완료" : "연결을 확인하지 못했습니다"}</strong><p>{checkConnection.data.message}</p></div>}
        {checkConnection.error && <div className="connection-result error" role="status"><strong>연결 확인 중 오류가 발생했습니다</strong><p>잠시 후 다시 시도해 주세요.</p></div>}
        {storageMessage && <p className={`storage-status ${saved ? "saved" : ""}`} role="status">{storageMessage}</p>}
        <div className="settings-actions">
          {(apiKey || savedKey) && <button type="button" className="secondary-button" onClick={clearKey}>저장된 키 지우기</button>}
          <button type="button" className="secondary-button" disabled={!connected || saved} onClick={saveKey}><Icon name="key" size={17} />{saved ? "저장됨" : "저장"}</button>
          <button type="button" className="primary-button" disabled={apiKey.trim().length < 10 || checkConnection.isPending} onClick={() => checkConnection.mutate()}><Icon name="refresh" size={17} />{checkConnection.isPending ? "확인 중…" : "연결 확인"}</button>
        </div>
      </section>

      <aside className="settings-guide">
        <h3>키를 어디서 찾나요?</h3>
        <ol><li>공공데이터포털에서 아파트 매매 실거래 상세 자료를 활용신청합니다.</li><li>마이페이지의 활용신청 상세에서 일반 인증키를 복사합니다.</li><li>위 입력칸에 붙여넣고 연결 확인을 누릅니다.</li></ol>
        <a href="https://www.data.go.kr/data/15126469/openapi.do" target="_blank" rel="noreferrer">공식 API 안내 열기 ↗</a>
      </aside>
      <ServerKeyCard />
      <VworldKeyCard />
    </div>
  </main>;
}

function VworldKeyCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: ["vworld-key-status"], queryFn: () => api.getVworldKeyStatus({}) });
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkState, setCheckState] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const saveMutation = useMutation({
    mutationFn: () => api.saveVworldKey({ apiKey: input.trim() }),
    onSuccess: (result) => {
      setMessage(result.message);
      setInput("");
      setCheckState("idle");
      void queryClient.invalidateQueries({ queryKey: ["vworld-key-status"] });
      void queryClient.invalidateQueries({ queryKey: ["map-tile-config"] });
    },
    onError: () => setMessage("VWorld 키 등록 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."),
  });
  const removeMutation = useMutation({
    mutationFn: () => api.removeVworldKey({}),
    onSuccess: (result) => {
      setMessage(result.message);
      setInput("");
      setCheckState("idle");
      void queryClient.invalidateQueries({ queryKey: ["vworld-key-status"] });
      void queryClient.invalidateQueries({ queryKey: ["map-tile-config"] });
    },
    onError: () => setMessage("VWorld 키 삭제 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."),
  });
  const configured = status.data?.configured === true;

  const checkTile = () => {
    const key = input.trim();
    if (key.length < 10 || checkState === "checking") return;
    setCheckState("checking");
    setMessage(null);
    // 서울 시청 일대 타일 한 장을 실제로 불러와 키와 도메인 허용을 함께 확인한다.
    const probe = new Image();
    const timer = window.setTimeout(() => { probe.src = ""; setCheckState("error"); }, 10000);
    probe.onload = () => { window.clearTimeout(timer); setCheckState("ok"); };
    probe.onerror = () => { window.clearTimeout(timer); setCheckState("error"); };
    probe.src = `${VWORLD_TILE_BASE}/${encodeURIComponent(key)}/Base/12/1586/3492.png`;
  };

  return (
    <section className="settings-form settings-form-wide" aria-labelledby="vworld-key-heading">
      <div className="settings-section-head">
        <div><h3 id="vworld-key-heading">VWorld 지도 키</h3><p>지도 배경 타일 전용. 국토교통부 브이월드에서 발급한 무료 API 키를 서버에 보관해 탐색 지도와 코스 지도의 배경으로 사용합니다.</p></div>
        <span className={`status-dot ${configured ? "connected" : ""}`}>{configured ? "등록됨" : "미등록"}</span>
      </div>
      {status.data?.ownerOnly === true ? (
        <p className="key-help" role="status">VWorld 키 등록과 삭제는 앱 소유자만 사용할 수 있습니다.</p>
      ) : status.isPending ? (
        <p className="key-help" role="status">VWorld 키 상태를 확인하는 중…</p>
      ) : status.error || !status.data ? (
        <p className="key-help" role="status">VWorld 키 상태를 불러오지 못했습니다. <button type="button" className="ghost-link" onClick={() => status.refetch()}>다시 시도</button></p>
      ) : configured ? (
        <>
          <p className="key-help">등록된 키: <strong>{status.data.masked ?? "—"}</strong>{status.data.updatedAt ? ` · ${new Date(status.data.updatedAt).toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} 등록` : ""}</p>
          <p className="key-help">키를 바꾸려면 삭제한 뒤 새로 등록하세요.</p>
          {message && <p className="storage-status saved" role="status">{message}</p>}
          <div className="settings-actions">
            <button type="button" className="secondary-button" disabled={removeMutation.isPending} onClick={() => removeMutation.mutate()}><Icon name="trash" size={17} />{removeMutation.isPending ? "삭제 중…" : "VWorld 키 삭제"}</button>
          </div>
        </>
      ) : (
        <>
          <label className="key-field">
            <span>VWorld API 키</span>
            <div>
              <input
                aria-label="브이월드 API 키"
                type={show ? "text" : "password"}
                value={input}
                onChange={(event) => { setInput(event.target.value); setCheckState("idle"); setMessage(null); }}
                placeholder="브이월드에서 발급받은 인증키 입력"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <button type="button" aria-label={show ? "VWorld 키 숨기기" : "VWorld 키 보기"} onClick={() => setShow((value) => !value)}><Icon name={show ? "eyeOff" : "eye"} size={18} /></button>
            </div>
          </label>
          <p className="key-help">브이월드(vworld.kr) 회원가입 후 “인증키 발급”에서 무료로 받을 수 있습니다. 키 설정에서 사용 도메인을 제한했다면 이 앱을 여는 주소를 허용 목록에 넣어 주세요. 연결 확인은 실제 지도 타일 한 장을 불러와 확인합니다.</p>
          {checkState === "ok" && <div className="connection-result success" role="status"><strong>연결 확인 완료</strong><p>이 키로 지도 타일을 불러올 수 있습니다. 등록하면 지도 배경이 바로 표시됩니다.</p></div>}
          {checkState === "error" && <div className="connection-result error" role="status"><strong>타일을 불러오지 못했습니다</strong><p>키가 맞는지, 그리고 브이월드 키 설정의 허용 도메인에 이 앱 주소가 포함되어 있는지 확인해 주세요.</p></div>}
          {message && <p className="storage-status" role="status">{message}</p>}
          <div className="settings-actions">
            <button type="button" className="secondary-button" disabled={checkState !== "ok" || saveMutation.isPending} onClick={() => saveMutation.mutate()}><Icon name="key" size={17} />{saveMutation.isPending ? "등록 중…" : "서버에 등록"}</button>
            <button type="button" className="primary-button" disabled={input.trim().length < 10 || checkState === "checking"} onClick={checkTile}><Icon name="refresh" size={17} />{checkState === "checking" ? "확인 중…" : "연결 확인"}</button>
          </div>
        </>
      )}
    </section>
  );
}

const defaultMapCenter: [number, number] = [36.5, 127.8];

// VWorld(국토교통부 브이월드) Base 타일. WMTS는 {z}/{y}/{x} 순서다.
// 키가 없으면 타일 레이어를 만들지 않고 등록 안내를 띄운다.
const VWORLD_TILE_BASE = "https://api.vworld.kr/req/wmts/1.0.0";
const VWORLD_ATTRIBUTION = '&copy; <a href="https://www.vworld.kr" target="_blank" rel="noreferrer">공간정보 오픈플랫폼 브이월드</a> 국토교통부';

function vworldTileUrl(apiKey: string): string {
  return `${VWORLD_TILE_BASE}/${encodeURIComponent(apiKey)}/Base/{z}/{y}/{x}.png`;
}

function useVworldTileUrl() {
  const config = useQuery({ queryKey: ["map-tile-config"], queryFn: () => api.getMapTileConfig({}) });
  const apiKey = config.data?.configured ? config.data.apiKey : null;
  return { tileUrl: apiKey ? vworldTileUrl(apiKey) : null, configured: Boolean(apiKey), isPending: config.isPending };
}

function MapViewport({ bounds, center, zoom }: { bounds: LatLngBoundsExpression | null; center: [number, number]; zoom: number }) {
  const map = useMap();
  const prevKeyRef = useRef<string>("");
  useEffect(() => {
    const key = bounds
      ? `b:${JSON.stringify(bounds)}`
      : `c:${center[0].toFixed(6)},${center[1].toFixed(6)},${zoom}`;
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    if (bounds) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
    else map.setView(center, zoom, { animate: false });
  }, [bounds, center, map, zoom]);
  return null;
}

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonthValue() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return monthValue(date);
}

function currentMonthValue() {
  return monthValue(new Date());
}

type MapMode = "saved" | "official" | "rent" | "nearby";
type OfficialTransaction = ApiResponse<typeof api, "searchOfficialTransactions">["transactions"][number];
type OfficialRentTransaction = ApiResponse<typeof api, "searchOfficialRentTransactions">["transactions"][number];

function rentSummary(tx: OfficialRentTransaction): { kind: "전세" | "월세"; price: string; sub: string | null } {
  if (tx.monthlyRentMan === 0) {
    return { kind: "전세", price: `${money(tx.depositMan)}원`, sub: null };
  }
  return { kind: "월세", price: `${money(tx.depositMan)}원 / ${money(tx.monthlyRentMan)}원`, sub: contractTermLabel(tx.contractTerm) };
}

function contractTermLabel(term: string | null): string | null {
  if (!term) return null;
  const digits = term.replace(/\D/g, "");
  return digits ? `계약 ${digits}개월` : term;
}

function MapExplorer({ properties, apiKey, onBack, onOpenSettings, onAdd, onSelect }: { properties: Property[]; apiKey: string; onBack: () => void; onOpenSettings: () => void; onAdd: () => void; onSelect: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<AreaCandidate | null>(null);
  const [minPyeong, setMinPyeong] = useState("");
  const [maxPyeong, setMaxPyeong] = useState("");
  const [mode, setMode] = useState<MapMode>("official");
  const [dealMonth, setDealMonth] = useState(previousMonthValue);
  const [manualLawdCd, setManualLawdCd] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<OfficialTransaction | null>(null);
  const [selectedRent, setSelectedRent] = useState<OfficialRentTransaction | null>(null);
  const [mapTileFailed, setMapTileFailed] = useState(false);
  const vworldTile = useVworldTileUrl();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<2 | 5 | 10>(5);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyCenter, setNearbyCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const geocode = useMutation({
    mutationFn: () => api.geocodeArea({ query }),
    onSuccess: (result) => setArea(result.candidates[0] ?? null),
  });
  const effectiveLawdCd = area?.lawdCd ?? (/^\d{5}$/.test(manualLawdCd) ? manualLawdCd : "");
  const official = useMutation({
    mutationFn: () => api.searchOfficialTransactions({ lawdCd: effectiveLawdCd, regionLabel: area?.regionName ?? query.trim(), dealMonth, serviceKey: apiKey.trim() || undefined }),
  });
  const rentSearch = useMutation({
    mutationFn: () => api.searchOfficialRentTransactions({ lawdCd: effectiveLawdCd, regionLabel: area?.regionName ?? query.trim(), dealMonth, serviceKey: apiKey.trim() || undefined }),
  });
  const resetOfficialQueries = () => { official.reset(); rentSearch.reset(); };
  const nearbyQuery = useQuery({
    queryKey: ["nearby-apartments", nearbyCenter?.latitude, nearbyCenter?.longitude, radiusKm],
    queryFn: () => api.getNearbyApartments({ latitude: nearbyCenter?.latitude ?? 0, longitude: nearbyCenter?.longitude ?? 0, radiusKm }),
    enabled: nearbyCenter !== null && mode === "nearby",
  });
  const importTrade = useMutation({
    mutationFn: (id: number) => api.importOfficialTransaction({ id }),
    onSuccess: (result) => {
      if (result.ok && result.id) {
        void queryClient.invalidateQueries({ queryKey: ["properties"] });
        onSelect(result.id);
      }
    },
  });
  const minValue = Number(minPyeong);
  const maxValue = Number(maxPyeong);
  const hasMin = minPyeong !== "" && Number.isFinite(minValue);
  const hasMax = maxPyeong !== "" && Number.isFinite(maxValue);
  const inBounds = (property: Property) => {
    if (!area?.bounds) return true;
    const [south, north, west, east] = area.bounds;
    return property.latitude >= south && property.latitude <= north && property.longitude >= west && property.longitude <= east;
  };
  const visibleProperties = properties.filter((property) => {
    const size = pyeong(property.areaSqm);
    return inBounds(property) && (!hasMin || size >= minValue) && (!hasMax || size <= maxValue);
  });
  const visibleTrades = (official.data?.transactions ?? []).filter((transaction) => {
    const size = pyeong(transaction.areaSqm);
    return (!hasMin || size >= minValue) && (!hasMax || size <= maxValue);
  });
  const visibleRents = (rentSearch.data?.transactions ?? []).filter((transaction) => {
    const size = pyeong(transaction.areaSqm);
    return (!hasMin || size >= minValue) && (!hasMax || size <= maxValue);
  });
  const mappableTrades = visibleTrades.filter((transaction): transaction is OfficialTransaction & { latitude: number; longitude: number } => transaction.latitude !== null && transaction.longitude !== null);
  const mappableRents = visibleRents.filter((transaction): transaction is OfficialRentTransaction & { latitude: number; longitude: number } => transaction.latitude !== null && transaction.longitude !== null);
  const nearbyApartments = nearbyQuery.data?.apartments ?? [];
  const nearbySaved = nearbyQuery.data?.savedProperties ?? [];
  const activeCoordinates: Array<[number, number]> = mode === "saved"
    ? visibleProperties.map((property) => [property.latitude, property.longitude])
    : mode === "rent"
      ? mappableRents.map((transaction) => [transaction.latitude, transaction.longitude])
      : mode === "nearby"
        ? [
            ...(nearbyCenter ? [[nearbyCenter.latitude, nearbyCenter.longitude] as [number, number]] : []),
            ...nearbyApartments.map((item) => [item.latitude, item.longitude] as [number, number]),
            ...nearbySaved.map((item) => [item.latitude, item.longitude] as [number, number]),
          ]
        : mappableTrades.map((transaction) => [transaction.latitude, transaction.longitude]);
  const resultBounds: Array<[number, number]> | null = activeCoordinates.length > 1 ? activeCoordinates : null;
  const areaBounds: Array<[number, number]> | null = area?.bounds
    ? [[area.bounds[0], area.bounds[2]] as [number, number], [area.bounds[1], area.bounds[3]] as [number, number]]
    : null;
  const firstCoordinate = activeCoordinates[0];
  const center: [number, number] = mode === "nearby" && nearbyCenter
    ? [nearbyCenter.latitude, nearbyCenter.longitude]
    : area
      ? [area.latitude, area.longitude]
      : firstCoordinate ?? defaultMapCenter;
  const viewportBounds = mode === "nearby" ? (resultBounds ?? null) : (areaBounds ?? resultBounds);
  const visibleCount = mode === "saved" ? visibleProperties.length : mode === "rent" ? visibleRents.length : mode === "nearby" ? nearbyApartments.length + nearbySaved.length : visibleTrades.length;
  const officialBusy = mode === "official" ? official.isPending : rentSearch.isPending;
  const officialQueryLabel = mode === "official" ? "매매 실거래 조회" : "전월세 실거래 조회";
  const officialStatus = mode === "official" ? official.data?.status : rentSearch.data?.status;
  const officialMessage = mode === "official" ? official.data?.message : rentSearch.data?.message;
  const officialSourceUrl = mode === "official" ? official.data?.sourceUrl : rentSearch.data?.sourceUrl;
  const officialFetchedAt = mode === "official" ? official.data?.fetchedAt : rentSearch.data?.fetchedAt;
  const visibleOfficial = mode === "official" ? visibleTrades : visibleRents;

  const requestLocation = () => {
    setLocationError(null);
    if (!("geolocation" in navigator)) {
      setLocationError("이 브라우저에서는 위치 기능을 사용할 수 없습니다. 아래 시·구 검색으로 지역을 먼저 조회해 보세요.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLocation(loc);
        setNearbyCenter(loc);
        setMode("nearby");
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) setLocationError("위치 권한이 거부됐습니다. 브라우저 설정에서 위치를 허용한 뒤 다시 눌러주세요.");
        else if (err.code === err.TIMEOUT) setLocationError("위치를 가져오는 데 시간이 오래 걸렸습니다. 다시 시도해 주세요.");
        else setLocationError("현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  };

  const useAreaAsNearbyCenter = () => {
    if (!area) return;
    setNearbyCenter({ latitude: area.latitude, longitude: area.longitude });
    setUserLocation(null);
    setLocationError(null);
    setMode("nearby");
  };

  const submitArea = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length >= 2) {
      resetOfficialQueries();
      geocode.mutate();
    }
  };

  return <main className="map-explorer">
    <header className="map-header">
      <button className="icon-button" aria-label="현장 보드로 돌아가기" onClick={onBack}><Icon name="back" /></button>
      <div><p className="eyebrow">지도 탐색</p><h1>지역별 임장 후보</h1></div>
      <button className="icon-button accent" aria-label="새 매물 등록" onClick={onAdd}><Icon name="plus" /></button>
    </header>

    <section className="map-controls" aria-label="지역과 평수로 매물 찾기">
      <div className="map-mode-switch nearby-switch" aria-label="지도 데이터 선택">
        <button className={mode === "official" ? "active" : ""} onClick={() => setMode("official")}>매매 실거래</button>
        <button className={mode === "rent" ? "active" : ""} onClick={() => setMode("rent")}>전월세 실거래</button>
        <button className={mode === "saved" ? "active" : ""} onClick={() => setMode("saved")}>저장한 임장지</button>
        <button className={mode === "nearby" ? "active" : ""} onClick={() => setMode("nearby")}>내 주변</button>
      </div>

      <div className="nearby-panel" aria-label="내 주변 실거래 찾기">
        <div className="nearby-panel-head">
          <div>
            <p className="eyebrow">현장 모드</p>
            <strong>내 주변 아파트 실거래 라벨</strong>
            <p>위치를 누르면 반경 안 단지명과 최근 신고 실거래가가 지도에 라벨로 뜹니다. 실거래는 신고 지연이 있어 현재 호가와 다를 수 있습니다.</p>
          </div>
          <button type="button" className="primary-button nearby-locate" disabled={locating} onClick={requestLocation} aria-label="현재 위치로 주변 아파트 찾기">
            <Icon name="locate" size={17} />{locating ? "위치 확인 중…" : "내 위치"}
          </button>
        </div>
        <div className="radius-switch" role="group" aria-label="주변 반경 선택">
          {([2, 5, 10] as const).map((value) => (
            <button key={value} type="button" className={radiusKm === value ? "active" : ""} aria-pressed={radiusKm === value} onClick={() => setRadiusKm(value)}>{value}km</button>
          ))}
          <span>{nearbyCenter ? (userLocation ? "현재 위치 기준" : "선택 지역 기준") : "위치를 먼저 눌러주세요"}</span>
        </div>
        {area && mode === "nearby" && !userLocation && (
          <button type="button" className="text-button" onClick={useAreaAsNearbyCenter}>검색한 지역을 중심으로 보기</button>
        )}
        {locationError && <p className="error-copy" role="alert">{locationError}</p>}
        {mode === "nearby" && nearbyQuery.isPending && <p className="source-note">주변 단지를 찾는 중…</p>}
        {mode === "nearby" && nearbyQuery.data?.message && <p className="notice">{nearbyQuery.data.message}</p>}
        <details className="hoga-note">
          <summary><Icon name="info" size={14} /> 다른 앱들은 실시간 호가를 어떻게 쓰나요?</summary>
          <div>
            <p><strong>실시간 호가는 공개 API가 없습니다.</strong> 네이버부동산·직방·호갱노노 같은 서비스는 자체 매물 DB와 중개사 제휴 피드를 내부 시스템으로 쌓아두고, 그 안에서만 호가를 보여줍니다. 외부 앱이 그대로 가져다 쓸 수 있는 공식 실시간 호가 API는 제공되지 않습니다.</p>
            <p>그래서 개인 앱은 보통 두 갈래로 갑니다. 하나는 이 앱처럼 <strong>국토부 실거래가(신고 기반, 후행 지표)</strong>를 공식 API로 받는 방식이고, 다른 하나는 네이버 매물 페이지를 자동 수집하는 방식인데, 조사에서 확인된 크롤러 사례들(freelife1191, ckh3455 등)은 봇 차단 때문에 장기 운영이 불안정하다고 적혀 있습니다. 이 앱은 그래서 수동 호가 기록 + 실거래 추적을 택했고, 이번 주변 라벨도 실거래 기준으로 표시합니다.</p>
            <p className="source-note">출처: 조사 리포트 — <a href="https://github.com/freelife1191/naver-real-estate-crawling" target="_blank" rel="noreferrer">freelife1191/naver-real-estate-crawling</a> · <a href="https://github.com/ckh3455/naver_land_daily" target="_blank" rel="noreferrer">ckh3455/naver_land_daily</a> · <a href="https://hogangnono.com" target="_blank" rel="noreferrer">호갱노노</a>. 네이버 크롤링 지속 가능성은 리포트에서 “미확인”으로 남아 있습니다.</p>
          </div>
        </details>
      </div>

      <form className="area-search" onSubmit={submitArea}>
        <label htmlFor="area-query">시·구 검색</label>
        <div><input id="area-query" value={query} onChange={(event) => { setQuery(event.target.value); setArea(null); setManualLawdCd(""); geocode.reset(); resetOfficialQueries(); }} placeholder="예: 서울 강남구, 수원시 영통구" /><button type="submit" disabled={query.trim().length < 2 || geocode.isPending}><Icon name="search" size={17} />{geocode.isPending ? "찾는 중" : "찾기"}</button></div>
      </form>
      {mode !== "saved" && mode !== "nearby" && <div className="official-fetch-row"><label><span>계약년월</span><input aria-label="실거래 계약년월" type="month" value={dealMonth} max={currentMonthValue()} onChange={(event) => { setDealMonth(event.target.value); resetOfficialQueries(); }} /></label><button className="primary-button" disabled={!effectiveLawdCd || officialBusy} onClick={() => { if (mode === "official") official.mutate(); else rentSearch.mutate(); }}><Icon name="refresh" size={17} />{officialBusy ? "조회 중…" : officialQueryLabel}</button></div>}
      <div className="size-filter">
        <label>평수 범위</label>
        <div><input aria-label="최소 평수" type="number" min="0" inputMode="decimal" value={minPyeong} onChange={(event) => setMinPyeong(event.target.value)} placeholder="최소" /><span>—</span><input aria-label="최대 평수" type="number" min="0" inputMode="decimal" value={maxPyeong} onChange={(event) => setMaxPyeong(event.target.value)} placeholder="최대" /><b>평</b></div>
      </div>
      {geocode.data && <div className="area-results" aria-label="지역 검색 결과">{geocode.data.candidates.map((candidate) => <button key={candidate.id} className={area?.id === candidate.id ? "active" : ""} onClick={() => { setArea(candidate); setNearbyCenter({ latitude: candidate.latitude, longitude: candidate.longitude }); resetOfficialQueries(); }}>{candidate.label}{candidate.lawdCd ? "" : " · 코드 확인 필요"}</button>)}{geocode.data.message && <p className="error-copy">{geocode.data.message}</p>}</div>}
      {mode !== "saved" && mode !== "nearby" && area && !area.lawdCd && <label className="manual-code"><span>법정동 코드 앞 5자리</span><input aria-label="법정동 코드 앞 5자리" inputMode="numeric" maxLength={5} value={manualLawdCd} onChange={(event) => { setManualLawdCd(event.target.value.replace(/\D/g, "").slice(0, 5)); resetOfficialQueries(); }} placeholder="예: 43111" /><small>자동 매칭되지 않은 지역만 입력하세요. 행정표준코드의 시·군·구 5자리입니다.</small></label>}
      {mode !== "saved" && mode !== "nearby" && officialStatus === "needs_connection" && <div className="connection-notice"><strong>공공데이터 API 연결 전입니다</strong><p>{officialMessage}</p><div><button type="button" onClick={onOpenSettings}>설정에서 인증키 입력</button>{officialSourceUrl && <a href={officialSourceUrl} target="_blank" rel="noreferrer">API 안내 ↗</a>}</div></div>}
      {mode !== "saved" && mode !== "nearby" && officialStatus === "error" && <p className="notice">{officialMessage}</p>}
      <div className="map-summary"><strong>{visibleCount}건</strong><span>{mode === "nearby" ? (nearbyCenter ? `반경 ${radiusKm}km · 단지 ${nearbyApartments.length}곳 · 저장 ${nearbySaved.length}곳` : "위치를 눌러 주변을 확인하세요") : area ? (area.regionName ?? area.label) : mode === "saved" ? "전체 저장 매물" : "지역을 먼저 선택하세요"}{hasMin || hasMax ? ` · ${minPyeong || "0"}–${maxPyeong || "∞"}평` : ""}</span>{area && <button onClick={() => { setArea(null); setQuery(""); setManualLawdCd(""); geocode.reset(); resetOfficialQueries(); }}>지역 해제</button>}</div>
    </section>

    <section className="map-canvas-wrap" aria-label={mode === "official" ? "국토교통부 실거래 지도" : mode === "rent" ? "국토교통부 전월세 실거래 지도" : mode === "nearby" ? "내 주변 아파트 실거래 지도" : "저장된 매물 지도"}>
      <MapContainer center={center} zoom={firstCoordinate ? 15 : 7} className="map-canvas" scrollWheelZoom={true} zoomControl={true} doubleClickZoom={true} dragging={true} attributionControl={true}>
        {vworldTile.tileUrl && (
          <TileLayer
            attribution={VWORLD_ATTRIBUTION}
            url={vworldTile.tileUrl}
            maxZoom={20}
            maxNativeZoom={19}
            eventHandlers={{
              load: () => setMapTileFailed(false),
              tileerror: () => setMapTileFailed(true),
            }}
          />
        )}
        <MapViewport bounds={viewportBounds} center={center} zoom={mode === "nearby" && nearbyCenter ? (radiusKm <= 2 ? 14 : radiusKm <= 5 ? 13 : 12) : firstCoordinate ? 15 : area ? 12 : 7} />
        {mode === "nearby" && nearbyCenter && (
          <>
            <Circle center={[nearbyCenter.latitude, nearbyCenter.longitude]} radius={radiusKm * 1000} pathOptions={{ color: "#e7662b", weight: 2, fillColor: "#e7662b", fillOpacity: 0.08 }} />
            <Marker position={[nearbyCenter.latitude, nearbyCenter.longitude]} icon={divIcon({ className: "nearby-center-marker", html: `<span>현재 위치</span>`, iconSize: [76, 28], iconAnchor: [38, 14] })}>
              <Popup><div className="map-popup"><strong>{userLocation ? "현재 위치" : "선택한 지역 중심"}</strong><span>반경 {radiusKm}km 안의 아파트 실거래 라벨을 표시합니다.</span></div></Popup>
            </Marker>
            {nearbyApartments.map((item) => (
              <Marker key={`${item.apartmentName}-${item.latitude}-${item.longitude}`} position={[item.latitude, item.longitude]} icon={divIcon({ className: "nearby-apartment-marker", html: `<span><strong>${escapeHtml(item.apartmentName)}</strong><small>${money(item.latestPriceMan)} · ${pyeong(item.latestAreaSqm).toFixed(0)}평</small></span>`, iconSize: [150, 44], iconAnchor: [75, 22], popupAnchor: [0, -20] })}>
                <Popup>
                  <div className="map-popup">
                    <strong>{item.apartmentName}</strong>
                    <span>{item.roadAddress ?? item.legalDong} · {item.distanceKm.toFixed(1)}km</span>
                    <b>최근 {item.latestDealYmd} · {money(item.latestPriceMan)} · {pyeong(item.latestAreaSqm).toFixed(1)}평{item.latestFloor !== null ? ` · ${item.latestFloor}층` : ""}</b>
                    <span>이 단지 신고 {item.tradeCount}건 · 중앙값 {item.medianPriceMan !== null ? money(item.medianPriceMan) : "—"}</span>
                    <span>국토부 신고 실거래 기준 · 조회 {formatUpdated(item.fetchedAt)}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
            {nearbySaved.map((item) => (
              <Marker key={`saved-${item.id}`} position={[item.latitude, item.longitude]} icon={divIcon({ className: "nearby-saved-marker", html: `<span><strong>${escapeHtml(item.name)}</strong><small>저장 · ${money(item.askingPriceMan)}</small></span>`, iconSize: [140, 40], iconAnchor: [70, 20], popupAnchor: [0, -18] })}>
                <Popup><div className="map-popup"><strong>{item.name}</strong><span>{item.address} · {item.distanceKm.toFixed(1)}km</span><b>{pyeong(item.areaSqm).toFixed(1)}평 · {money(item.askingPriceMan)}</b><button onClick={() => onSelect(item.id)}>임장자료 열기</button></div></Popup>
              </Marker>
            ))}
          </>
        )}
        {mode === "saved" && visibleProperties.map((property) => <Marker key={property.id} position={[property.latitude, property.longitude]} icon={divIcon({ className: "property-map-marker", html: `<span>${pyeong(property.areaSqm).toFixed(0)}평</span>`, iconSize: [48, 31], iconAnchor: [24, 31], popupAnchor: [0, -28] })}><Popup><div className="map-popup"><strong>{property.name}</strong><span>{property.address}</span><b>{pyeong(property.areaSqm).toFixed(1)}평 · {money(property.askingPriceMan)}</b><button onClick={() => onSelect(property.id)}>임장자료 열기</button></div></Popup></Marker>)}
        {mode === "official" && mappableTrades.map((transaction) => <Marker key={transaction.id} position={[transaction.latitude, transaction.longitude]} icon={divIcon({ className: "property-map-marker official", html: `<span>${pyeong(transaction.areaSqm).toFixed(0)}평</span>`, iconSize: [48, 31], iconAnchor: [24, 31], popupAnchor: [0, -28] })}><Popup><div className="map-popup"><strong>{transaction.apartmentName}</strong><span>{transaction.roadAddress ?? `${transaction.legalDong} ${transaction.jibun ?? ""}`}</span><b>{pyeong(transaction.areaSqm).toFixed(1)}평 · {money(transaction.dealAmountMan)}</b><button onClick={() => setSelectedTrade(transaction)}>거래 상세 보기</button></div></Popup></Marker>)}
        {mode === "rent" && mappableRents.map((transaction) => <Marker key={transaction.id} position={[transaction.latitude, transaction.longitude]} icon={divIcon({ className: "property-map-marker rent", html: `<span>${pyeong(transaction.areaSqm).toFixed(0)}평</span>`, iconSize: [48, 31], iconAnchor: [24, 31], popupAnchor: [0, -28] })}><Popup><div className="map-popup"><strong>{transaction.apartmentName}</strong><span>{transaction.roadAddress ?? `${transaction.legalDong} ${transaction.jibun ?? ""}`}</span><b>{pyeong(transaction.areaSqm).toFixed(1)}평 · {rentSummary(transaction).kind} {rentSummary(transaction).price}</b><button onClick={() => setSelectedRent(transaction)}>거래 상세 보기</button></div></Popup></Marker>)}
      </MapContainer>
      {!vworldTile.isPending && !vworldTile.configured && (
        <div className="map-key-guide" role="status">
          <Icon name="key" size={22} />
          <strong>배경지도 키가 없습니다</strong>
          <p>지도 배경은 국토교통부 브이월드 타일을 씁니다. 설정에서 무료 VWorld API 키를 등록하면 배경지도가 표시되고, 마커와 목록은 지금도 그대로 쓸 수 있습니다.</p>
          <button type="button" className="primary-button" onClick={onOpenSettings}><Icon name="key" size={16} /> 설정에서 VWorld 키 등록</button>
        </div>
      )}
      {vworldTile.configured && mapTileFailed && <div className="map-tile-warning" role="status"><strong>배경지도를 불러오지 못했습니다</strong><span>키의 도메인 허용 범위에 이 앱 주소가 포함되어 있는지 확인해 주세요. 아래 목록은 그대로 사용할 수 있습니다.</span><a href={`https://www.google.com/maps/search/?api=1&query=${center[0]},${center[1]}`} target="_blank" rel="noreferrer">Google 지도에서 이 지역 열기</a></div>}
      {mode === "nearby" && !nearbyCenter && <div className="map-empty"><Icon name="locate" size={26} /><strong>내 위치를 눌러주세요</strong><p>현재 위치를 기준으로 반경 {radiusKm}km 안의 아파트 실거래 라벨을 보여줍니다. 위치 권한이 필요합니다.</p><button className="primary-button" disabled={locating} onClick={requestLocation}><Icon name="locate" size={16} />{locating ? "위치 확인 중…" : "내 위치 찾기"}</button></div>}
      {mode === "nearby" && nearbyCenter && nearbyQuery.isPending && <div className="map-empty"><span className="loading-mark" /><strong>주변 단지를 찾는 중…</strong><p>저장된 실거래 좌표에서 반경 {radiusKm}km 안을 계산합니다.</p></div>}
      {mode === "nearby" && nearbyCenter && !nearbyQuery.isPending && nearbyApartments.length === 0 && nearbySaved.length === 0 && <div className="map-empty"><Icon name="pin" size={26} /><strong>이 반경에는 아직 표시할 단지가 없습니다</strong><p>{nearbyQuery.data?.message ?? "이 지역의 실거래를 먼저 조회하면 단지가 쌓입니다."}</p></div>}
      {mode === "saved" && visibleProperties.length === 0 && <div className="map-empty"><Icon name="pin" size={26} /><strong>조건에 맞는 저장 매물이 없습니다</strong><p>이 지역의 매물을 등록하면 지도에서 위치와 평수를 함께 비교할 수 있습니다.</p><button className="primary-button" onClick={onAdd}><Icon name="plus" /> 이 지역 매물 등록</button></div>}
      {mode !== "saved" && mode !== "nearby" && !officialBusy && visibleOfficial.length === 0 && officialStatus !== "needs_connection" && <div className="map-empty"><Icon name="pin" size={26} /><strong>{area ? "조회된 실거래가 없습니다" : "시·구를 먼저 찾아보세요"}</strong><p>{area ? "계약년월이나 평수 범위를 바꿔 다시 확인해 보세요." : "지역을 선택하면 국토교통부 신고 거래를 지도와 목록에서 확인할 수 있습니다."}</p></div>}
      {mode !== "saved" && mode !== "nearby" && officialBusy && <div className="map-empty"><span className="loading-mark" /><strong>실거래와 위치를 확인하는 중…</strong><p>국토교통부 자료를 읽고 일부 단지 위치를 확인합니다.</p></div>}
    </section>

    <section className="map-results">
      <div className="section-heading"><div><p className="eyebrow">{mode === "official" ? "신고 거래 물량" : mode === "rent" ? "신고 임대차 물량" : mode === "nearby" ? "반경 안 단지" : "검색 물량"}</p><h2>{mode === "official" ? "실거래 내역" : mode === "rent" ? "전월세 실거래 내역" : mode === "nearby" ? "주변 아파트" : "지도에 보이는 매물"}</h2></div><span>{visibleCount}건</span></div>
      {mode !== "saved" && mode !== "nearby" && officialFetchedAt && <p className="source-note">국토교통부 · {formatUpdated(officialFetchedAt)} 조회 · 신고 지연·정정될 수 있으며, 개인정보 보호를 위해 동·호는 제공되지 않습니다.</p>}
      {mode === "nearby" && nearbyQuery.data?.fetchedAt && <p className="source-note">국토교통부 신고 실거래 · {formatUpdated(nearbyQuery.data.fetchedAt)} 기준 저장본 · 직선거리 기준이며 실제 도보 거리와 다를 수 있습니다. <a href={nearbyQuery.data.sourceUrl} target="_blank" rel="noreferrer">공식 출처 ↗</a></p>}
      {mode === "nearby" ? (
        !nearbyCenter ? <p className="empty-copy">상단의 ‘내 위치’를 누르면 현재 위치를 중심으로 주변 아파트가 거리 순으로 정렬됩니다.</p>
        : nearbyQuery.isPending ? <p className="empty-copy">주변 단지를 계산하는 중…</p>
        : nearbyApartments.length === 0 && nearbySaved.length === 0 ? <p className="empty-copy">{nearbyQuery.data?.message ?? "이 반경에는 아직 표시할 단지가 없습니다."}</p>
        : <>
            {nearbySaved.length > 0 && <div className="nearby-group"><h3>저장한 임장지 · {nearbySaved.length}곳</h3>{nearbySaved.map((item) => <button key={item.id} onClick={() => onSelect(item.id)}><span className="result-pin saved"><Icon name="pin" size={16} /></span><span><strong>{item.name}</strong><small>{item.address} · {item.distanceKm.toFixed(1)}km</small></span><span><b>{pyeong(item.areaSqm).toFixed(1)}평</b><small>{money(item.askingPriceMan)}</small></span></button>)}</div>}
            {nearbyApartments.length > 0 && <div className="nearby-group"><h3>실거래 단지 · {nearbyApartments.length}곳 (가까운 순)</h3>{nearbyApartments.map((item) => <div key={`${item.apartmentName}-${item.latitude}-${item.longitude}`} className="nearby-result-row"><span className="result-pin official"><Icon name="pin" size={16} /></span><span><strong>{item.apartmentName}</strong><small>{item.roadAddress ?? item.legalDong} · {item.distanceKm.toFixed(1)}km · 신고 {item.tradeCount}건</small></span><span><b>{money(item.latestPriceMan)}</b><small>{item.latestDealYmd} · {pyeong(item.latestAreaSqm).toFixed(1)}평</small></span></div>)}</div>}
          </>
      ) : mode === "saved" ? (visibleProperties.length === 0 ? <p className="empty-copy">등록된 매물이 생기면 이 목록에서도 주소, 평수, 호가를 확인할 수 있습니다.</p> : visibleProperties.map((property) => <button key={property.id} onClick={() => onSelect(property.id)}><span className="result-pin"><Icon name="pin" size={16} /></span><span><strong>{property.name}</strong><small>{property.address}</small></span><span><b>{pyeong(property.areaSqm).toFixed(1)}평</b><small>{money(property.askingPriceMan)}</small></span></button>))
        : mode === "official" ? (visibleTrades.length === 0 ? <p className="empty-copy">지역과 계약년월을 선택한 뒤 실거래 조회를 눌러주세요.</p> : visibleTrades.map((transaction) => <button key={transaction.id} onClick={() => setSelectedTrade(transaction)}><span className="result-pin official"><Icon name="pin" size={16} /></span><span><strong>{transaction.apartmentName}</strong><small>{transaction.dealYmd} · {transaction.legalDong}{transaction.floor === null ? "" : ` · ${transaction.floor}층`}</small></span><span><b>{pyeong(transaction.areaSqm).toFixed(1)}평</b><small>{money(transaction.dealAmountMan)}</small></span></button>))
        : (visibleRents.length === 0 ? <p className="empty-copy">지역과 계약년월을 선택한 뒤 전월세 조회를 눌러주세요.</p> : visibleRents.map((transaction) => <button key={transaction.id} onClick={() => setSelectedRent(transaction)}><span className="result-pin rent"><Icon name="pin" size={16} /></span><span><strong><i className={`trade-kind ${rentSummary(transaction).kind === "전세" ? "jeonse" : "wolse"}`}>{rentSummary(transaction).kind}</i>{transaction.apartmentName}</strong><small>{transaction.dealYmd} · {transaction.legalDong}{transaction.floor === null ? "" : ` · ${transaction.floor}층`}</small></span><span><b>{pyeong(transaction.areaSqm).toFixed(1)}평</b><small>{rentSummary(transaction).price}</small></span></button>))}
    </section>

    {selectedTrade && <div className="modal-backdrop" role="presentation"><section className="trade-sheet" role="dialog" aria-modal="true" aria-labelledby="trade-title"><div className="form-head"><div><p className="eyebrow">국토교통부 신고 거래</p><h2 id="trade-title">{selectedTrade.apartmentName}</h2></div><button className="close-button" aria-label="실거래 상세 닫기" onClick={() => { setSelectedTrade(null); importTrade.reset(); }}>닫기</button></div><dl className="trade-facts"><div><dt>계약일</dt><dd>{selectedTrade.dealYmd}</dd></div><div><dt>거래금액</dt><dd>{money(selectedTrade.dealAmountMan)}</dd></div><div><dt>전용면적</dt><dd>{selectedTrade.areaSqm.toFixed(2)}㎡ · {pyeong(selectedTrade.areaSqm).toFixed(1)}평</dd></div><div><dt>층</dt><dd>{selectedTrade.floor === null ? "정보 없음" : `${selectedTrade.floor}층`}</dd></div><div><dt>건축년도</dt><dd>{selectedTrade.buildYear ?? "정보 없음"}</dd></div><div><dt>거래유형</dt><dd>{selectedTrade.dealingType ?? "정보 없음"}</dd></div><div><dt>등기일자</dt><dd>{selectedTrade.registrationDate || "정보 없음"}</dd></div><div><dt>거래주체</dt><dd>{selectedTrade.sellerType || selectedTrade.buyerType ? `매도 ${selectedTrade.sellerType ?? "-"} · 매수 ${selectedTrade.buyerType ?? "-"}` : "정보 없음"}</dd></div><div><dt>중개사 소재지</dt><dd>{selectedTrade.estateAgentDistrict || "정보 없음"}</dd></div><div><dt>동</dt><dd>{selectedTrade.apartmentDong || "정보 없음"}</dd></div></dl><p className="trade-response-note">{selectedTrade.apiVariant === "detail" ? "상세 API 응답" : "기본 API 폴백 응답 · 신규 상세 항목은 제공되지 않을 수 있습니다."}</p><p className="trade-address"><Icon name="pin" size={17} />{selectedTrade.roadAddress ?? `${selectedTrade.regionLabel} ${selectedTrade.legalDong} ${selectedTrade.jibun ?? ""}`}</p>{importTrade.data?.message && <p className="error-copy">{importTrade.data.message}</p>}<div className="trade-actions"><a className="secondary-button" href={official.data?.sourceUrl ?? "https://www.data.go.kr/data/15126469/openapi.do"} target="_blank" rel="noreferrer">공식 출처</a><button className="primary-button" disabled={importTrade.isPending} onClick={() => importTrade.mutate(selectedTrade.id)}>{importTrade.isPending ? "가져오는 중…" : "임장자료로 가져오기"}</button></div></section></div>}

    {selectedRent && <div className="modal-backdrop" role="presentation"><section className="trade-sheet" role="dialog" aria-modal="true" aria-labelledby="rent-title"><div className="form-head"><div><p className="eyebrow">국토교통부 {rentSummary(selectedRent).kind} 신고 거래</p><h2 id="rent-title">{selectedRent.apartmentName}</h2></div><button className="close-button" aria-label="전월세 거래 상세 닫기" onClick={() => setSelectedRent(null)}>닫기</button></div><dl className="trade-facts"><div><dt>계약일</dt><dd>{selectedRent.dealYmd}</dd></div><div><dt>거래유형</dt><dd>{rentSummary(selectedRent).kind}</dd></div><div><dt>보증금</dt><dd>{money(selectedRent.depositMan)}원</dd></div><div><dt>월세</dt><dd>{selectedRent.monthlyRentMan === 0 ? "없음 (전세)" : `${money(selectedRent.monthlyRentMan)}원`}</dd></div><div><dt>전용면적</dt><dd>{selectedRent.areaSqm.toFixed(2)}㎡ · {pyeong(selectedRent.areaSqm).toFixed(1)}평</dd></div><div><dt>층</dt><dd>{selectedRent.floor === null ? "정보 없음" : `${selectedRent.floor}층`}</dd></div><div><dt>계약기간</dt><dd>{selectedRent.contractTerm ?? "정보 없음"}</dd></div><div><dt>건축년도</dt><dd>{selectedRent.buildYear ?? "정보 없음"}</dd></div><div><dt>중개사 소재지</dt><dd>{selectedRent.estateAgentDistrict || "정보 없음"}</dd></div></dl><p className="trade-response-note">신고·확정일자 자료 기준. 개인정보 보호를 위해 동·호 등 개별 세대 식별 정보는 제공되지 않습니다.</p><p className="trade-address"><Icon name="pin" size={17} />{selectedRent.roadAddress ?? `${selectedRent.regionLabel} ${selectedRent.legalDong} ${selectedRent.jibun ?? ""}`}</p><div className="trade-actions"><a className="secondary-button" href={rentSearch.data?.sourceUrl ?? "https://www.data.go.kr/data/15126474/openapi.do"} target="_blank" rel="noreferrer">공식 출처</a></div></section></div>}
  </main>;
}

type ComparisonItem = ApiResponse<typeof api, "getComparisonBoard">["items"][number];

function ComparisonView({ properties, onBack, onOpenProperty, onOpenDecision, onOpenCourse }: { properties: Property[]; onBack: () => void; onOpenProperty: (id: number) => void; onOpenDecision: () => void; onOpenCourse: (id: number) => void }) {
  const queryClient = useQueryClient();
  const board = useQuery({ queryKey: ["comparison-board"], queryFn: () => api.getComparisonBoard({}) });
  const selectedIds = board.data?.items.map((item) => item.property.id) ?? [];
  const selectedFinal = board.data?.items.find((item) => item.finalSelected) ?? null;
  const choose = useMutation({
    mutationFn: (propertyIds: number[]) => api.setComparisonCandidates({ propertyIds }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["comparison-board"] }),
  });
  const finalChoice = useMutation({
    mutationFn: (propertyId: number) => api.setComparisonFinal({ propertyId }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["comparison-board"] }),
  });
  const createCourse = useMutation({
    mutationFn: (propertyIds: number[]) => api.createTourCourse({ title: `임장 코스 · 후보 ${propertyIds.length}곳`, visitDate: null, notes: "", propertyIds }),
    onSuccess: (result) => {
      if (result.ok && result.id !== null) {
        void queryClient.invalidateQueries({ queryKey: ["tour-courses"] });
        onOpenCourse(result.id);
      }
    },
  });

  const toggle = (id: number) => {
    if (choose.isPending) return;
    if (selectedIds.includes(id)) {
      if (selectedIds.length === 1) return;
      choose.mutate(selectedIds.filter((candidateId) => candidateId !== id));
      return;
    }
    if (selectedIds.length >= 3) return;
    choose.mutate([...selectedIds, id]);
  };

  return <main className="comparison-page">
    <header className="comparison-header">
      <button className="icon-button" aria-label="현장 보드로 돌아가기" onClick={onBack}><Icon name="back" /></button>
      <div><p className="eyebrow">의사결정</p><h1>단지·매물 비교 평가</h1></div>
      <span className="compare-count">{selectedIds.length}/3</span>
    </header>

    <section className="comparison-picker" aria-labelledby="comparison-picker-title">
      <div className="comparison-picker-copy"><h2 id="comparison-picker-title">후보 선택</h2><p>최대 3곳의 사진, 현장 기록과 판단을 한 화면에서 대조합니다.</p></div>
      {properties.length === 0 ? <p className="empty-copy">비교할 매물을 먼저 등록해 주세요.</p> : <div className="candidate-chips">{properties.map((property) => {
        const active = selectedIds.includes(property.id);
        const disabled = !active && selectedIds.length >= 3;
        return <button key={property.id} className={active ? "active" : ""} disabled={disabled || choose.isPending} aria-pressed={active} onClick={() => toggle(property.id)}><span>{active ? <Icon name="check" size={15} /> : String(properties.indexOf(property) + 1).padStart(2, "0")}</span>{property.name}</button>;
      })}</div>}
      {selectedIds.length === 1 && <p className="picker-hint">비교 후보는 최소 1곳을 유지합니다. 다른 후보를 추가한 뒤 제외할 수 있습니다.</p>}
      {selectedIds.length >= 3 && <p className="picker-hint">3곳을 선택했습니다. 다른 후보를 넣으려면 하나를 먼저 제외하세요.</p>}
      {selectedIds.length >= 1 && <div className="comparison-actions"><button className="secondary-button" disabled={createCourse.isPending} onClick={() => createCourse.mutate(selectedIds)}><Icon name="route" size={16} />{createCourse.isPending ? "코스 만드는 중…" : "선택 후보로 코스 만들기"}</button></div>}
      {createCourse.data && !createCourse.data.ok && <p className="error-copy" role="alert">{createCourse.data.message ?? "코스를 만들지 못했습니다."}</p>}
    </section>

    {selectedFinal && <section className="final-action-banner"><div><p className="eyebrow">최종 선정 · {selectedFinal.property.name}</p><h2>선정 결과를 다음 행동으로 이어가세요</h2><p>재임장 검증, 의사결정 리포트, 가격 추적, 매수 가능성 계산을 한곳에서 실행합니다.</p></div><button className="primary-button" onClick={onOpenDecision}>선정 후 실행</button></section>}

    {board.isPending ? <div className="comparison-loading"><span className="loading-mark" />비교판을 불러오는 중…</div> : board.data?.items.length ? <section className={`comparison-grid count-${board.data.items.length}`} aria-label="선택한 후보 비교">
      {board.data.items.map((item) => <ComparisonCard key={item.property.id} item={item} onOpen={() => onOpenProperty(item.property.id)} onFinal={() => finalChoice.mutate(item.property.id)} finalPending={finalChoice.isPending} />)}
    </section> : <section className="comparison-empty"><div className="compare-symbol"><Icon name="compare" size={30} /></div><h2>비교할 후보를 골라주세요</h2><p>위 목록에서 첫 단지나 매물을 선택하면 비교판이 열립니다.</p></section>}

    <footer className="comparison-source">비교평가 모드 참고 · <a href="https://github.com/ljhdy/dotherich" target="_blank" rel="noreferrer">doTheRich 원문 ↗</a></footer>
  </main>;
}

type DecisionSupport = ApiResponse<typeof api, "getDecisionSupport">;
type DecisionSection = "revisit" | "report" | "price" | "finance";

function calculateFinance(values: { purchasePriceMan: number; ownFundsMan: number; annualIncomeMan: number; otherAnnualDebtMan: number; loanRatePct: number; loanYears: number; ltvPct: number; acquisitionTaxPct: number; brokeragePct: number }) {
  const acquisitionTax = values.purchasePriceMan * values.acquisitionTaxPct / 100;
  const brokerage = values.purchasePriceMan * values.brokeragePct / 100;
  const totalCost = values.purchasePriceMan + acquisitionTax + brokerage;
  const requiredLoan = Math.max(0, totalCost - values.ownFundsMan);
  const ltvLimit = values.purchasePriceMan * values.ltvPct / 100;
  const loan = Math.min(requiredLoan, ltvLimit);
  const fundingGap = Math.max(0, requiredLoan - loan);
  const months = values.loanYears * 12;
  const monthlyRate = values.loanRatePct / 1200;
  const monthlyPayment = months <= 0 ? 0 : monthlyRate === 0 ? loan / months : loan * monthlyRate * (1 + monthlyRate) ** months / ((1 + monthlyRate) ** months - 1);
  const dsr = values.annualIncomeMan > 0 ? ((monthlyPayment * 12 + values.otherAnnualDebtMan) / values.annualIncomeMan) * 100 : null;
  return { acquisitionTax, brokerage, totalCost, loan, fundingGap, monthlyPayment, dsr };
}

function DecisionHub({ onBack, onOpenProperty }: { onBack: () => void; onOpenProperty: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<DecisionSection>("revisit");
  const board = useQuery({ queryKey: ["comparison-board"], queryFn: () => api.getComparisonBoard({}) });
  const selected = board.data?.items.find((item) => item.finalSelected) ?? null;
  const propertyId = selected?.property.id ?? 0;
  const detail = useQuery({ queryKey: ["property", propertyId], queryFn: () => api.getPropertyDetail({ id: propertyId }), enabled: propertyId > 0 });
  const support = useQuery({ queryKey: ["decision-support", propertyId], queryFn: () => api.getDecisionSupport({ propertyId }), enabled: propertyId > 0 });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["decision-support", propertyId] });
  const generate = useMutation({ mutationFn: () => api.generateRevisitPlan({ propertyId }), onSuccess: invalidate });
  const addTask = useMutation({ mutationFn: (label: string) => api.addRevisitTask({ propertyId, label }), onSuccess: invalidate });
  const updateTask = useMutation({ mutationFn: (payload: { id: number; completed: boolean; note: string }) => api.updateRevisitTask(payload), onSuccess: invalidate });
  const startTracking = useMutation({ mutationFn: (targetPriceMan: number | null) => api.startPriceTracking({ propertyId, targetPriceMan }), onSuccess: invalidate });
  const addSnapshot = useMutation({ mutationFn: (payload: { amountMan: number; kind: "asking" | "official_trade"; note: string }) => api.addPriceSnapshot({ propertyId, ...payload }), onSuccess: invalidate });
  const saveFinance = useMutation({ mutationFn: (payload: Parameters<typeof api.saveFinanceScenario>[0]) => api.saveFinanceScenario(payload), onSuccess: invalidate });
  const [customTask, setCustomTask] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [snapshotAmount, setSnapshotAmount] = useState("");
  const [snapshotKind, setSnapshotKind] = useState<"asking" | "official_trade">("asking");
  const [snapshotNote, setSnapshotNote] = useState("");
  const [finance, setFinance] = useState({ purchasePriceMan: "", ownFundsMan: "", annualIncomeMan: "", otherAnnualDebtMan: "", loanRatePct: "", loanYears: "", ltvPct: "", acquisitionTaxPct: "", brokeragePct: "" });

  useEffect(() => {
    if (!selected) return;
    setSnapshotAmount(String(selected.property.askingPriceMan));
    setFinance((current) => current.purchasePriceMan ? current : { ...current, purchasePriceMan: String(selected.property.askingPriceMan) });
  }, [selected]);
  useEffect(() => {
    const saved = support.data?.financeScenario;
    if (!saved) return;
    setFinance({ purchasePriceMan: String(saved.purchasePriceMan), ownFundsMan: String(saved.ownFundsMan), annualIncomeMan: String(saved.annualIncomeMan), otherAnnualDebtMan: String(saved.otherAnnualDebtMan), loanRatePct: String(saved.loanRatePct), loanYears: String(saved.loanYears), ltvPct: String(saved.ltvPct), acquisitionTaxPct: String(saved.acquisitionTaxPct), brokeragePct: String(saved.brokeragePct) });
  }, [support.data?.financeScenario]);
  useEffect(() => {
    const target = support.data?.priceTracker?.targetPriceMan;
    if (target !== undefined) setTargetPrice(target === null ? "" : String(target));
  }, [support.data?.priceTracker?.targetPriceMan]);

  if (board.isPending) return <div className="loading-screen"><span className="loading-mark" />선정 결과를 불러오는 중…</div>;
  if (!selected) return <main className="decision-page"><header className="decision-header"><button className="icon-button" aria-label="비교 화면으로 돌아가기" onClick={onBack}><Icon name="back" /></button><div><p className="eyebrow">선정 후 실행</p><h1>최종 후보가 필요합니다</h1></div><span /></header><section className="decision-empty"><h2>비교 화면에서 최종 후보를 선정해 주세요</h2><p>선정된 매물을 기준으로 재임장, 리포트, 가격 추적과 자금 계산이 연결됩니다.</p><button className="primary-button" onClick={onBack}>비교 화면으로</button></section></main>;

  const supportData = support.data;
  const tracker = supportData?.priceTracker ?? null;
  const snapshots = supportData?.priceSnapshots ?? [];
  const listingSummaries = supportData?.listingSummaries ?? [];
  const latest = snapshots[0];
  const previous = snapshots[1];
  const priceDelta = latest && previous ? latest.amountMan - previous.amountMan : null;
  const targetReached = Boolean(tracker?.targetPriceMan !== null && tracker?.targetPriceMan !== undefined && latest && latest.amountMan <= tracker.targetPriceMan);
  const financeNumbers = {
    purchasePriceMan: Number(finance.purchasePriceMan) || 0,
    ownFundsMan: Number(finance.ownFundsMan) || 0,
    annualIncomeMan: Number(finance.annualIncomeMan) || 0,
    otherAnnualDebtMan: Number(finance.otherAnnualDebtMan) || 0,
    loanRatePct: Number(finance.loanRatePct) || 0,
    loanYears: Number(finance.loanYears) || 0,
    ltvPct: Number(finance.ltvPct) || 0,
    acquisitionTaxPct: Number(finance.acquisitionTaxPct) || 0,
    brokeragePct: Number(finance.brokeragePct) || 0,
  };
  const financeResult = calculateFinance(financeNumbers);
  const financeValid = financeNumbers.purchasePriceMan > 0 && financeNumbers.loanYears > 0;
  const reasonLabel = (reason: DecisionSupport["revisitTasks"][number]["reason"]) => reason === "unchecked" ? "미확인" : reason === "missing_note" ? "현장 메모 없음" : "직접 추가";

  const downloadReport = () => {
    const selectedDetail = detail.data;
    const completed = selectedDetail?.checklist.filter((item) => item.checked).length ?? 0;
    const voiceMemos = selectedDetail?.voiceMemos ?? [];
    const listingLabelById = new Map(listingSummaries.map((listing) => [listing.id, listingDongHo(listing.dong, listing.ho) || "매물 기록"]));
    const voiceMemoLines = voiceMemos.map((memo) => {
      const duration = formatDuration(memo.durationSec);
      const linkLabel = voiceLinkedLabel(memo, (id) => {
        const label = listingLabelById.get(id);
        return label ? `매물 · ${label}` : "매물 기록";
      });
      return `- ${memo.title || "음성 메모"}${linkLabel ? ` · ${linkLabel}` : ""}${duration ? ` · ${duration}` : ""} · ${new Date(memo.createdAt).toLocaleDateString("ko-KR")}`;
    }).join("\n") || "- 기록된 음성 메모 없음";
    const comparisonLines = (board.data?.items ?? []).map((item) => `| ${item.finalSelected ? "최종" : `후보 ${item.position + 1}`} | ${item.property.name} | ${money(item.property.askingPriceMan)} | ${pyeong(item.property.areaSqm).toFixed(1)}평 | ${item.checklistDone}/${item.checklistTotal} | ${item.conclusion || "미작성"} |`).join("\n");
    const checklistLines = CHECKLIST_GROUPS.flatMap((group) => group.items).map(([key, label]) => {
      const entry = selectedDetail?.checklist.find((item) => item.itemKey === key);
      return `- [${entry?.checked ? "x" : " "}] ${label}${entry?.note ? ` — ${entry.note}` : ""}`;
    }).join("\n");
    const revisitLines = (supportData?.revisitTasks ?? []).map((task) => `- [${task.completed ? "x" : " "}] ${task.label} (${reasonLabel(task.reason)})${task.note ? ` — ${task.note}` : ""}`).join("\n") || "- 생성된 재임장 항목 없음";
    const priceLines = snapshots.map((snapshot) => `- ${new Date(snapshot.recordedAt).toLocaleDateString("ko-KR")}: ${money(snapshot.amountMan)} · ${snapshot.kind === "asking" ? "호가" : "신고 실거래"}${snapshot.note ? ` · ${snapshot.note}` : ""}`).join("\n") || "- 추적 기록 없음";
    const listingRows = listingSummaries.map((listing) => {
      const dongHo = listingDongHo(listing.dong, listing.ho) || "미기재";
      const delta = listing.priceChangeMan === null || listing.priceChangeMan === 0 ? "-" : `${listing.priceChangeMan < 0 ? "▼" : "▲"}${money(Math.abs(listing.priceChangeMan))}`;
      return `| ${dongHo} | ${TRADE_TYPE_LABEL[listing.tradeType]} | ${listingPriceText(listing.tradeType, listing.priceMan, listing.monthlyRentMan)} | ${delta} · ${listing.logCount}건 | ${LISTING_STATUS_LABEL[listing.status]} | ${listing.brokerName || "-"} | ${listing.targetPriceMan === null ? "-" : money(listing.targetPriceMan)} |`;
    }).join("\n");
    const listingSection = listingSummaries.length === 0 ? "- 기록된 매물 없음" : `| 동호수 | 거래 유형 | 현재 호가 | 호가 변동 | 상태 | 중개업소 | 목표가 |\n|---|---|---|---|---|---|---|\n${listingRows}`;
    const financeLines = supportData?.financeScenario ? `- 총 필요자금: ${money(Math.round(financeResult.totalCost))}\n- 예상 대출: ${money(Math.round(financeResult.loan))}\n- 자금 부족분: ${money(Math.round(financeResult.fundingGap))}\n- 월 원리금: ${money(Math.round(financeResult.monthlyPayment))}\n- 단순 DSR: ${financeResult.dsr === null ? "소득 미입력" : `${financeResult.dsr.toFixed(1)}%`}` : "- 저장된 시뮬레이션 없음";
    const markdown = `# ${selected.property.name} 임장 의사결정 리포트\n\n생성일: ${new Date().toLocaleDateString("ko-KR")}\n\n## 결론\n${selected.conclusion || "최종 결론 미작성"}\n\n## 후보 비교\n| 구분 | 후보 | 가격 | 면적 | 현장 확인 | 결론 |\n|---|---|---:|---:|---:|---|\n${comparisonLines}\n\n## 선정 근거\n- 비교 메모: ${selected.comparisonNote || "미작성"}\n- 가치평가: ${selected.valueAssessment || "미작성"}\n- 현장 확인: ${completed}/${CHECKLIST_GROUPS.flatMap((group) => group.items).length}\n- 현장 사진: ${selectedDetail?.photos.length ?? 0}장\n- 음성 메모: ${voiceMemos.length}개\n\n## 현장 체크리스트\n${checklistLines}\n\n## 음성 메모\n${voiceMemoLines}\n\n## 재임장 검증 플랜\n${revisitLines}\n\n## 매물별 기록\n${listingSection}\n\n## 가격 기록\n${priceLines}\n\n## 매수 시뮬레이션\n${financeLines}\n\n> 음성 녹음 파일은 앱에서 재생할 수 있습니다. 이 문서는 사용자가 입력·저장한 값으로 만든 판단 보조 자료입니다. 세금, 대출 한도, 금리는 계약 전에 금융기관·세무 전문가에게 다시 확인하세요.\n`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected.property.name.replace(/[^가-힣a-zA-Z0-9_-]/g, "_")}-임장리포트.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const sectionButtons: Array<{ key: DecisionSection; label: string }> = [{ key: "revisit", label: "재임장" }, { key: "report", label: "리포트" }, { key: "price", label: "가격 추적" }, { key: "finance", label: "매수 계산" }];
  return <main className="decision-page">
    <header className="decision-header"><button className="icon-button" aria-label="비교 화면으로 돌아가기" onClick={onBack}><Icon name="back" /></button><div><p className="eyebrow">최종 선정 · 실행 센터</p><h1>{selected.property.name}</h1></div><button className="text-button" onClick={() => onOpenProperty(propertyId)}>기록 열기</button></header>
    <section className="decision-summary"><div><span>선정 가격</span><strong>{money(selected.property.askingPriceMan)}</strong></div><div><span>현장 확인</span><strong>{selected.checklistDone}/{selected.checklistTotal}</strong></div><div><span>사진</span><strong>{selected.photos.length}장</strong></div></section>
    <nav className="decision-nav" aria-label="선정 후 실행 메뉴">{sectionButtons.map((item) => <button key={item.key} className={section === item.key ? "active" : ""} onClick={() => setSection(item.key)}>{item.label}</button>)}</nav>

    <div className="decision-content">
      {section === "revisit" && <section className="decision-tool"><div className="tool-heading"><div><p className="eyebrow">다음 방문용</p><h2>재임장 검증 플랜</h2><p>현재 체크리스트의 미확인 항목과, 완료했지만 메모가 비어 있는 항목만 다시 모읍니다.</p></div><button className="primary-button" disabled={generate.isPending} onClick={() => generate.mutate()}>{generate.isPending ? "생성 중…" : supportData?.revisitTasks.length ? "다시 생성" : "자동 생성"}</button></div>{generate.data?.message && <p className="notice">{generate.data.message}</p>}<div className="revisit-list">{supportData?.revisitTasks.length ? supportData.revisitTasks.map((task) => <RevisitRow key={task.id} task={task} pending={updateTask.isPending} onSave={(completed, note) => updateTask.mutate({ id: task.id, completed, note })} reasonLabel={reasonLabel(task.reason)} />) : <p className="empty-copy">아직 생성된 플랜이 없습니다. 자동 생성을 눌러 현재 기록의 빈틈을 확인하세요.</p>}</div><form className="inline-add" onSubmit={(event) => { event.preventDefault(); if (!customTask.trim()) return; addTask.mutate(customTask.trim(), { onSuccess: () => setCustomTask("") }); }}><input aria-label="재임장 확인사항 직접 추가" value={customTask} onChange={(event) => setCustomTask(event.target.value)} placeholder="예: 평일 8시 주차 여유 확인" /><button type="submit" disabled={!customTask.trim() || addTask.isPending}>추가</button></form><p className="tool-note">현재 체크리스트에는 점수 필드가 없어 ‘낮은 점수’ 대신 미완료·빈 메모를 기준으로 생성합니다.</p></section>}

      {section === "report" && <section className="decision-tool"><div className="tool-heading"><div><p className="eyebrow">결정의 산출물</p><h2>임장 리포트</h2><p>최종 결론과 후보 비교, 현장 기록, 매물별 호가 이력, 가격 이력, 자금 계산을 마크다운 한 파일로 묶습니다.</p></div><button className="primary-button" onClick={downloadReport}>마크다운 내려받기</button></div><div className="report-preview"><h3>{selected.property.name}</h3><p>{selected.conclusion || "비교 화면에서 최종 결론을 작성해 주세요."}</p><dl><div><dt>비교 후보</dt><dd>{board.data?.items.length ?? 0}곳</dd></div><div><dt>체크리스트</dt><dd>{selected.checklistDone}/{selected.checklistTotal}</dd></div><div><dt>현장 사진</dt><dd>{detail.data?.photos.length ?? selected.photos.length}장</dd></div><div><dt>음성 메모</dt><dd>{detail.data?.voiceMemos.length ?? 0}개</dd></div><div><dt>매물 기록</dt><dd>{listingSummaries.length}건</dd></div><div><dt>가격 기록</dt><dd>{snapshots.length}건</dd></div></dl></div><p className="tool-note">PDF 버튼은 제공하지 않습니다. 내려받은 마크다운은 문서 도구에서 PDF로 변환할 수 있습니다.</p><a className="source-link" href="https://github.com/devsmilekang/notion-house" target="_blank" rel="noreferrer">리포트 구조 참고 · notion-house ↗</a></section>}

      {section === "price" && <section className="decision-tool"><div className="tool-heading"><div><p className="eyebrow">선정 가격 관찰</p><h2>가격 추적</h2><p>호가나 새 신고가를 확인할 때마다 기록하고, 목표가 도달과 직전 기록 대비 변화를 바로 확인합니다.</p></div>{tracker ? <span className="status-dot connected">추적 중</span> : <button className="primary-button" onClick={() => startTracking.mutate(targetPrice ? Number(targetPrice) : null)}>추적 시작</button>}</div><label className="tool-field"><span>목표 가격 (만원, 선택)</span><div><input type="number" min="0" inputMode="numeric" value={targetPrice} onChange={(event) => setTargetPrice(event.target.value)} placeholder="예: 150000" /><button onClick={() => startTracking.mutate(targetPrice ? Number(targetPrice) : null)} disabled={startTracking.isPending}>{tracker ? "조건 저장" : "저장 후 시작"}</button></div></label>{targetReached && <div className="target-alert" role="status"><strong>목표가 도달</strong><span>최근 기록 {money(latest?.amountMan ?? 0)}이 목표 {money(tracker?.targetPriceMan ?? 0)} 이하입니다.</span></div>}<form className="snapshot-form" onSubmit={(event) => { event.preventDefault(); if (!snapshotAmount) return; addSnapshot.mutate({ amountMan: Number(snapshotAmount), kind: snapshotKind, note: snapshotNote }, { onSuccess: () => setSnapshotNote("") }); }}><div className="field-grid"><label><span>새 가격 (만원)</span><input type="number" min="0" required value={snapshotAmount} onChange={(event) => setSnapshotAmount(event.target.value)} /></label><label><span>가격 종류</span><select value={snapshotKind} onChange={(event) => setSnapshotKind(event.target.value as "asking" | "official_trade")}><option value="asking">확인한 호가</option><option value="official_trade">신고 실거래</option></select></label><label className="full"><span>확인 메모</span><input value={snapshotNote} onChange={(event) => setSnapshotNote(event.target.value)} placeholder="출처나 조건을 기록" /></label></div><button className="primary-button" type="submit" disabled={!snapshotAmount || addSnapshot.isPending}>가격 기록 추가</button></form>{latest && <div className="price-status"><span>최근 기록</span><strong>{money(latest.amountMan)}</strong><b>{priceDelta === null ? "기준값" : priceDelta === 0 ? "변동 없음" : `${priceDelta > 0 ? "+" : ""}${money(priceDelta)}`}</b></div>}<div className="snapshot-list">{snapshots.map((snapshot) => <div key={snapshot.id}><span>{new Date(snapshot.recordedAt).toLocaleDateString("ko-KR")}</span><strong>{money(snapshot.amountMan)}</strong><small>{snapshot.kind === "asking" ? "호가" : "신고 실거래"}{snapshot.note ? ` · ${snapshot.note}` : ""}</small>{snapshot.sourceUrl && <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer">출처 ↗</a>}</div>)}</div><p className="tool-note">자동 크롤링·백그라운드 알림은 연결하지 않았습니다. 네이버 매물 크롤링의 지속 가능성이 확인되지 않아, 현재 버전은 직접 확인한 값만 기록합니다.</p><div className="source-links"><a href="https://hogangnono.com" target="_blank" rel="noreferrer">알림 방식 참고 · 호갱노노 ↗</a><a href="https://github.com/klyhyeon/imjang-mate" target="_blank" rel="noreferrer">시세 트래킹 참고 · imjang-mate ↗</a></div></section>}

      {section === "finance" && <section className="decision-tool"><div className="tool-heading"><div><p className="eyebrow">자금 가능성 점검</p><h2>매수 시뮬레이터</h2><p>선정 가격과 직접 입력한 대출·세금 조건으로 필요자금, 월 원리금, 단순 DSR을 계산합니다.</p></div><button className="primary-button" disabled={!financeValid || saveFinance.isPending} onClick={() => saveFinance.mutate({ propertyId, ...financeNumbers })}>계산 저장</button></div><div className="finance-fields">{([['purchasePriceMan','매수가 (만원)'],['ownFundsMan','보유자금 (만원)'],['annualIncomeMan','연소득 (만원)'],['otherAnnualDebtMan','기타 연간 원리금 (만원)'],['loanRatePct','대출금리 (%)'],['loanYears','대출기간 (년)'],['ltvPct','적용 LTV (%)'],['acquisitionTaxPct','취득세율 (%)'],['brokeragePct','중개보수율 (%)']] as const).map(([key, label]) => <label key={key}><span>{label}</span><input type="number" min="0" step={key.includes("Pct") ? "0.01" : "1"} value={finance[key]} onChange={(event) => setFinance((current) => ({ ...current, [key]: event.target.value }))} placeholder="직접 입력" /></label>)}</div>{financeValid ? <div className="finance-results"><div><span>총 필요자금</span><strong>{money(Math.round(financeResult.totalCost))}</strong></div><div><span>예상 대출</span><strong>{money(Math.round(financeResult.loan))}</strong></div><div className={financeResult.fundingGap > 0 ? "warning" : ""}><span>자금 부족분</span><strong>{money(Math.round(financeResult.fundingGap))}</strong></div><div><span>월 원리금</span><strong>{money(Math.round(financeResult.monthlyPayment))}</strong></div><div><span>단순 DSR</span><strong>{financeResult.dsr === null ? "연소득 입력 필요" : `${financeResult.dsr.toFixed(1)}%`}</strong></div></div> : <p className="empty-copy">매수가와 대출기간을 입력하면 계산 결과가 나타납니다.</p>}<p className="tool-note">원리금균등상환 가정의 단순 계산입니다. 취득세율·중개보수율·LTV·금리는 기본값을 넣지 않았으니 본인 조건을 직접 입력하고, 실제 한도와 세금은 금융기관·세무 전문가에게 확인하세요.</p><a className="source-link" href="https://github.com/tae0y/real-estate-mcp" target="_blank" rel="noreferrer">매수 시나리오 참고 · real-estate-mcp ↗</a></section>}
    </div>
  </main>;
}

function RevisitRow({ task, pending, onSave, reasonLabel }: { task: DecisionSupport["revisitTasks"][number]; pending: boolean; onSave: (completed: boolean, note: string) => void; reasonLabel: string }) {
  const [note, setNote] = useState(task.note);
  useEffect(() => setNote(task.note), [task.note]);
  return <div className={`revisit-row ${task.completed ? "done" : ""}`}><button aria-label={`${task.label} ${task.completed ? "미완료로 변경" : "완료"}`} disabled={pending} onClick={() => onSave(!task.completed, note)}><span><Icon name="check" size={15} /></span></button><div><strong>{task.label}</strong><small>{reasonLabel}</small><input aria-label={`${task.label} 재임장 메모`} value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => onSave(task.completed, note)} placeholder="다음 방문에서 확인할 기준" /></div></div>;
}

function ComparisonCard({ item, onOpen, onFinal, finalPending }: { item: ComparisonItem; onOpen: () => void; onFinal: () => void; finalPending: boolean }) {
  const queryClient = useQueryClient();
  const [comparisonNote, setComparisonNote] = useState(item.comparisonNote);
  const [valueAssessment, setValueAssessment] = useState(item.valueAssessment);
  const [conclusion, setConclusion] = useState(item.conclusion);
  useEffect(() => {
    setComparisonNote(item.comparisonNote);
    setValueAssessment(item.valueAssessment);
    setConclusion(item.conclusion);
  }, [item.comparisonNote, item.conclusion, item.valueAssessment]);
  const save = useMutation({
    mutationFn: () => api.saveComparisonEvaluation({ propertyId: item.property.id, comparisonNote, valueAssessment, conclusion }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["comparison-board"] }),
  });
  const property = item.property;
  const heroPhoto = item.photos[0];
  const pricePerPyeong = property.askingPriceMan / pyeong(property.areaSqm);

  return <article className={`comparison-card ${item.finalSelected ? "final" : ""}`}>
    <div className="comparison-card-top">
      <span className="candidate-number">후보 {item.position + 1}</span>
      {item.finalSelected && <span className="final-badge"><Icon name="check" size={14} /> 최종 선정</span>}
    </div>
    {heroPhoto ? <div className="comparison-photo"><img src={heroPhoto.url} alt={heroPhoto.caption || `${property.name} 현장 사진`} />{item.photos.length > 1 && <span>사진 {item.photos.length}장</span>}</div> : <div className="comparison-photo empty"><Icon name="camera" size={24} /><span>현장 사진 없음</span></div>}
    <div className="comparison-title"><div><h2>{property.name}</h2><p>{property.address}</p></div><button className="text-button" onClick={onOpen}>기록 열기</button></div>
    <dl className="comparison-facts">
      <div><dt>{property.priceBasis === "official_trade" ? "신고 실거래가" : "매도 호가"}</dt><dd>{money(property.askingPriceMan)}</dd></div>
      <div><dt>전용면적</dt><dd>{property.areaSqm.toFixed(1)}㎡ · {pyeong(property.areaSqm).toFixed(1)}평</dd></div>
      <div><dt>평당 가격</dt><dd>{money(Math.round(pricePerPyeong))}</dd></div>
      <div><dt>현장 확인</dt><dd>{item.checklistDone}/{item.checklistTotal}</dd></div>
    </dl>
    {property.memo && <div className="property-memo"><span>등록 메모</span><p>{property.memo}</p></div>}
    <div className="evaluation-fields">
      <label><span>비교 메모</span><textarea rows={3} value={comparisonNote} onChange={(event) => setComparisonNote(event.target.value)} placeholder="다른 후보와 비교해 눈에 띄는 점" /></label>
      <label><span>가치평가</span><textarea rows={3} value={valueAssessment} onChange={(event) => setValueAssessment(event.target.value)} placeholder="가격, 입지, 실거주 가치에 대한 판단" /></label>
      <label><span>결론</span><textarea rows={3} value={conclusion} onChange={(event) => setConclusion(event.target.value)} placeholder="매수 검토 여부와 다음 확인사항" /></label>
    </div>
    {save.error && <p className="error-copy">평가를 저장하지 못했습니다.</p>}
    <div className="comparison-card-actions"><button className="secondary-button" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? "저장 중…" : "평가 저장"}</button><button className={item.finalSelected ? "selected-final-button" : "primary-button"} disabled={item.finalSelected || finalPending} onClick={onFinal}>{item.finalSelected ? "최종 후보로 선정됨" : "최종 후보로 선정"}</button></div>
  </article>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><div className="pin-orbit"><Icon name="pin" size={30} /></div><h2>현장 판단은 주소부터</h2><p>아직 등록된 매물이 없습니다. 첫 주소를 찾고 조사 노트를 시작해 보세요.</p><button className="primary-button" onClick={onAdd}><Icon name="plus" /> 첫 매물 등록</button></div>;
}

function PropertyWorkspace({ detail, tab, lens, onTab, onLens, onBack, onEdit }: { detail: Detail; tab: Tab; lens: Lens; onTab: (tab: Tab) => void; onLens: (lens: Lens) => void; onBack: () => void; onEdit: () => void }) {
  const property = detail.property;
  const propertyId = property?.id ?? 0;
  const listingsQuery = useQuery({ queryKey: ["listings", propertyId], queryFn: () => api.listListings({ propertyId }), enabled: propertyId > 0 });
  if (!property) return null;
  const checkedMap = new Map(detail.checklist.map((item) => [item.itemKey, item]));
  const allItems = CHECKLIST_GROUPS.flatMap((group) => group.items);
  const checkedCount = allItems.filter(([key]) => checkedMap.get(key)?.checked).length;
  const pricePerPyeong = property.askingPriceMan / pyeong(property.areaSqm);
  const gap = property.depositMan === null ? null : Math.max(0, property.askingPriceMan - property.depositMan);
  const yieldRate = property.monthlyRentMan && property.askingPriceMan > 0 ? (property.monthlyRentMan * 12 / property.askingPriceMan) * 100 : null;

  return <div className="workspace">
    <div className="mobile-head">
      <button className="icon-button" aria-label="매물 목록으로 돌아가기" onClick={onBack}><Icon name="back" /></button>
      <button className="text-button" onClick={onEdit}><Icon name="edit" size={17} /> 수정</button>
    </div>

    <section className="decision-strip">
      <div className="decision-copy">
        <p className="eyebrow">{property.visitDate ? `${property.visitDate} 임장` : "방문일 미정"}</p>
        <h1>{property.name}</h1>
        <p className="address-line"><Icon name="pin" size={16} />{property.address}</p>
      </div>
      <div className="decision-price">
        <span>{property.priceBasis === "official_trade" ? "신고 실거래가" : "매도 호가"}</span>
        <strong>{money(property.askingPriceMan)}</strong>
        <small>{pyeong(property.areaSqm).toFixed(1)}평 · 평당 {money(Math.round(pricePerPyeong))}</small>
        {property.priceBasis === "official_trade" && property.sourceReference && <a className="official-source-link" href={property.sourceReference} target="_blank" rel="noreferrer">국토교통부 원문 ↗</a>}
      </div>
      <button className="desktop-edit" onClick={onEdit}><Icon name="edit" size={17} /> 정보 수정</button>
    </section>

    <nav className="tabbar" aria-label="매물 상세 메뉴">
      <button className={tab === "dashboard" ? "active" : ""} onClick={() => onTab("dashboard")}>판단판</button>
      <button className={tab === "field" ? "active" : ""} onClick={() => onTab("field")}>현장 기록 <span>{checkedCount}/{allItems.length}</span></button>
      <button className={tab === "listings" ? "active" : ""} onClick={() => onTab("listings")}>매물 {listingsQuery.data ? <span>{listingsQuery.data.listings.length}</span> : null}</button>
      <button className={tab === "sources" ? "active" : ""} onClick={() => onTab("sources")}>자료</button>
    </nav>

    {tab === "dashboard" && (
      <Dashboard property={property} gap={gap} yieldRate={yieldRate} lens={lens} onLens={onLens} checkedCount={checkedCount} totalCount={allItems.length} nearby={detail.nearby} />
    )}
    {tab === "field" && <FieldNotes property={property} detail={detail} listings={listingsQuery.data?.listings ?? []} />}
    {tab === "listings" && <ListingRecordsTab property={property} listings={listingsQuery.data?.listings ?? []} isPending={listingsQuery.isPending} />}
    {tab === "sources" && <SourceDesk property={property} references={detail.references} />}
  </div>;
}

function RentMarketContext({ property }: { property: Property }) {
  const rentContext = useQuery({ queryKey: ["rent-context", property.id], queryFn: () => api.getPropertyRentContext({ propertyId: property.id, lawdCd: null, areaSqm: property.areaSqm, depositPropertyAreaToleranceSqm: 1.5 }) });
  const result = rentContext.data;
  if (rentContext.isPending) {
    return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">임대차 시장</p><h2>전세 · 월세 맥락</h2></div></div><p className="empty-copy">신고 자료를 불러오는 중입니다…</p></section>;
  }
  if (!result) return null;
  if (result.status !== "ok" || !result.summary) {
    return <section className="section-block"><div className="section-heading"><div><p className="eyebrow">임대차 시장</p><h2>전세 · 월세 맥락</h2></div></div><p className="empty-copy">{result.message ?? "신고된 전월세 자료가 없습니다."}</p></section>;
  }
  const summary = result.summary;
  return <section className="section-block">
    <div className="section-heading"><div><p className="eyebrow">임대차 시장</p><h2>전세 · 월세 맥락</h2></div></div>
    <div className="metric-board">
      <Metric label="전세 중앙 (같은 단지·면적)" value={summary.jeonseMedianMan === null ? "자료 없음" : `${money(summary.jeonseMedianMan)}원`} sub={`전세 신고 ${summary.jeonseCount}건 기준`} />
      <Metric label="월세 보증금 중앙 / 월세 평균" value={summary.wolseMedianMan === null ? "자료 없음" : `${money(summary.wolseMedianMan)}원 / ${summary.wolseAvgMonthlyMan === null ? "—" : `${money(summary.wolseAvgMonthlyMan)}원`}`} sub={`월세 신고 ${summary.wolseCount}건 기준`} />
      <Metric label="매매 중앙 (같은 단지·면적)" value={summary.saleMedianMan === null ? "자료 없음" : `${money(summary.saleMedianMan)}원`} sub={`매매 신고 ${summary.saleCount}건 기준`} />
      <Metric label="전세가율" value={summary.jeonseRatioPct === null ? "계산 불가" : `${summary.jeonseRatioPct}%`} sub={summary.gapMan === null ? "중앙값 미확보" : `매매-전세 갭 ${money(summary.gapMan)}원`} />
    </div>
    <p className="source-note">국토교통부 신고 자료 · {summary.monthRange ?? "계약월 미상"}{summary.fetchedAt ? ` · ${formatUpdated(summary.fetchedAt)} 조회` : ""}. 동·호는 제공되지 않습니다. <a href={result.rentSourceUrl} target="_blank" rel="noreferrer">전월세 출처 ↗</a> <a href={result.tradeSourceUrl} target="_blank" rel="noreferrer">매매 출처 ↗</a></p>
    <p className="chart-caption">전세·월세는 보증금과 월세를 섞지 않고 분리 집계했습니다. 전세가율은 같은 단지·면적·기간 범위의 중앙값 기준이므로 개별 거래와 다를 수 있습니다.</p>
  </section>;
}

function Dashboard({ property, gap, yieldRate, lens, onLens, checkedCount, totalCount, nearby }: { property: Property; gap: number | null; yieldRate: number | null; lens: Lens; onLens: (lens: Lens) => void; checkedCount: number; totalCount: number; nearby: Detail["nearby"] }) {
  const categoryLabel: Record<Detail["nearby"][number]["category"], string> = { transit: "지하철", school: "학교", market: "마트", hospital: "병원" };
  return <div className="content-grid">
    <div className="primary-column">
      <div className="lens-switch" aria-label="분석 관점">
        <button className={lens === "invest" ? "active" : ""} onClick={() => onLens("invest")}>투자 관점</button>
        <button className={lens === "reside" ? "active" : ""} onClick={() => onLens("reside")}>실거주 관점</button>
      </div>

      {lens === "invest" ? (
        <section className="metric-board">
          <Metric label="전용면적" value={`${property.areaSqm.toFixed(1)}㎡`} sub={`${pyeong(property.areaSqm).toFixed(1)}평`} />
          <Metric label={property.priceBasis === "official_trade" ? "평당 실거래가" : "평당 호가"} value={money(Math.round(property.askingPriceMan / pyeong(property.areaSqm)))} sub={property.priceBasis === "official_trade" ? "국토교통부 신고 거래 기준" : "사용자 입력값 기준"} />
          <Metric label="전세 차감 필요금" value={gap === null ? "미입력" : money(gap)} sub={property.depositMan === null ? "전세가를 입력해 계산" : `전세 ${money(property.depositMan)}`} />
          <Metric label="표면 임대수익률" value={yieldRate === null ? "미입력" : `${yieldRate.toFixed(2)}%`} sub="월세×12 ÷ 호가, 비용 제외" />
        </section>
      ) : (
        <section className="reside-board">
          <div className="progress-ring" style={{ "--progress": `${Math.round((checkedCount / totalCount) * 100)}%` } as CSSProperties}><strong>{checkedCount}</strong><span>/{totalCount}</span></div>
          <div><p className="eyebrow">현장 확인 진행률</p><h2>{checkedCount === totalCount ? "현장 확인 완료" : `${totalCount - checkedCount}개 항목이 남았습니다`}</h2><p>채광, 소음, 주차처럼 데이터로 대신할 수 없는 것부터 직접 확인하세요.</p></div>
        </section>
      )}

      {lens === "invest" && <RentMarketContext property={property} />}

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">입지 스냅샷</p><h2>주소 근거 자료</h2></div><span className="coordinate-chip">{property.latitude.toFixed(5)}, {property.longitude.toFixed(5)}</span></div>
        {nearby.length > 0 ? <div className="nearby-list">{nearby.slice(0, 8).map((item) => <div className="nearby-row" key={item.id}><span className={`nearby-kind ${item.category}`}>{categoryLabel[item.category]}</span><span><strong>{item.name}</strong><small>{item.address}</small></span><b>{item.distanceM < 1000 ? `${item.distanceM}m` : `${(item.distanceM / 1000).toFixed(1)}km`}</b></div>)}</div> : <p className="empty-copy">아직 주변 시설 좌표를 찾지 않았습니다. ‘자료’ 탭에서 새로 찾기를 실행하세요.</p>}
        {nearby[0] && <p className="source-note">직선거리 · OpenStreetMap · {formatUpdated(nearby[0].fetchedAt)} 조회</p>}
      </section>
    </div>
    <NavigationPanel property={property} />
  </div>;
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

function NavigationPanel({ property }: { property: Property }) {
  const encodedName = encodeURIComponent(property.name);
  const naverQuery = encodeURIComponent(`${property.name} ${property.address}`.trim());
  const lat = property.latitude;
  const lng = property.longitude;
  const kakao = `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;
  const naver = `https://map.naver.com/p/search/${naverQuery}`;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  return <aside className="route-panel"><div className="route-icon"><Icon name="route" size={28} /></div><p className="eyebrow">바로 출발</p><h2>목적지 전송</h2><p>출발지는 지도 앱에서 현재 위치로 설정합니다.</p><div className="route-buttons"><a className="primary-button" href={kakao} target="_blank" rel="noreferrer">카카오맵으로 길찾기</a><a className="secondary-button" href={naver} target="_blank" rel="noreferrer">네이버지도에서 찾기</a><a className="ghost-link" href={google} target="_blank" rel="noreferrer">Google 지도에서 열기</a></div></aside>;
}

const VOICE_MAX_RECORD_SECONDS = 10 * 60;
const VOICE_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"] as const;
type VoiceMimeType = (typeof VOICE_MIME_TYPES)[number];

const VOICE_RECORDER_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg", "audio/wav"];

function normalizeVoiceMimeType(raw: string): VoiceMimeType | null {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return (VOICE_MIME_TYPES as ReadonlyArray<string>).includes(base) ? (base as VoiceMimeType) : null;
}

function formatElapsed(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

type PendingVoice = { blob: Blob; blobUrl: string; mimeType: VoiceMimeType; durationSec: number };

function VoiceRecorder({ propertyId, listingId = null, showChecklistLink = false, onSaved }: {
  propertyId: number;
  listingId?: number | null;
  showChecklistLink?: boolean;
  onSaved: () => void;
}) {
  const [stage, setStage] = useState<"idle" | "recording" | "review">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState("");
  const [checklistItemKey, setChecklistItemKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingVoice | null>(null);
  const [saving, setSaving] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const cancelledRef = useRef(false);

  const stopTimer = () => {
    if (timerRef.current !== null) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (autoStopRef.current !== null) { window.clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  };

  const cleanupStream = () => {
    stopTimer();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  useEffect(() => () => { cleanupStream(); }, []);

  const revokePending = () => {
    if (pending) {
      URL.revokeObjectURL(pending.blobUrl);
      setPending(null);
    }
  };

  const cancelRecording = () => {
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch { /* ignore: stream cleanup runs below */ }
    }
    cleanupStream();
    setElapsed(0);
    setError(null);
    setStage("idle");
  };

  const startRecording = async () => {
    setError(null);
    cancelledRef.current = false;
    try {
      const mediaDevices = navigator.mediaDevices;
      if (!mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        setError("이 브라우저에서는 음성 녹음이 지원되지 않습니다. 크롬·엣지·사파리 최신 버전에서 사용해 주세요.");
        return;
      }
      const stream = await mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      let mimeType = "";
      for (const candidate of VOICE_RECORDER_CANDIDATES) {
        if (MediaRecorder.isTypeSupported(candidate)) { mimeType = candidate; break; }
      }
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("녹음 중 오류가 발생했습니다. 다시 시도해 주세요.");
        cancelRecording();
      };
      recorder.onstop = () => {
        if (cancelledRef.current) { cancelledRef.current = false; return; }
        const normalized = normalizeVoiceMimeType(recorder.mimeType || "audio/webm");
        const finalType: VoiceMimeType = normalized ?? "audio/webm";
        const durationSec = (Date.now() - startRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: finalType });
        cleanupStream();
        if (blob.size === 0) {
          setError("녹음된 소리가 없습니다. 다시 녹음해 주세요.");
          setStage("idle");
          return;
        }
        setPending({ blob, blobUrl: URL.createObjectURL(blob), mimeType: finalType, durationSec });
        setElapsed(Math.floor(durationSec));
        setStage("review");
      };
      startRef.current = Date.now();
      setElapsed(0);
      recorder.start(1000);
      recorderRef.current = recorder;
      setStage("recording");
      timerRef.current = window.setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 500);
      autoStopRef.current = window.setTimeout(() => {
        const current = recorderRef.current;
        if (current && current.state === "recording") {
          current.stop();
          setError("최대 10분까지 녹음됩니다. 녹음이 자동으로 종료되었습니다.");
        }
      }, VOICE_MAX_RECORD_SECONDS * 1000);
    } catch (err) {
      cleanupStream();
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
        setError("마이크 권한이 거부되었습니다. 브라우저 설정에서 이 앱의 마이크 사용을 허용해 주세요.");
      } else {
        setError("녹음을 시작하지 못했습니다. 마이크가 연결되어 있는지 확인해 주세요.");
      }
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  const discard = () => {
    revokePending();
    setTitle("");
    setChecklistItemKey("");
    setError(null);
    setElapsed(0);
    setStage("idle");
  };

  const saveRecording = async () => {
    if (!pending || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (pending.blob.size > 9_000_000) throw new Error("녹음 파일이 너무 큽니다. 10분 이내의 짧은 메모를 권장합니다.");
      const file = new File([pending.blob], `voice-memo.${pending.mimeType.split("/")[1] ?? "webm"}`, { type: pending.mimeType });
      const encoded = await fileToBase64(file);
      const normalized = normalizeVoiceMimeType(encoded.mimeType);
      if (!normalized) throw new Error(`이 브라우저의 녹음 형식(${encoded.mimeType})은 아직 저장 형식을 지원하지 않습니다.`);
      const stamp = new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
      await api.addVoiceMemo({
        propertyId,
        dataBase64: encoded.dataBase64,
        mimeType: normalized,
        durationSec: pending.durationSec,
        title: title.trim() || `${stamp} 녹음`,
        listingId: listingId ?? null,
        checklistItemKey: showChecklistLink && checklistItemKey ? checklistItemKey : null,
      });
      discard();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const supported = typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  if (stage === "recording") {
    return <div className="voice-recording" role="status" aria-live="polite">
      <span className="rec-dot" aria-hidden="true" />
      <strong className="rec-timer">{formatElapsed(elapsed)}</strong>
      <span className="voice-hint-inline">녹음 중… 마이크를 입에 가까이 대세요</span>
      <div className="voice-actions">
        <button type="button" className="primary-button record-stop" onClick={stopRecording}>녹음 끝내기</button>
        <button type="button" className="secondary-button" onClick={cancelRecording}>취소</button>
      </div>
    </div>;
  }

  if (stage === "review" && pending) {
    return <div className="voice-review">
      <audio controls src={pending.blobUrl} className="voice-audio" aria-label="녹음한 음성 미리듣기" />
      <div className="field-grid review-fields">
        <label className={showChecklistLink ? "" : "full"}>
          <span>메모 제목 (선택)</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: 중개사 소음 설명" maxLength={100} />
        </label>
        {showChecklistLink && <label>
          <span>체크리스트 연결 (선택)</span>
          <select value={checklistItemKey} aria-label="체크리스트 항목 연결" onChange={(event) => setChecklistItemKey(event.target.value)}>
            <option value="">연결 없음</option>
            {CHECKLIST_GROUPS.map((group) => <optgroup key={group.title} label={group.title}>{group.items.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</optgroup>)}
          </select>
        </label>}
      </div>
      <div className="voice-actions">
        <button type="button" className="primary-button" onClick={() => void saveRecording()} disabled={saving}>{saving ? "저장 중…" : "음성 메모 저장"}</button>
        <button type="button" className="secondary-button" onClick={discard} disabled={saving}>버리기</button>
      </div>
      {error && <p className="error-copy">{error}</p>}
    </div>;
  }

  return <div className="voice-idle">
    <button type="button" className="primary-button" onClick={() => void startRecording()}><Icon name="mic" size={18} /> 녹음 시작</button>
    {!supported && <p className="error-copy">이 브라우저에서는 음성 녹음이 지원되지 않습니다.</p>}
    <p className="voice-hint">중개사 설명이나 현장 분위기처럼 순간 정보를 바로 남겨 보세요. 최대 10분까지 녹음됩니다.</p>
    {error && <p className="error-copy">{error}</p>}
  </div>;
}

function VoiceMemoRow({ memo, displayIndex, linkedLabel, onChanged }: {
  memo: VoiceMemo;
  displayIndex: number;
  linkedLabel: string | null;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(memo.title);
  const rename = useMutation({
    mutationFn: () => api.updateVoiceMemo({ id: memo.id, title }),
    onSuccess: () => { setEditing(false); onChanged(); },
  });
  const remove = useMutation({
    mutationFn: () => api.deleteVoiceMemo({ id: memo.id }),
    onSuccess: onChanged,
  });
  const duration = formatDuration(memo.durationSec);

  return <div className="voice-row">
    <div className="voice-info">
      <span className="voice-index" aria-hidden="true"><Icon name="mic" size={15} /> {displayIndex}</span>
      {editing ? (
        <form className="voice-rename" onSubmit={(event) => { event.preventDefault(); rename.mutate(); }}>
          <input aria-label="음성 메모 제목" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} />
          <button type="submit" className="text-button" disabled={rename.isPending}>저장</button>
          <button type="button" className="text-button" onClick={() => { setTitle(memo.title); setEditing(false); }} disabled={rename.isPending}>취소</button>
        </form>
      ) : (
        <div className="voice-caption">
          <strong>{memo.title || `음성 메모 ${displayIndex}`}</strong>
          <span className="voice-meta">{formatUpdated(memo.createdAt)}{duration ? ` · ${duration}` : ""}{linkedLabel ? ` · ${linkedLabel}` : ""}</span>
        </div>
      )}
    </div>
    <audio controls preload="metadata" src={memo.url} className="voice-audio" aria-label={`${memo.title || "음성 메모"} 재생`} />
    <div className="voice-row-actions">
      {!editing && <button type="button" className="text-button" onClick={() => setEditing(true)} disabled={rename.isPending || remove.isPending}>이름 변경</button>}
      <button type="button" className="text-button danger" onClick={() => remove.mutate()} disabled={remove.isPending}>{remove.isPending ? "삭제 중…" : "삭제"}</button>
    </div>
    {rename.isError && <p className="error-copy">제목을 저장하지 못했습니다.</p>}
  </div>;
}

function voiceLinkedLabel(memo: VoiceMemo, listingLabel: (listingId: number) => string | null): string | null {
  if (memo.checklistItemKey) {
    const label = CHECKLIST_LABELS.get(memo.checklistItemKey);
    return label ? `체크리스트 · ${label}` : "체크리스트";
  }
  if (memo.listingId) return listingLabel(memo.listingId);
  return null;
}

function FieldNotes({ property, detail, listings }: { property: Property; detail: Detail; listings: ListingSummary[] }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(detail.checklist.map((item) => [item.itemKey, item.note])));
  const checklistMap = new Map(detail.checklist.map((item) => [item.itemKey, item]));
  const save = useMutation({
    mutationFn: (payload: { itemKey: string; checked: boolean; note: string }) => api.saveChecklistEntry({ propertyId: property.id, ...payload }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["property", property.id] }),
  });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!["image/jpeg", "image/png"].includes(file.type)) throw new Error("JPG 또는 PNG 사진만 추가할 수 있습니다.");
      if (file.size > 8_000_000) throw new Error("사진은 8MB 이하만 추가할 수 있습니다.");
      const encoded = await fileToBase64(file);
      return api.addPhoto({ propertyId: property.id, dataBase64: encoded.dataBase64, mimeType: encoded.mimeType as "image/jpeg" | "image/png", caption: "" });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["property", property.id] }),
  });
  const removePhoto = useMutation({
    mutationFn: (id: number) => api.deletePhoto({ id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["property", property.id] }),
  });

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) upload.mutate(file);
    event.target.value = "";
  };

  const voiceMemos = detail.voiceMemos;
  const voiceCounts = new Map<string, number>();
  for (const memo of voiceMemos) {
    if (memo.checklistItemKey) voiceCounts.set(memo.checklistItemKey, (voiceCounts.get(memo.checklistItemKey) ?? 0) + 1);
  }
  const listingMap = new Map(listings.map((listing) => [listing.id, listing]));
  const listingVoiceLabel = (listingId: number) => {
    const listing = listingMap.get(listingId);
    if (!listing) return "매물 기록";
    const dongHo = listingDongHo(listing.dong, listing.ho);
    return dongHo ? `매물 · ${dongHo}` : "매물 기록";
  };
  const invalidateDetail = () => void queryClient.invalidateQueries({ queryKey: ["property", property.id] });

  return <div className="field-layout">
    <section className="checklist-sheet">
      <div className="section-heading"><div><p className="eyebrow">현장에서만 보이는 것</p><h2>임장 체크리스트</h2></div>{save.isPending && <span className="saving">저장 중…</span>}</div>
      {CHECKLIST_GROUPS.map((group) => <div className="check-group" key={group.title}><h3>{group.title}</h3>{group.items.map(([key, label]) => {
        const entry = checklistMap.get(key);
        const checked = entry?.checked ?? false;
        const voiceCount = voiceCounts.get(key) ?? 0;
        return <div className="check-row" key={key}><button className={`check-toggle ${checked ? "done" : ""}`} aria-label={`${label} ${checked ? "완료 취소" : "완료 표시"}${voiceCount > 0 ? ` · 연결된 음성 메모 ${voiceCount}개` : ""}`} onClick={() => save.mutate({ itemKey: key, checked: !checked, note: notes[key] ?? entry?.note ?? "" })}><span><Icon name="check" size={16} /></span>{label}{voiceCount > 0 && <span className="voice-badge" title={`연결된 음성 메모 ${voiceCount}개`}><Icon name="mic" size={12} />{voiceCount}</span>}</button><input aria-label={`${label} 메모`} value={notes[key] ?? entry?.note ?? ""} placeholder="짧은 메모" onChange={(event) => setNotes((prev) => ({ ...prev, [key]: event.target.value }))} onBlur={(event) => save.mutate({ itemKey: key, checked, note: event.target.value })} /></div>;
      })}</div>)}
    </section>

    <aside className="photo-sheet">
      <div className="section-heading"><div><p className="eyebrow">현장 증거</p><h2>사진 기록</h2></div><label className="icon-button accent" aria-label="현장 사진 추가"><Icon name="camera" /><input type="file" accept="image/jpeg,image/png" capture="environment" onChange={onFiles} /></label></div>
      {upload.error && <p className="error-copy">{upload.error.message}</p>}
      {upload.isPending && <div className="uploading">사진을 저장하는 중…</div>}
      {detail.photos.length === 0 ? <div className="photo-empty"><Icon name="camera" size={28} /><p>사진을 추가하면 이곳에 시간순으로 쌓입니다.</p></div> : <div className="photo-grid">{detail.photos.map((photo) => <figure key={photo.id}><img src={photo.url} alt={photo.caption || `${property.name} 현장 사진`} /><button aria-label="사진 삭제" onClick={() => removePhoto.mutate(photo.id)}><Icon name="trash" size={16} /></button><figcaption>{formatUpdated(photo.createdAt)}</figcaption></figure>)}</div>}
    </aside>

    <section className="voice-sheet" aria-label="음성 메모">
      <div className="section-heading"><div><p className="eyebrow">현장의 소리</p><h2>음성 메모</h2></div></div>
      <VoiceRecorder propertyId={property.id} showChecklistLink onSaved={invalidateDetail} />
      {voiceMemos.length === 0
        ? <div className="voice-empty"><Icon name="mic" size={28} /><p>아직 녹음된 메모가 없습니다. 현장에서 떠오르는 정보를 말로 바로 남겨 보세요.</p></div>
        : <div className="voice-list">{voiceMemos.map((memo, index) => <VoiceMemoRow key={memo.id} memo={memo} displayIndex={voiceMemos.length - index} linkedLabel={voiceLinkedLabel(memo, listingVoiceLabel)} onChanged={invalidateDetail} />)}</div>}
    </section>
  </div>;
}

function SourceDesk({ property, references }: { property: Property; references: Detail["references"] }) {
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => api.refreshReferences({ propertyId: property.id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["property", property.id] }),
  });
  const newest = references[0]?.fetchedAt;
  return <div className="sources-page">
    <section className="source-intro"><div><p className="eyebrow">외부 참고자료</p><h2>가격·입지 근거 찾기</h2><p>주소 기준 검색 결과를 그대로 보여드립니다. 가격 숫자는 계약 조건과 시점을 원문에서 다시 확인하세요.</p></div><button className="primary-button" onClick={() => refresh.mutate()} disabled={refresh.isPending}><Icon name="refresh" />{refresh.isPending ? "찾는 중…" : "자료 새로 찾기"}</button></section>
    {refresh.data?.message && <p className="notice">{refresh.data.message}</p>}
    {newest && <p className="fetched-time">최근 검색 {formatUpdated(newest)}</p>}
    {references.length === 0 && !refresh.isPending ? <div className="reference-empty"><Icon name="search" size={30} /><h3>아직 불러온 자료가 없습니다</h3><p>검색을 실행하면 실거래·시세와 주변 시설 관련 출처를 나눠 보여드립니다.</p></div> : <div className="reference-columns"><ReferenceColumn title="가격 자료" items={references.filter((item) => item.kind === "price")} /><ReferenceColumn title="입지 자료" items={references.filter((item) => item.kind === "location")} /></div>}
  </div>;
}

function ReferenceColumn({ title, items }: { title: string; items: Detail["references"] }) {
  return <section className="reference-column"><h3>{title}</h3>{items.length === 0 ? <p className="empty-copy">확인 가능한 자료가 없습니다.</p> : items.map((item) => <a className="reference-card" href={item.url} target="_blank" rel="noreferrer" key={item.id}><span className="source-domain">{item.source ?? "출처 보기"}{item.publishedAt ? ` · ${item.publishedAt}` : ""}</span><strong>{item.title}</strong>{item.snippet && <p>{item.snippet.replace(/Last Updated:[^\n]*\n?/gi, "").replace(/Last Crawl:[^\n]*\n?/gi, "").slice(0, 220)}</p>}<span className="open-source">원문 열기 ↗</span></a>)}</section>;
}

function ListingRecordsTab({ property, listings, isPending }: { property: Property; listings: ListingSummary[]; isPending: boolean }) {
  const [editing, setEditing] = useState<ListingSummary | "new" | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const ordered = [...listings].sort((a, b) => (a.status === "active" ? 0 : 1) - (b.status === "active" ? 0 : 1) || b.updatedAt.localeCompare(a.updatedAt));
  return (
    <div className="listing-page">
      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">실제로 본 매물 단위</p>
            <h2>매물 단위 기록</h2>
            <p className="section-copy">같은 단지도 실제 매물은 다릅니다. 중개업소·동호수·금액·연락처를 매물 단위로 기록하고, 호가 변화를 이력으로 남겨 협상의 근거로 삼으세요.</p>
          </div>
          <button className="primary-button" onClick={() => setEditing("new")}><Icon name="plus" /> 매물 추가</button>
        </div>
        {isPending ? (
          <p className="empty-copy">매물 기록을 불러오는 중…</p>
        ) : ordered.length === 0 ? (
          <div className="listing-empty">
            <h3>아직 기록된 매물이 없습니다</h3>
            <p>첫 매물을 등록하면 호가 이력이 쌓이고, 목표가 도달도 자동으로 표시됩니다.</p>
            <button className="secondary-button" onClick={() => setEditing("new")}><Icon name="plus" size={16} /> 첫 매물 기록하기</button>
          </div>
        ) : (
          <div className="listing-grid">{ordered.map((listing) => <ListingCard key={listing.id} listing={listing} onOpen={() => setDetailId(listing.id)} onEdit={() => setEditing(listing)} />)}</div>
        )}
        <p className="listing-source">매물 단위 기록 컨셉 참고 · <a href="https://github.com/ljhdy/dotherich" target="_blank" rel="noreferrer">doTheRich ↗</a></p>
      </section>
      {editing !== null && (
        <ListingFormModal
          propertyId={property.id}
          defaultAreaSqm={property.areaSqm}
          existing={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
      {detailId !== null && (
        <ListingDetailModal
          key={detailId}
          property={property}
          listingId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(base) => { setDetailId(null); setEditing(listings.find((item) => item.id === base.id) ?? null); }}
        />
      )}
    </div>
  );
}

function ListingCard({ listing, onOpen, onEdit }: { listing: ListingSummary; onOpen: () => void; onEdit: () => void }) {
  const dongHo = listingDongHo(listing.dong, listing.ho);
  const title = dongHo || listing.brokerName || "매물 기록";
  const delta = listing.priceChangeMan;
  const targetReached = listing.targetPriceMan !== null && listing.priceMan <= listing.targetPriceMan;
  const targetGap = listing.targetPriceMan === null ? null : listing.priceMan - listing.targetPriceMan;
  return (
    <article className="listing-card">
      <div className="listing-card-top">
        <span className={`status-pill status-${listing.status}`}>{LISTING_STATUS_LABEL[listing.status]}</span>
        <span className="trade-pill">{TRADE_TYPE_LABEL[listing.tradeType]}</span>
        {targetReached && <span className="target-pill"><Icon name="bell" size={13} /> 목표가 도달</span>}
        <span className="listing-spacer" />
        <button className="mini-icon-button" aria-label={`${title} 정보 수정`} onClick={onEdit}><Icon name="edit" size={16} /></button>
      </div>
      <h3><button className="listing-title-button" onClick={onOpen}>{title}</button></h3>
      <p className="listing-price-line">
        <strong>{listingPriceText(listing.tradeType, listing.priceMan, listing.monthlyRentMan)}</strong>
        {delta !== null && delta !== 0 && (
          <span className={`listing-delta ${delta < 0 ? "down" : "up"}`}>
            <Icon name={delta < 0 ? "down" : "up"} size={13} /> 최초 대비 {money(Math.abs(delta))}{delta < 0 ? " 하락" : " 상승"}
          </span>
        )}
      </p>
      <dl className="listing-meta">
        {listing.brokerName && <div><dt>중개업소</dt><dd>{listing.brokerName}</dd></div>}
        {listing.brokerContact && <div><dt>연락처</dt><dd><a href={`tel:${listing.brokerContact.replace(/[^0-9+]/g, "")}`}>{listing.brokerContact}</a></dd></div>}
        {listing.areaSqm !== null && <div><dt>면적</dt><dd>{listing.areaSqm}㎡ ({pyeong(listing.areaSqm).toFixed(1)}평)</dd></div>}
        {listing.targetPriceMan !== null && (
          <div><dt>목표가</dt><dd>{money(listing.targetPriceMan)}{targetGap !== null && targetGap > 0 && <span className="dim-suffix"> · {money(targetGap)} 남음</span>}</dd></div>
        )}
        <div><dt>호가 이력</dt><dd>{listing.logCount}건</dd></div>
      </dl>
      {listing.memo && <p className="listing-memo">{listing.memo}</p>}
      <div className="listing-actions">
        <button className="secondary-button" onClick={onOpen}>호가 이력 · 협상 요약</button>
        {listing.listingUrl && <a className="text-button" href={listing.listingUrl} target="_blank" rel="noreferrer">원문 매물 ↗</a>}
      </div>
    </article>
  );
}

function ListingFormModal({ propertyId, defaultAreaSqm, existing, onClose, onSaved }: {
  propertyId: number;
  defaultAreaSqm: number;
  existing: NonNullable<ListingDetailData["listing"]> | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [brokerName, setBrokerName] = useState(existing?.brokerName ?? "");
  const [brokerContact, setBrokerContact] = useState(existing?.brokerContact ?? "");
  const [dong, setDong] = useState(existing?.dong ?? "");
  const [ho, setHo] = useState(existing?.ho ?? "");
  const [areaSqm, setAreaSqm] = useState(existing?.areaSqm !== null && existing?.areaSqm !== undefined ? String(existing.areaSqm) : String(defaultAreaSqm));
  const [tradeType, setTradeType] = useState<TradeType>(existing?.tradeType ?? "sale");
  const [priceMan, setPriceMan] = useState(existing ? String(existing.priceMan) : "");
  const [monthlyRentMan, setMonthlyRentMan] = useState(existing?.monthlyRentMan !== null && existing?.monthlyRentMan !== undefined ? String(existing.monthlyRentMan) : "");
  const [targetPriceMan, setTargetPriceMan] = useState(existing?.targetPriceMan !== null && existing?.targetPriceMan !== undefined ? String(existing.targetPriceMan) : "");
  const [listingUrl, setListingUrl] = useState(existing?.listingUrl ?? "");
  const [status, setStatus] = useState<ListingStatus>(existing?.status ?? "active");
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api.saveListing({
      propertyId,
      id: existing?.id ?? null,
      brokerName: brokerName.trim(),
      brokerContact: brokerContact.trim(),
      dong: dong.trim(),
      ho: ho.trim(),
      areaSqm: areaSqm.trim() ? Number(areaSqm) : null,
      tradeType,
      priceMan: Number(priceMan),
      monthlyRentMan: tradeType === "wolse" && monthlyRentMan.trim() ? Number(monthlyRentMan) : null,
      targetPriceMan: targetPriceMan.trim() ? Number(targetPriceMan) : null,
      listingUrl: listingUrl.trim() ? listingUrl.trim() : null,
      status,
      memo,
    }),
    onSuccess: (result) => {
      if (result.ok && result.id !== null) {
        void queryClient.invalidateQueries({ queryKey: ["listings", propertyId] });
        if (existing) void queryClient.invalidateQueries({ queryKey: ["listing", existing.id] });
        onSaved(result.id);
      } else {
        setFormError(result.message ?? "저장하지 못했습니다.");
      }
    },
    onError: () => setFormError("저장하지 못했습니다. 입력값을 확인해 주세요."),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!invalid) save.mutate();
  };

  const invalid =
    !(dong.trim() || ho.trim() || brokerName.trim()) ||
    !(Number.isInteger(Number(priceMan)) && Number(priceMan) > 0) ||
    !(Number(areaSqm) > 0) ||
    (tradeType === "wolse" && !(Number.isInteger(Number(monthlyRentMan)) && Number(monthlyRentMan) > 0)) ||
    (targetPriceMan.trim() !== "" && !(Number.isInteger(Number(targetPriceMan)) && Number(targetPriceMan) > 0)) ||
    (listingUrl.trim() !== "" && !/^https?:\/\/.+/.test(listingUrl.trim()));

  const priceLabel = tradeType === "sale" ? "매매가(만원)" : tradeType === "jeonse" ? "전세가(만원)" : "보증금(만원)";

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="form-sheet" onSubmit={submit}>
        <div className="form-head">
          <div>
            <p className="eyebrow">매물 단위 기록</p>
            <h2>{existing ? "매물 정보 수정" : "새 매물 기록"}</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose}>닫기</button>
        </div>
        <div className="field-grid">
          <fieldset className="full">
            <legend>거래 유형</legend>
            <div className="purpose-buttons three">
              {(["sale", "jeonse", "wolse"] as TradeType[]).map((value) => (
                <button key={value} type="button" className={tradeType === value ? "active" : ""} onClick={() => setTradeType(value)}>{TRADE_TYPE_LABEL[value]}</button>
              ))}
            </div>
          </fieldset>
          <label>
            <span>동</span>
            <input value={dong} onChange={(event) => setDong(event.target.value)} placeholder="예) 101" maxLength={40} />
          </label>
          <label>
            <span>호수</span>
            <input value={ho} onChange={(event) => setHo(event.target.value)} placeholder="예) 1502" maxLength={40} />
          </label>
          <label>
            <span>중개업소</span>
            <input value={brokerName} onChange={(event) => setBrokerName(event.target.value)} placeholder="예) 행복공인중개사" maxLength={80} />
          </label>
          <label>
            <span>연락처</span>
            <input value={brokerContact} onChange={(event) => setBrokerContact(event.target.value)} placeholder="예) 010-0000-0000" maxLength={80} inputMode="tel" />
          </label>
          <label>
            <span>면적 (㎡)</span>
            <input value={areaSqm} onChange={(event) => setAreaSqm(event.target.value)} inputMode="decimal" placeholder={String(defaultAreaSqm)} />
          </label>
          <label>
            <span>{priceLabel}</span>
            <input value={priceMan} onChange={(event) => setPriceMan(event.target.value)} inputMode="numeric" placeholder="숫자만 입력" />
          </label>
          {tradeType === "wolse" && (
            <label>
              <span>월세(만원)</span>
              <input value={monthlyRentMan} onChange={(event) => setMonthlyRentMan(event.target.value)} inputMode="numeric" placeholder="숫자만 입력" />
            </label>
          )}
          <label>
            <span>목표가(만원 · 협상 기준)</span>
            <input value={targetPriceMan} onChange={(event) => setTargetPriceMan(event.target.value)} inputMode="numeric" placeholder="없으면 비워 두세요" />
          </label>
          <label className="full">
            <span>원문 매물 URL (선택)</span>
            <input value={listingUrl} onChange={(event) => setListingUrl(event.target.value)} placeholder="https://…" inputMode="url" maxLength={500} />
          </label>
          <fieldset className="full">
            <legend>상태</legend>
            <div className="purpose-buttons four">
              {LISTING_STATUS_ORDER.map((value) => (
                <button key={value} type="button" className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{LISTING_STATUS_LABEL[value]}</button>
              ))}
            </div>
          </fieldset>
          <label className="full">
            <span>메모</span>
            <textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={3} maxLength={500} placeholder="향, 층, 집주인 사정 등 협상에 쓸 한마디" />
          </label>
        </div>
        {formError && <p className="error-copy">{formError}</p>}
        {invalid && <p className="form-hint">동·호수·중개업소 중 하나는 꼭 적어 주세요. 금액은 만원 단위 정수입니다.</p>}
        <div className="form-actions">
          <span />
          <span />
          <button type="button" className="secondary-button" onClick={onClose}>취소</button>
          <button type="submit" className="primary-button" disabled={invalid || save.isPending}>{save.isPending ? "저장 중…" : existing ? "변경 저장" : "매물 저장"}</button>
        </div>
      </form>
    </div>
  );
}

function ListingDetailModal({ property, listingId, onClose, onEdit }: {
  property: Property;
  listingId: number;
  onClose: () => void;
  onEdit: (listing: NonNullable<ListingDetailData["listing"]>) => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["listing", listingId], queryFn: () => api.getListing({ id: listingId }) });
  const propertyDetail = useQuery({ queryKey: ["property", property.id], queryFn: () => api.getPropertyDetail({ id: property.id }) });
  const listingVoiceMemos = (propertyDetail.data?.voiceMemos ?? []).filter((memo) => memo.listingId === listingId);
  const invalidateVoice = () => void queryClient.invalidateQueries({ queryKey: ["property", property.id] });
  const localToday = () => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  };
  const [logPrice, setLogPrice] = useState("");
  const [logRent, setLogRent] = useState("");
  const [logDate, setLogDate] = useState(localToday);
  const [logSource, setLogSource] = useState("");
  const [logNote, setLogNote] = useState("");
  const [logError, setLogError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
    void queryClient.invalidateQueries({ queryKey: ["listings", property.id] });
  };

  const addLog = useMutation({
    mutationFn: (payload: { priceMan: number; monthlyRentMan: number | null; note: string; sourceNote: string; recordedAt: string | null }) =>
      api.addListingPriceLog({ listingId, ...payload }),
    onSuccess: (result) => {
      if (result.ok) {
        setLogPrice("");
        setLogRent("");
        setLogNote("");
        setLogSource("");
        setLogError(null);
        invalidate();
      } else {
        setLogError(result.message ?? "기록하지 못했습니다.");
      }
    },
    onError: () => setLogError("기록하지 못했습니다. 입력값을 확인해 주세요."),
  });

  const removeLog = useMutation({
    mutationFn: (id: number) => api.deleteListingPriceLog({ id }),
    onSuccess: (result) => {
      if (result.ok) {
        setLogError(null);
        invalidate();
      } else {
        setLogError(result.message ?? "삭제하지 못했습니다.");
      }
    },
    onError: () => setLogError("삭제하지 못했습니다."),
  });

  const removeListing = useMutation({
    mutationFn: () => api.deleteListing({ id: listingId }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: ["listings", property.id] });
        onClose();
      } else {
        setLogError(result.message ?? "삭제하지 못했습니다.");
      }
    },
    onError: () => setLogError("삭제하지 못했습니다."),
  });

  const listing = detail.data?.listing ?? null;
  const logs = detail.data?.logs ?? [];
  const first = logs.at(-1) ?? null;
  const change = listing && first ? listing.priceMan - first.priceMan : null;
  const changePct = change === null || first === null || first.priceMan === 0 ? null : (change / first.priceMan) * 100;
  const targetGap = listing === null || listing.targetPriceMan === null ? null : listing.priceMan - listing.targetPriceMan;
  const basisGap = listing && listing.tradeType === "sale" ? listing.priceMan - property.askingPriceMan : null;
  const formatLogDate = (value: string) => new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));

  const logInvalid = !(Number.isInteger(Number(logPrice)) && Number(logPrice) > 0)
    || (listing?.tradeType === "wolse" && !(Number.isInteger(Number(logRent)) && Number(logRent) > 0))
    || logDate.trim() === "";

  const submitLog = (event: FormEvent) => {
    event.preventDefault();
    setLogError(null);
    if (listing === null || logInvalid) return;
    addLog.mutate({
      priceMan: Number(logPrice),
      monthlyRentMan: listing.tradeType === "wolse" ? Number(logRent) : null,
      note: logNote,
      sourceNote: logSource,
      recordedAt: logDate.trim() ? logDate : null,
    });
  };

  return (
    <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="form-sheet wide">
        {detail.isPending && <p className="empty-copy">매물 정보를 불러오는 중…</p>}
        {!detail.isPending && !listing && (
          <div className="form-head">
            <div>
              <p className="eyebrow">매물 단위 기록</p>
              <h2>매물을 찾을 수 없습니다</h2>
            </div>
            <button type="button" className="close-button" onClick={onClose}>닫기</button>
          </div>
        )}
        {listing && (
          <>
            <div className="form-head">
              <div>
                <p className="eyebrow">{TRADE_TYPE_LABEL[listing.tradeType]} · {LISTING_STATUS_LABEL[listing.status]}</p>
                <h2>{listingDongHo(listing.dong, listing.ho) || listing.brokerName || "매물 기록"}</h2>
              </div>
              <div className="listing-head-actions">
                <button type="button" className="secondary-button" onClick={() => onEdit(listing)}><Icon name="edit" size={16} /> 수정</button>
                <button type="button" className="close-button" onClick={onClose}>닫기</button>
              </div>
            </div>

            <div className="listing-current-price">
              <span>현재 호가</span>
              <strong>{listingPriceText(listing.tradeType, listing.priceMan, listing.monthlyRentMan)}</strong>
              {change !== null && change !== 0 && (
                <span className={`listing-delta ${change < 0 ? "down" : "up"}`}>
                  최초 대비 {money(Math.abs(change))}{change < 0 ? " 하락" : " 상승"}
                  {changePct !== null ? ` (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%)` : ""}
                </span>
              )}
            </div>

            <dl className="listing-meta wide">
              {listing.brokerName && <div><dt>중개업소</dt><dd>{listing.brokerName}</dd></div>}
              {listing.brokerContact && <div><dt>연락처</dt><dd><a href={`tel:${listing.brokerContact.replace(/[^0-9+]/g, "")}`}>{listing.brokerContact}</a></dd></div>}
              {listing.areaSqm !== null && <div><dt>면적</dt><dd>{listing.areaSqm}㎡ ({pyeong(listing.areaSqm).toFixed(1)}평)</dd></div>}
              {listing.targetPriceMan !== null && (
                <div>
                  <dt>목표가</dt>
                  <dd>{money(listing.targetPriceMan)}{targetGap !== null ? (targetGap <= 0 ? <span className="target-hit"> · 도달</span> : <span className="dim-suffix"> · {money(targetGap)} 남음</span>) : null}</dd>
                </div>
              )}
              <div><dt>이력</dt><dd>{logs.length}건</dd></div>
              <div><dt>등록일</dt><dd>{formatLogDate(listing.createdAt)}</dd></div>
            </dl>
            {listing.memo && <p className="listing-memo full">{listing.memo}</p>}
            {listing.listingUrl && <p><a className="text-button" href={listing.listingUrl} target="_blank" rel="noreferrer">원문 매물 보기 ↗</a></p>}

            <section className="negotiation-box">
              <h3>협상 요약</h3>
              <dl>
                {first && <div><dt>최초 호가</dt><dd>{listingPriceText(listing.tradeType, first.priceMan, first.monthlyRentMan)} · {formatLogDate(first.recordedAt)}</dd></div>}
                <div><dt>현재 호가</dt><dd>{listingPriceText(listing.tradeType, listing.priceMan, listing.monthlyRentMan)}</dd></div>
                <div>
                  <dt>누적 변동</dt>
                  <dd>{change === null || change === 0 ? "변동 없음" : `${money(Math.abs(change))}${change < 0 ? " 하락" : " 상승"}${changePct !== null ? ` (${changePct > 0 ? "+" : ""}${changePct.toFixed(1)}%)` : ""}`}</dd>
                </div>
                {basisGap !== null && (
                  <div><dt>등록 기준가 대비</dt><dd>{basisGap === 0 ? "같음" : `${money(Math.abs(basisGap))} ${basisGap > 0 ? "높음" : "낮음"} (${money(property.askingPriceMan)} 기준)`}</dd></div>
                )}
              </dl>
              <p className="negotiation-note">호가는 직접 기록한 값입니다. 계약 조건과 최신 시점은 협상을 앞두고 중개업소·원문에서 다시 확인하세요.</p>
            </section>

            <section className="price-log-block">
              <h3>호가 이력</h3>
              <form className="price-log-form" onSubmit={submitLog}>
                <div className="field-grid">
                  <label>
                    <span>금액(만원)</span>
                    <input value={logPrice} onChange={(event) => setLogPrice(event.target.value)} inputMode="numeric" placeholder="숫자만 입력" />
                  </label>
                  {listing.tradeType === "wolse" && (
                    <label>
                      <span>월세(만원)</span>
                      <input value={logRent} onChange={(event) => setLogRent(event.target.value)} inputMode="numeric" placeholder="숫자만 입력" />
                    </label>
                  )}
                  <label>
                    <span>기록일</span>
                    <input type="date" value={logDate} onChange={(event) => setLogDate(event.target.value)} />
                  </label>
                  <label>
                    <span>출처</span>
                    <input value={logSource} onChange={(event) => setLogSource(event.target.value)} placeholder="예) 직접 확인, 중개사, 온라인" maxLength={80} />
                  </label>
                  <label className="full">
                    <span>메모</span>
                    <input value={logNote} onChange={(event) => setLogNote(event.target.value)} placeholder="예) 급매로 전환, 가격 인하 문의 결과" maxLength={300} />
                  </label>
                </div>
                {logError && <p className="error-copy">{logError}</p>}
                <div className="price-log-actions">
                  <button type="submit" className="primary-button" disabled={logInvalid || addLog.isPending}>{addLog.isPending ? "기록 중…" : "호가 기록 추가"}</button>
                </div>
              </form>
              {logs.length === 0 ? (
                <p className="empty-copy">아직 호가 이력이 없습니다.</p>
              ) : (
                <ol className="price-timeline">
                  {logs.map((log, index) => {
                    const older = logs.at(index + 1) ?? null;
                    const rowDelta = older ? log.priceMan - older.priceMan : null;
                    const rentDelta = older && listing.tradeType === "wolse" ? (log.monthlyRentMan ?? 0) - (older.monthlyRentMan ?? 0) : null;
                    return (
                      <li key={log.id}>
                        <div className="timeline-head">
                          <span className="timeline-date">{formatLogDate(log.recordedAt)}</span>
                          {logs.length > 1 && (
                            <button className="mini-icon-button dim" aria-label={`${formatLogDate(log.recordedAt)} 호가 기록 삭제`} onClick={() => removeLog.mutate(log.id)}><Icon name="trash" size={15} /></button>
                          )}
                        </div>
                        <p className="timeline-price">
                          <strong>{listingPriceText(listing.tradeType, log.priceMan, log.monthlyRentMan)}</strong>
                          {rowDelta !== null && rowDelta !== 0 && (
                            <span className={`listing-delta ${rowDelta < 0 ? "down" : "up"}`}>
                              <Icon name={rowDelta < 0 ? "down" : "up"} size={12} /> {money(Math.abs(rowDelta))}
                            </span>
                          )}
                          {rentDelta !== null && rentDelta !== 0 && (
                            <span className={`listing-delta ${rentDelta < 0 ? "down" : "up"}`}>월세 {money(Math.abs(rentDelta))}{rentDelta < 0 ? " 하락" : " 상승"}</span>
                          )}
                        </p>
                        {(log.sourceNote || log.note) && (
                          <p className="timeline-note">{log.sourceNote && <span className="timeline-source">{log.sourceNote}</span>}{log.sourceNote && log.note && <span> · </span>}{log.note}</p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            <section className="listing-voice-block">
              <h3>음성 메모</h3>
              <VoiceRecorder propertyId={property.id} listingId={listingId} onSaved={invalidateVoice} />
              {listingVoiceMemos.length === 0
                ? <p className="empty-copy">이 매물에 연결된 음성 메모가 없습니다.</p>
                : <div className="voice-list compact">{listingVoiceMemos.map((memo, index) => <VoiceMemoRow key={memo.id} memo={memo} displayIndex={listingVoiceMemos.length - index} linkedLabel={null} onChanged={invalidateVoice} />)}</div>}
            </section>

            <div className="listing-danger-zone">
              <button type="button" className="danger-button" disabled={removeListing.isPending} onClick={() => removeListing.mutate()}>
                <Icon name="trash" size={16} /> 이 매물 기록 삭제
              </button>
              <p className="form-hint">매물을 삭제하면 호가 이력과 연결된 음성 메모도 함께 지워지고 복원할 수 없습니다.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PropertyForm({ existing, onClose, onSaved }: { existing: Property | null; onClose: () => void; onSaved: (id: number) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [address, setAddress] = useState(existing?.address ?? "");
  const [areaSqm, setAreaSqm] = useState(existing ? String(existing.areaSqm) : "");
  const [askingPrice, setAskingPrice] = useState(existing ? String(existing.askingPriceMan) : "");
  const [deposit, setDeposit] = useState(existing?.depositMan === null || existing?.depositMan === undefined ? "" : String(existing.depositMan));
  const [monthly, setMonthly] = useState(existing?.monthlyRentMan === null || existing?.monthlyRentMan === undefined ? "" : String(existing.monthlyRentMan));
  const [purpose, setPurpose] = useState<"both" | "invest" | "reside">(existing?.purpose ?? "both");
  const [visitDate, setVisitDate] = useState(existing?.visitDate ?? "");
  const [memo, setMemo] = useState(existing?.memo ?? "");
  const [candidate, setCandidate] = useState<GeocodeCandidate | null>(existing ? { id: "existing", label: existing.resolvedAddress, name: existing.name, latitude: existing.latitude, longitude: existing.longitude, type: null } : null);

  const geocode = useMutation({ mutationFn: () => api.geocodeProperty({ query: address }) });
  const create = useMutation({
    mutationFn: () => api.createProperty({ name, address, resolvedAddress: candidate?.label ?? "", latitude: candidate?.latitude ?? 0, longitude: candidate?.longitude ?? 0, areaSqm: Number(areaSqm), askingPriceMan: Number(askingPrice), depositMan: deposit ? Number(deposit) : null, monthlyRentMan: monthly ? Number(monthly) : null, purpose, visitDate: visitDate || null, memo }),
    onSuccess: (result) => onSaved(result.id),
  });
  const update = useMutation({
    mutationFn: () => api.updateProperty({ id: existing?.id ?? 0, name, areaSqm: Number(areaSqm), askingPriceMan: Number(askingPrice), depositMan: deposit ? Number(deposit) : null, monthlyRentMan: monthly ? Number(monthly) : null, purpose, visitDate: visitDate || null, memo }),
    onSuccess: () => existing && onSaved(existing.id),
  });
  const remove = useMutation({ mutationFn: () => api.deleteProperty({ id: existing?.id ?? 0 }), onSuccess: () => existing && onSaved(existing.id) });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (existing) update.mutate(); else create.mutate();
  };
  const invalid = !name.trim() || !candidate || !Number.isFinite(Number(areaSqm)) || Number(areaSqm) <= 0 || !Number.isFinite(Number(askingPrice)) || Number(askingPrice) < 0;
  const mutationError = create.error ?? update.error;

  return <div className="modal-backdrop" role="presentation"><section className="form-sheet" role="dialog" aria-modal="true" aria-labelledby="property-form-title"><div className="form-head"><div><p className="eyebrow">{existing ? "기록 정리" : "새 조사 대상"}</p><h2 id="property-form-title">{existing ? "매물 정보 수정" : "매물 등록"}</h2></div><button className="close-button" aria-label="등록 창 닫기" onClick={onClose}>닫기</button></div>
    <form onSubmit={submit}>
      <div className="field-grid">
        <label className="full"><span>매물 이름</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 잠실 ○○아파트 101동" /></label>
        <label className="full"><span>주소</span><div className="address-input"><input value={address} disabled={Boolean(existing)} onChange={(event) => { setAddress(event.target.value); setCandidate(null); geocode.reset(); }} placeholder="도로명과 건물 번호까지 입력" /><button type="button" disabled={Boolean(existing) || address.trim().length < 4 || geocode.isPending} onClick={() => geocode.mutate()}><Icon name="search" size={17} />{geocode.isPending ? "검색 중" : "주소 찾기"}</button></div></label>
        {!existing && geocode.data && <div className="candidate-list full">{geocode.data.candidates.map((item) => <button type="button" key={item.id} className={candidate?.id === item.id ? "selected" : ""} onClick={() => { setCandidate(item); if (!name && item.name) setName(item.name); }}><span>{candidate?.id === item.id ? <Icon name="check" size={16} /> : <Icon name="pin" size={16} />}</span><span><strong>{item.name ?? "주소 위치"}</strong><small>{item.label}</small></span></button>)}{geocode.data.message && <p className="error-copy">{geocode.data.message}</p>}</div>}
        {candidate && <div className="coordinate-confirm full"><Icon name="pin" size={17} /><div><strong>{candidate.label}</strong><span>{candidate.latitude.toFixed(6)}, {candidate.longitude.toFixed(6)} · OpenStreetMap</span></div></div>}
        <label><span>전용면적 (㎡)</span><input type="number" min="1" step="0.01" inputMode="decimal" value={areaSqm} onChange={(event) => setAreaSqm(event.target.value)} placeholder="84.97" /></label>
        <label><span>매도 호가 (만원)</span><input type="number" min="0" step="100" inputMode="numeric" value={askingPrice} onChange={(event) => setAskingPrice(event.target.value)} placeholder="180000" /></label>
        <label><span>전세가 (만원, 선택)</span><input type="number" min="0" step="100" inputMode="numeric" value={deposit} onChange={(event) => setDeposit(event.target.value)} placeholder="100000" /></label>
        <label><span>월세 (만원, 선택)</span><input type="number" min="0" step="1" inputMode="numeric" value={monthly} onChange={(event) => setMonthly(event.target.value)} placeholder="350" /></label>
        <label><span>임장 예정일</span><input type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} /></label>
        <fieldset><legend>주요 목적</legend><div className="purpose-buttons"><button type="button" className={purpose === "both" ? "active" : ""} onClick={() => setPurpose("both")}>둘 다</button><button type="button" className={purpose === "invest" ? "active" : ""} onClick={() => setPurpose("invest")}>투자</button><button type="button" className={purpose === "reside" ? "active" : ""} onClick={() => setPurpose("reside")}>실거주</button></div></fieldset>
        <label className="full"><span>첫인상 메모</span><textarea value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="중개사 확인사항, 임장 전에 볼 포인트" rows={3} /></label>
      </div>
      {mutationError && <p className="error-copy">저장하지 못했습니다. 입력값을 확인해 주세요.</p>}
      <div className="form-actions">{existing && <button type="button" className="danger-button" disabled={remove.isPending} onClick={() => remove.mutate()}><Icon name="trash" size={17} /> 삭제</button>}<span /><button type="button" className="secondary-button" onClick={onClose}>취소</button><button type="submit" className="primary-button" disabled={invalid || create.isPending || update.isPending}>{create.isPending || update.isPending ? "저장 중…" : existing ? "변경 저장" : "매물 저장"}</button></div>
    </form>
  </section></div>;
}

// ---------------- 관심 단지 시세 트래킹 ----------------

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  price_drop: "가격 하락",
  target_reached: "목표가 도달",
  bargain: "급매 후보",
};

const RUN_STATUS_LABELS: Record<"ok" | "needs_key" | "rate_limited" | "error" | "skipped", string> = {
  ok: "확인 완료",
  needs_key: "인증키 필요",
  rate_limited: "호출 한도 초과",
  error: "오류",
  skipped: "건너뜀",
};

type AlertSummary = Pick<PriceAlertItem, "id" | "type" | "title" | "detail" | "month" | "triggerValueMan" | "baselineValueMan" | "changePct" | "sourceUrl" | "createdAt" | "readAt">;

function monthSequence(from: string, to: string): string[] {
  const [fromYear = 1970, fromMonth = 1] = from.split("-").map(Number);
  const [toYear = 1970, toMonth = 1] = to.split("-").map(Number);
  const keys: string[] = [];
  let year = fromYear;
  let month = fromMonth;
  while (keys.length < 72 && (year < toYear || (year === toYear && month <= toMonth))) {
    keys.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return keys;
}

type ChartPoint = { month: string; label: string; avg: number | null; min: number | null; max: number | null; trades: number; ask: number | null };

function buildChartPoints(series: WatchDetailData["series"], asks: WatchDetailData["askRecords"]): ChartPoint[] {
  const seriesByMonth = new Map(series.map((row) => [row.month, row]));
  const monthSet = new Set<string>();
  for (const row of series) monthSet.add(row.month);
  const askMinByMonth = new Map<string, number>();
  for (const ask of asks) {
    const month = ask.recordedAt.slice(0, 7);
    monthSet.add(month);
    const prev = askMinByMonth.get(month);
    if (prev === undefined || ask.amountMan < prev) askMinByMonth.set(month, ask.amountMan);
  }
  const sorted = [...monthSet].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === undefined || last === undefined) return [];
  return monthSequence(first, last).map((month) => {
    const row = seriesByMonth.get(month);
    return {
      month,
      label: `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`,
      avg: row?.avgPriceMan ?? null,
      min: row?.minPriceMan ?? null,
      max: row?.maxPriceMan ?? null,
      trades: row?.tradeCount ?? 0,
      ask: askMinByMonth.get(month) ?? null,
    };
  });
}

function WatchChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ChartPoint }>; label?: string }) {
  const point = payload?.[0]?.payload;
  if (active !== true || !point) return null;
  return (
    <div className="tracking-tip">
      <strong>{label}</strong>
      {point.avg !== null && (
        <>
          <span>월평균 {money(point.avg)}원 · 거래 {point.trades}건</span>
          {point.min !== null && point.max !== null && <span>범위 {money(point.min)}원 ~ {money(point.max)}원</span>}
        </>
      )}
      {point.avg === null && <span>거래 기록 없음</span>}
      {point.ask !== null && <span className="ask-line">직접 호가 {money(point.ask)}원</span>}
    </div>
  );
}

function WatchChart({ series, asks }: { series: WatchDetailData["series"]; asks: WatchDetailData["askRecords"] }) {
  const points = buildChartPoints(series, asks);
  const hasValues = points.some((point) => point.avg !== null || point.ask !== null);
  if (!hasValues) {
    return <div className="chart-empty">아직 차트 데이터가 없습니다. 과거 실거래를 가져오거나 호가를 직접 기록하면 월별 시세가 그려집니다.</div>;
  }
  const withAvg = points.filter((point) => point.avg !== null);
  const firstAvg = withAvg[0];
  const lastAvg = withAvg[withAvg.length - 1];
  const headline = firstAvg && lastAvg && firstAvg !== lastAvg && firstAvg.avg !== null && lastAvg.avg !== null
    ? `차트 기간 ${firstAvg.label} ~ ${lastAvg.label} · 월평균 ${money(firstAvg.avg)}원에서 ${money(lastAvg.avg)}원으로`
    : null;
  return (
    <div className="watch-chart">
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -6 }}>
          <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={34} tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(value: string) => `${Number(value.slice(5))}월`} />
          <YAxis width={58} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(value: number) => (value >= 10000 ? `${(value / 10000).toFixed(1).replace(/\.0$/, "")}억` : `${value.toLocaleString("ko-KR")}만`)} domain={["auto", "auto"]} />
          <Tooltip content={<WatchChartTip />} cursor={{ stroke: "var(--border)" }} />
          <Line type="monotone" dataKey="min" name="월 최저" stroke="var(--dim)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="max" name="월 최고" stroke="var(--dim)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="avg" name="월 평균" stroke="var(--accent)" strokeWidth={2.5} dot={false} connectNulls={false} />
          <Scatter dataKey="ask" name="직접 호가" fill="var(--ask)" r={4} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        <span><i className="swatch avg" aria-hidden="true" /> 월평균 실거래</span>
        <span><i className="swatch band" aria-hidden="true" /> 최저·최고</span>
        <span><i className="swatch ask" aria-hidden="true" /> 직접 호가 (월별 최저)</span>
      </div>
      {headline && <p className="chart-caption">{headline}</p>}
      <p className="chart-caption">거래가 없는 월은 선이 연결되지 않습니다. 월평균은 당월 신고 거래 전건 기준 실거래가이며, 건수가 적으면 일부 거래에 크게 영향을 받습니다.</p>
    </div>
  );
}

type RentChartPoint = { month: string; label: string; jeonse: number | null; wolseMonthly: number | null; jeonseTrades: number; wolseTrades: number };

function buildRentChartPoints(rentSeries: WatchDetailData["rentSeries"]): RentChartPoint[] {
  const byMonth = new Map(rentSeries.map((row) => [row.month, row]));
  const months = rentSeries.map((row) => row.month).sort();
  const first = months[0];
  const last = months[months.length - 1];
  if (first === undefined || last === undefined) return [];
  return monthSequence(first, last).map((month) => {
    const row = byMonth.get(month);
    return {
      month,
      label: `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`,
      jeonse: row?.jeonseMedianMan ?? null,
      wolseMonthly: row?.wolseAvgMonthlyMan ?? null,
      jeonseTrades: row?.jeonseCount ?? 0,
      wolseTrades: row?.wolseCount ?? 0,
    };
  });
}

function WatchRentChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: RentChartPoint }>; label?: string }) {
  const point = payload?.[0]?.payload;
  if (active !== true || !point) return null;
  return (
    <div className="tracking-tip">
      <strong>{label}</strong>
      {point.jeonse === null ? <span>전세 신고 없음</span> : <span>전세 중앙 {money(point.jeonse)}원 · {point.jeonseTrades}건</span>}
      {point.wolseMonthly === null ? <span>월세 신고 없음</span> : <span>월세 평균 {money(point.wolseMonthly)}원 · {point.wolseTrades}건</span>}
    </div>
  );
}

function WatchRentChart({ rentSeries }: { rentSeries: WatchDetailData["rentSeries"] }) {
  const points = buildRentChartPoints(rentSeries);
  const hasValues = points.some((point) => point.jeonse !== null || point.wolseMonthly !== null);
  if (!hasValues) {
    return <div className="chart-empty">신고된 전세·월세 기록이 없습니다. "이 단지 확인"을 누르면 같은 단지·면적의 월별 전세 중앙과 월세 평균이 집계됩니다.</div>;
  }
  return (
    <div className="watch-chart">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -6 }}>
          <XAxis dataKey="month" tickLine={false} axisLine={false} minTickGap={34} tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(value: string) => `${Number(value.slice(5))}월`} />
          <YAxis yAxisId="deposit" width={58} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(value: number) => (value >= 10000 ? `${(value / 10000).toFixed(1).replace(/\.0$/, "")}억` : `${value.toLocaleString("ko-KR")}만`)} domain={["auto", "auto"]} />
          <YAxis yAxisId="monthly" orientation="right" width={56} tickLine={false} axisLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: "var(--dim)" }} tickFormatter={(value: number) => (value >= 10000 ? `${(value / 10000).toFixed(1).replace(/\.0$/, "")}억` : `${value.toLocaleString("ko-KR")}만`)} domain={["auto", "auto"]} />
          <Tooltip content={<WatchRentChartTip />} cursor={{ stroke: "var(--border)" }} />
          <Line yAxisId="deposit" type="monotone" dataKey="jeonse" name="전세 중앙" stroke="var(--ask)" strokeWidth={2.5} dot={false} connectNulls={false} />
          <Line yAxisId="monthly" type="monotone" dataKey="wolseMonthly" name="월세 평균" stroke="var(--teal)" strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="chart-legend">
        <span><i className="swatch jeonse" aria-hidden="true" /> 전세 중앙 (좌축)</span>
        <span><i className="swatch wolse" aria-hidden="true" /> 월세 평균 (우축)</span>
      </div>
      <p className="chart-caption">월세값은 신고된 거래의 월세 평균이며 보증금이 아닙니다. 거래가 없는 월은 선이 연결되지 않습니다.</p>
    </div>
  );
}

type JeonseRow = { month: string; sale: number; saleCount: number; jeonse: number; jeonseCount: number };

function JeonseRatioTable({ series, rentSeries }: { series: WatchDetailData["series"]; rentSeries: WatchDetailData["rentSeries"] }) {
  const saleByMonth = new Map<string, { median: number; count: number }>();
  for (const row of series) {
    if (row.tradeCount > 0 && row.medianPriceMan !== null) saleByMonth.set(row.month, { median: row.medianPriceMan, count: row.tradeCount });
  }
  const rows: JeonseRow[] = [];
  for (const row of rentSeries) {
    if (row.jeonseMedianMan === null) continue;
    const sale = saleByMonth.get(row.month);
    if (sale === undefined) continue;
    rows.push({ month: row.month, sale: sale.median, saleCount: sale.count, jeonse: row.jeonseMedianMan, jeonseCount: row.jeonseCount });
  }
  rows.sort((a, b) => (a.month < b.month ? 1 : -1));
  const visible = rows.slice(0, 12);
  if (visible.length === 0) {
    return <p className="tracking-note">매매 중앙값과 전세 중앙값이 함께 집계된 월이 아직 없습니다. 같은 월에 두 값이 모두 있어야만 전세가율을 계산합니다.</p>;
  }
  return (
    <>
      <ul className="jeonse-list">
        {visible.map((row) => (
          <li key={row.month}>
            <span className="jm-left">
              <strong>{row.month.slice(0, 4)}년 {Number(row.month.slice(5))}월</strong>
              <small>매매 {row.saleCount}건 · 전세 {row.jeonseCount}건</small>
            </span>
            <span className="jm-right">
              <b>{((row.jeonse / row.sale) * 100).toFixed(1)}%</b>
              <small>전세 {money(row.jeonse)}원 · 매매 {money(row.sale)}원 · 갭 {money(row.sale - row.jeonse)}원</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="chart-caption">전세가율은 같은 단지·면적·월의 중앙값으로 계산했습니다. 매매나 전세 중 한쪽 신고가 없으면 그 월은 제외됩니다.</p>
    </>
  );
}

function PriceTrackingView({ apiKey, onBack }: { apiKey: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const watches = useQuery({ queryKey: ["watch-items"], queryFn: () => api.listWatchItems({}) });
  const alerts = useQuery({ queryKey: ["price-alerts"], queryFn: () => api.listPriceAlerts({ unreadOnly: false, limit: 50 }) });
  const autoCheck = useQuery({ queryKey: ["auto-check"], queryFn: () => api.getAutoCheck({}) });
  const [tab, setTab] = useState<"watches" | "alerts">("watches");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formState, setFormState] = useState<{ open: boolean; editing: WatchListItem | null }>({ open: false, editing: null });
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const invalidateWatchData = () => {
    void queryClient.invalidateQueries({ queryKey: ["watch-items"] });
    void queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
    if (selectedId !== null) void queryClient.invalidateQueries({ queryKey: ["watch-detail", selectedId] });
  };

  const check = useMutation({
    mutationFn: () => api.checkWatchPrices({ serviceKey: apiKey.trim() ? apiKey.trim() : undefined, months: 3, scheduled: false, watchIds: watches.data ? watches.data.items.filter((w) => w.active).map((w) => w.id) : undefined }),
    onSuccess: (result) => {
      setStatusNote(result.message);
      invalidateWatchData();
    },
    onError: () => setStatusNote("시세 확인 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."),
  });

  const setAuto = useMutation({
    mutationFn: (enabled: boolean) => api.setAutoCheck({ enabled }),
    onSuccess: (result) => {
      setStatusNote(result.message);
      void queryClient.invalidateQueries({ queryKey: ["auto-check"] });
    },
    onError: () => setStatusNote("자동 확인 설정을 바꾸지 못했습니다."),
  });

  if (watches.isPending || alerts.isPending) {
    return <div className="tracking-view"><div className="loading-screen"><span className="loading-mark" />시세 트래킹을 여는 중…</div></div>;
  }
  if (watches.error || alerts.error || !watches.data || !alerts.data) {
    return (
      <div className="tracking-view">
        <div className="loading-screen">시세 트래킹을 불러오지 못했습니다.
          <button className="secondary-button" onClick={onBack}>현장 보드로 돌아가기</button>
        </div>
      </div>
    );
  }

  const items = watches.data.items;
  const unreadCount = alerts.data.unreadCount;
  const activeItems = items.filter((item) => item.active);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="tracking-view">
      <header className="tracking-header">
        <button className="icon-button" aria-label="현장 보드로 돌아가기" onClick={onBack}><Icon name="back" /></button>
        <div>
          <h1>시세 트래킹</h1>
          <p>관심 단지 실거래 추적 · 하락·목표가 알림</p>
        </div>
        {unreadCount > 0 && <button className="alert-pill" onClick={() => setTab("alerts")}>{unreadCount}개의 새 알림</button>}
        <span className="tracking-header-spacer" />
        <button className="primary-button tracking-check" disabled={check.isPending || activeItems.length === 0} onClick={() => check.mutate()}>{check.isPending ? "확인 중…" : "지금 시세 확인"}</button>
      </header>
      <nav className="tracking-tabs" aria-label="시세 트래킹 탭">
        <button className={tab === "watches" ? "active" : ""} onClick={() => setTab("watches")}>관심 단지 {items.length}</button>
        <button className={tab === "alerts" ? "active" : ""} onClick={() => setTab("alerts")}>알림함{unreadCount > 0 ? ` · ${unreadCount}` : ""}</button>
      </nav>
      {statusNote && <p className="status-copy" role="status">{statusNote}</p>}
      {tab === "alerts" ? (
        <AlertInbox onOpenWatch={(watchId) => { setSelectedId(watchId); setTab("watches"); }} />
      ) : (
        <div className={`tracking-split ${selected ? "has-selection" : ""}`}>
          <section className={`tracking-list ${selected ? "mobile-collapsed" : ""}`} aria-label="관심 단지 목록">
            {items.length === 0 ? (
              <div className="tracking-empty">
                <div className="pin-orbit"><Icon name="bell" size={30} /></div>
                <h2>아직 관심 단지가 없습니다</h2>
                <p>단지명을 정확히 등록하면 국토교통부 아파트 매매 실거래로 월별 시세를 추적합니다. 신규 등록 후 과거 실거래를 가져오면 더 긴 차트를 볼 수 있습니다.</p>
                <button className="primary-button" onClick={() => setFormState({ open: true, editing: null })}><Icon name="plus" /> 관심 단지 추가</button>
              </div>
            ) : (
              <>
                <div className="tracking-list-head">
                  <span>{items.length}개 단지 · {activeItems.length}개 활성</span>
                  <button className="secondary-button" onClick={() => setFormState({ open: true, editing: null })}><Icon name="plus" size={16} /> 추가</button>
                </div>
                <div className="watch-rows">
                  {items.map((item) => <WatchRow key={item.id} item={item} selected={item.id === selectedId} onOpen={() => setSelectedId(item.id)} />)}
                </div>
              </>
            )}
            <div className="tracking-auto">
              <div className="tracking-auto-row">
                <div>
                  <strong>자동 확인</strong>
                  <p>{autoCheck.data?.message ?? "자동 확인 안내를 불러오는 중…"}</p>
                </div>
                <label className={`auto-toggle${autoCheck.data?.supported ? "" : " disabled"}`}>
                  <input
                    type="checkbox"
                    aria-label="자동 확인"
                    checked={autoCheck.data?.enabled ?? false}
                    disabled={!autoCheck.data?.supported || setAuto.isPending}
                    onChange={(e) => setAuto.mutate(e.target.checked)}
                  />
                  <span className="knob" aria-hidden="true" />
                </label>
              </div>
            </div>
            <details className="tracking-disclosure">
              <summary>알림 기준과 한계</summary>
              <p>가격 하락·목표가·급매 기준은 <strong>최근 3개월 국토교통부 아파트 매매 실거래 신고값</strong>을 기준으로 판정합니다. 신고 지연·정정·취소 해제로 시간이 지나면 값이 바뀔 수 있습니다.</p>
              <p>호가는 사용자가 직접 확인해 기록합니다. 중개 포털의 매물을 자동으로 수집하지 않습니다.</p>
              <p>거래 건수가 적은 월의 평균값은 일부 거래에 크게 영향을 받으므로, 대표 시세로 단정하지 마세요.</p>
            </details>
          </section>
          <section className={`tracking-detail ${selected ? "mobile-visible" : ""}`} aria-label="관심 단지 상세">
            {selected ? (
              <WatchDetailPanel watch={selected} apiKey={apiKey} onClose={() => setSelectedId(null)} onEdit={() => setFormState({ open: true, editing: selected })} onChanged={invalidateWatchData} onOpenAlerts={() => setTab("alerts")} />
            ) : (
              <div className="tracking-empty compact">
                <div className="pin-orbit"><Icon name="pin" size={26} /></div>
                <h2>단지를 선택하세요</h2>
                <p>목록에서 단지를 고르면 시세 차트와 알림 조건이 표시됩니다.</p>
              </div>
            )}
          </section>
        </div>
      )}
      {formState.open && <WatchFormModal existing={formState.editing} onClose={() => setFormState({ open: false, editing: null })} onDeleted={() => { setFormState({ open: false, editing: null }); setSelectedId(null); invalidateWatchData(); }} onSaved={(id) => { setFormState({ open: false, editing: null }); setSelectedId(id); invalidateWatchData(); }} />}
    </div>
  );
}

function WatchRow({ item, selected, onOpen }: { item: WatchListItem; selected: boolean; onOpen: () => void }) {
  const change = item.latest?.changePct ?? null;
  const trendLabel = item.latest === null ? "데이터 없음" : change === null ? "전월 데이터 없음" : `${change < 0 ? "하락" : "상승"} ${Math.abs(change).toFixed(1)}%`;
  const runLabel = item.lastRun ? RUN_STATUS_LABELS[item.lastRun.status] : "아직 확인 안 됨";
  return (
    <button className={`watch-row ${selected ? "active" : ""}`} onClick={onOpen} aria-pressed={selected}>
      <span className="watch-row-main">
        <strong>{item.complexName}</strong>
        <small>{item.regionLabel} · {item.areaSqm.toFixed(1)}㎡ (약 {pyeong(item.areaSqm).toFixed(1)}평)</small>
        <small className="watch-row-trendline">{item.latest ? `${item.latest.month.slice(0, 4)}년 ${Number(item.latest.month.slice(5))}월 평균 ${money(item.latest.avgMan)}원 · ${item.latest.tradeCount}건` : "실거래 기록 없음"}</small>
        {item.latestRent && (item.latestRent.jeonseCount > 0 || item.latestRent.wolseCount > 0) && <small className="watch-row-rent">{item.latestRent.month.slice(0, 4)}년 {Number(item.latestRent.month.slice(5))}월 · 전세 중앙 {item.latestRent.jeonseMedianMan === null ? "없음" : `${money(item.latestRent.jeonseMedianMan)}원`} · {item.latestRent.jeonseCount}건{item.latestRent.wolseCount > 0 ? ` · 월세 평균 ${money(item.latestRent.wolseAvgMonthlyMan ?? 0)}원 · ${item.latestRent.wolseCount}건` : ""}</small>}
      </span>
      <span className="watch-row-side">
        {item.unreadAlerts > 0 && <span className="unread-badge" aria-label={`${item.unreadAlerts}개의 읽지 않은 알림`}>{item.unreadAlerts > 99 ? "99+" : item.unreadAlerts}</span>}
        <span className={`trend-pill ${change === null ? "flat" : change < 0 ? "down" : "up"}`}>{trendLabel}</span>
        <small>{item.active ? `최근 ${runLabel}` : "중지됨"}</small>
      </span>
    </button>
  );
}

function WatchDetailPanel({ watch, apiKey, onClose, onEdit, onChanged, onOpenAlerts }: { watch: WatchListItem; apiKey: string; onClose: () => void; onEdit: () => void; onChanged: () => void; onOpenAlerts: () => void }) {
  const detail = useQuery({ queryKey: ["watch-detail", watch.id], queryFn: () => api.getWatchDetail({ watchId: watch.id }) });
  const [note, setNote] = useState<string | null>(null);
  const [askAmount, setAskAmount] = useState("");
  const [askSource, setAskSource] = useState("");
  const [askNote, setAskNote] = useState("");
  const key = apiKey.trim() ? apiKey.trim() : undefined;

  const history = useMutation({
    mutationFn: () => api.fetchWatchHistory({ watchId: watch.id, months: 12, serviceKey: key }),
    onSuccess: (result) => { setNote(result.message); onChanged(); },
    onError: () => setNote("과거 실거래를 가져오지 못했습니다. 인증키와 네트워크를 확인해 주세요."),
  });
  const checkOne = useMutation({
    mutationFn: () => api.checkWatchPrices({ serviceKey: key, months: 3, scheduled: false, watchIds: [watch.id] }),
    onSuccess: (result) => { setNote(result.message); onChanged(); },
    onError: () => setNote("시세 확인 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요."),
  });
  const addAsk = useMutation({
    mutationFn: () => api.addWatchAskRecord({ watchId: watch.id, amountMan: Number(askAmount), source: askSource.trim() ? askSource.trim() : null, note: askNote.trim() ? askNote.trim() : null }),
    onSuccess: (result) => {
      if (result.ok) {
        setAskAmount("");
        setAskSource("");
        setAskNote("");
        setNote(result.alertsCreated > 0 ? `호가를 기록했고, 조건을 만족한 ${result.alertsCreated}개의 알림이 생성됐습니다.` : "호가를 기록했습니다.");
        onChanged();
      } else {
        setNote(result.message ?? "호가를 기록하지 못했습니다.");
      }
    },
    onError: () => setNote("호가를 기록하지 못했습니다. 금액을 확인해 주세요."),
  });

  const busy = history.isPending || checkOne.isPending;

  if (detail.isPending) return <div className="loading-screen"><span className="loading-mark" />시세 기록을 불러오는 중…</div>;
  if (detail.error || !detail.data) {
    return <div className="loading-screen">시세 기록을 찾을 수 없습니다. <button className="secondary-button" onClick={onClose}>목록으로</button></div>;
  }
  const data = detail.data;
  const unread = data.alerts.filter((alert) => alert.readAt === null).length;
  const latestRun = data.runs[0];
  const askInvalid = !Number.isInteger(Number(askAmount)) || Number(askAmount) <= 0;

  return (
    <div className="watch-panel">
      <div className="watch-panel-head">
        <div>
          <button className="icon-button mobile-only" aria-label="관심 단지 목록으로" onClick={onClose}><Icon name="back" /></button>
          <p className="eyebrow">{data.watch.regionLabel}</p>
          <h2>{data.watch.complexName}</h2>
          <p className="watch-panel-meta">{data.watch.areaSqm.toFixed(1)}㎡ (약 {pyeong(data.watch.areaSqm).toFixed(1)}평) · 오차 ±{data.watch.areaToleranceSqm.toFixed(2)}㎡ · {data.watch.active ? "활성 감시 중" : "감시 중지됨"}</p>
        </div>
        <div className="watch-panel-actions">
          <button className="secondary-button" onClick={onEdit}><Icon name="edit" size={16} /> 설정 변경</button>
        </div>
      </div>

      <div className="watch-conditions">
        <span>하락 알림 {data.watch.dropAlertPct}%↓</span>
        <span>목표가 {data.watch.targetPriceMan === null ? "미설정" : `${money(data.watch.targetPriceMan)}원`}</span>
        <span>급매 기준 {data.watch.bargainBelowMan === null ? "미설정" : `${money(data.watch.bargainBelowMan)}원 이하`}</span>
        {data.watch.notes && <span className="notes-chip">{data.watch.notes}</span>}
      </div>

      {note && <p className="status-copy" role="status">{note}</p>}

      <div className="watch-runline">
        <span>{latestRun ? `최근 확인 ${formatUpdated(latestRun.createdAt)} · ${RUN_STATUS_LABELS[latestRun.status]}` : "아직 확인 기록이 없습니다"}</span>
        <div>
          <button className="secondary-button" disabled={busy} onClick={() => checkOne.mutate()}><Icon name="refresh" size={16} />{checkOne.isPending ? "확인 중…" : "이 단지 확인"}</button>
          <button className="secondary-button" disabled={busy} onClick={() => history.mutate()}><Icon name="refresh" size={16} />{history.isPending ? "로드 중…" : "과거 12개월 실거래 가져오기"}</button>
        </div>
      </div>
      {latestRun?.message && <p className="tracking-note">{latestRun.message}</p>}

      <section className="tracking-section">
        <h3>월별 시세</h3>
        <WatchChart series={data.series} asks={data.askRecords} />
      </section>

      <section className="tracking-section">
        <h3>월별 전세 · 월세 시세</h3>
        <WatchRentChart rentSeries={data.rentSeries} />
      </section>

      <section className="tracking-section">
        <h3>전세가율 (같은 단지·면적)</h3>
        <JeonseRatioTable series={data.series} rentSeries={data.rentSeries} />
      </section>

      <section className="tracking-section">
        <h3>직접 호가 기록</h3>
        <p className="tracking-note">직접 확인한 매물 호가를 기록합니다. 기록된 값이 목표가·급매 기준을 만족하면 알림이 생성됩니다.</p>
        <form
          className="ask-form"
          onSubmit={(event) => { event.preventDefault(); if (!askInvalid) addAsk.mutate(); }}
        >
          <label><span>호가 (만원)</span><input type="number" min="1" step="1" inputMode="numeric" value={askAmount} onChange={(event) => setAskAmount(event.target.value)} placeholder="85000" aria-label="호가 금액 (만원)" /></label>
          <label><span>출처 (선택)</span><input value={askSource} onChange={(event) => setAskSource(event.target.value)} placeholder="예: 네이버부동산, 중개업소 직통" aria-label="호가 출처" /></label>
          <label className="full"><span>메모 (선택)</span><input value={askNote} onChange={(event) => setAskNote(event.target.value)} placeholder="예: 101동 8층, 옵션 포함" aria-label="호가 메모" /></label>
          <div className="ask-form-actions">
            <button type="submit" className="primary-button" disabled={askInvalid || addAsk.isPending}>{addAsk.isPending ? "기록 중…" : "호가 기록"}</button>
          </div>
        </form>
        {data.askRecords.length > 0 ? (
          <ul className="ask-list">
            {data.askRecords.map((record) => (
              <li key={record.id}>
                <strong>{money(record.amountMan)}원</strong>
                <span>{formatUpdated(record.recordedAt)}</span>
                {record.source && <span>{record.source}</span>}
                {record.note && <span className="dim">{record.note}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tracking-note">아직 직접 기록한 호가가 없습니다.</p>
        )}
      </section>

      <section className="tracking-section">
        <div className="section-head">
          <h3>이 단지의 알림 {unread > 0 && <span className="unread-badge">{unread}</span>}</h3>
          <button className="secondary-button" onClick={onOpenAlerts}>알림함 전체 보기</button>
        </div>
        {data.alerts.length === 0 ? (
          <p className="tracking-note">아직 생성된 알림이 없습니다. 확인을 실행하면 설정한 조건을 기준으로 알림이 생성됩니다.</p>
        ) : (
          <div className="alert-list">
            {data.alerts.map((alert) => <AlertItemRow key={alert.id} alert={alert} />)}
          </div>
        )}
      </section>

      <section className="tracking-section">
        <h3>확인 기록</h3>
        {data.runs.length === 0 ? (
          <p className="tracking-note">확인 기록이 없습니다.</p>
        ) : (
          <ul className="run-list">
            {data.runs.map((run) => (
              <li key={run.id}>
                <span>{formatUpdated(run.createdAt)}</span>
                <span>{RUN_STATUS_LABELS[run.status]}</span>
                <span>새 거래 {run.newTrades}건 · 알림 {run.alertsCreated}건</span>
                {run.message && <span className="dim">{run.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AlertItemRow({ alert }: { alert: AlertSummary }) {
  const queryClient = useQueryClient();
  const read = useMutation({
    mutationFn: (id: number) => api.markAlertsRead({ ids: [id] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["watch-items"] });
    },
  });
  return (
    <article className={`alert-card ${alert.readAt ? "read" : "unread"}`}>
      <div className="alert-card-head">
        <span className={`alert-type ${alert.type}`}>{ALERT_TYPE_LABELS[alert.type]}</span>
        <span className="dim">{formatUpdated(alert.createdAt)}{alert.month ? ` · ${alert.month.slice(0, 4)}년 ${Number(alert.month.slice(5))}월` : ""}</span>
      </div>
      <strong>{alert.title}</strong>
      <p>{alert.detail}</p>
      <div className="alert-card-actions">
        {alert.sourceUrl ? (
          <a href={alert.sourceUrl} target="_blank" rel="noreferrer">출처(공공데이터포털) 보기</a>
        ) : (
          <span className="dim">사용자 직접 입력 · 출처 미등록</span>
        )}
        {alert.readAt === null && (
          <button className="secondary-button" disabled={read.isPending} onClick={() => read.mutate(alert.id)}>{read.isPending ? "처리 중…" : "읽음"}</button>
        )}
      </div>
    </article>
  );
}

function AlertInbox({ onOpenWatch }: { onOpenWatch: (watchId: number) => void }) {
  const queryClient = useQueryClient();
  const alerts = useQuery({ queryKey: ["price-alerts"], queryFn: () => api.listPriceAlerts({ unreadOnly: false, limit: 50 }) });
  const readAll = useMutation({
    mutationFn: () => api.markAlertsRead({ ids: [] }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["price-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["watch-items"] });
    },
  });

  if (alerts.isPending) return <div className="loading-screen"><span className="loading-mark" />알림을 불러오는 중…</div>;
  if (alerts.error || !alerts.data) return <div className="loading-screen">알림을 불러오지 못했습니다.</div>;

  const items = alerts.data.alerts;
  const unread = alerts.data.unreadCount;

  return (
    <div className="alert-inbox">
      <div className="inbox-head">
        <span>{items.length}개의 알림{unread > 0 && ` · ${unread}개 읽지 않음`}</span>
        <button className="secondary-button" disabled={unread === 0 || readAll.isPending} onClick={() => readAll.mutate()}>{readAll.isPending ? "처리 중…" : "모두 읽음"}</button>
      </div>
      {items.length === 0 ? (
        <div className="tracking-empty compact">
          <div className="pin-orbit"><Icon name="bell" size={26} /></div>
          <h2>아직 알림이 없습니다</h2>
          <p>시세 확인을 실행하면 조건을 만족한 경우 알림이 생성됩니다.</p>
        </div>
      ) : (
        <div className="alert-list">
          {items.map((alert) => (
            <div key={alert.id} className="alert-with-context">
              <AlertItemRow alert={alert} />
              <button className="context-button" onClick={() => onOpenWatch(alert.watchId)}>「{alert.watchComplex}」 상세 보기</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WatchFormModal({ existing, onClose, onDeleted, onSaved }: { existing: WatchListItem | null; onClose: () => void; onDeleted: () => void; onSaved: (id: number) => void }) {
  const [lawdCd, setLawdCd] = useState(existing?.lawdCd ?? "");
  const [regionLabel, setRegionLabel] = useState(existing?.regionLabel ?? "");
  const [complexName, setComplexName] = useState(existing?.complexName ?? "");
  const [areaSqm, setAreaSqm] = useState(existing ? String(existing.areaSqm) : "");
  const [areaToleranceSqm, setAreaToleranceSqm] = useState(existing ? String(existing.areaToleranceSqm) : "1");
  const [dropAlertPct, setDropAlertPct] = useState(existing ? String(existing.dropAlertPct) : "3");
  const [targetPriceMan, setTargetPriceMan] = useState(existing?.targetPriceMan !== null && existing?.targetPriceMan !== undefined ? String(existing.targetPriceMan) : "");
  const [bargainBelowMan, setBargainBelowMan] = useState(existing?.bargainBelowMan !== null && existing?.bargainBelowMan !== undefined ? String(existing.bargainBelowMan) : "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [active, setActive] = useState(existing?.active ?? true);
  const [formError, setFormError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.addWatchItem({
      lawdCd: lawdCd.trim(),
      regionLabel: regionLabel.trim(),
      complexName: complexName.trim(),
      areaSqm: Number(areaSqm),
      areaToleranceSqm: Number(areaToleranceSqm),
      dropAlertPct: Number(dropAlertPct),
      targetPriceMan: targetPriceMan.trim() ? Number(targetPriceMan) : null,
      bargainBelowMan: bargainBelowMan.trim() ? Number(bargainBelowMan) : null,
      notes: notes.trim(),
    }),
    onSuccess: (result) => {
      if (result.ok && result.id !== null) onSaved(result.id);
      else setFormError(result.message ?? "저장하지 못했습니다.");
    },
    onError: () => setFormError("저장하지 못했습니다. 입력값을 확인해 주세요."),
  });

  const update = useMutation({
    mutationFn: () => api.updateWatchItem({
      id: existing?.id ?? 0,
      complexName: complexName.trim(),
      areaSqm: Number(areaSqm),
      areaToleranceSqm: Number(areaToleranceSqm),
      active,
      dropAlertPct: Number(dropAlertPct),
      targetPriceMan: targetPriceMan.trim() ? Number(targetPriceMan) : null,
      bargainBelowMan: bargainBelowMan.trim() ? Number(bargainBelowMan) : null,
      notes: notes.trim(),
    }),
    onSuccess: (result) => {
      if (result.ok && existing) onSaved(existing.id);
      else setFormError(result.message ?? "저장하지 못했습니다.");
    },
    onError: () => setFormError("저장하지 못했습니다. 입력값을 확인해 주세요."),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteWatchItem({ id: existing?.id ?? 0 }),
    onSuccess: (result) => {
      if (result.ok) onDeleted();
      else setFormError(result.message ?? "삭제하지 못했습니다.");
    },
    onError: () => setFormError("삭제하지 못했습니다."),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!invalid) {
      if (existing) update.mutate();
      else create.mutate();
    }
  };

  const invalid =
    !/^\d{5}$/.test(lawdCd.trim()) ||
    regionLabel.trim().length < 2 ||
    complexName.trim().length < 2 ||
    !(Number(areaSqm) > 0) ||
    !(Number(areaToleranceSqm) >= 0 && Number(areaToleranceSqm) <= 20) ||
    !(Number(dropAlertPct) >= 0 && Number(dropAlertPct) <= 50) ||
    (targetPriceMan.trim() !== "" && !(Number.isInteger(Number(targetPriceMan)) && Number(targetPriceMan) > 0)) ||
    (bargainBelowMan.trim() !== "" && !(Number.isInteger(Number(bargainBelowMan)) && Number(bargainBelowMan) > 0));

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="form-sheet" role="dialog" aria-modal="true" aria-labelledby="watch-form-title">
        <div className="form-head">
          <div>
            <p className="eyebrow">{existing ? "관심 단지 설정" : "새 관심 단지"}</p>
            <h2 id="watch-form-title">{existing ? "알림 조건 변경" : "관심 단지 추가"}</h2>
          </div>
          <button className="close-button" aria-label="관심 단지 창 닫기" onClick={onClose}>닫기</button>
        </div>
        <form onSubmit={submit}>
          <div className="field-grid">
            <label><span>지역 코드 (5자리)</span><input value={lawdCd} disabled={Boolean(existing)} onChange={(event) => setLawdCd(event.target.value)} placeholder="11680" inputMode="numeric" aria-label="관심 단지 지역 코드" /></label>
            <label><span>지역 표시 이름</span><input value={regionLabel} disabled={Boolean(existing)} onChange={(event) => setRegionLabel(event.target.value)} placeholder="서울특별시 강남구" aria-label="관심 단지 지역 표시 이름" /></label>
            <label className="full"><span>단지명 (국토부 실거래 표기와 동일하게)</span><input value={complexName} onChange={(event) => setComplexName(event.target.value)} placeholder="예: 래미안포레스트" aria-label="관심 단지명" /></label>
            {!existing && <p className="full tracking-note">단지명은 국토교통부 실거래 자료의 아파트명과 정확히 같아야 집계됩니다. 지도 화면의 실거래 검색에서 실제 표기를 확인하세요.</p>}
            <label><span>전용면적 (㎡)</span><input type="number" min="1" step="0.01" inputMode="decimal" value={areaSqm} onChange={(event) => setAreaSqm(event.target.value)} placeholder="84.97" aria-label="관심 단지 전용면적" /></label>
            <label><span>면적 허용 오차 (㎡)</span><input type="number" min="0" max="20" step="0.1" inputMode="decimal" value={areaToleranceSqm} onChange={(event) => setAreaToleranceSqm(event.target.value)} aria-label="면적 허용 오차" /></label>
            <label><span>가격 하락 알림 (%)</span><input type="number" min="0" max="50" step="0.5" inputMode="decimal" value={dropAlertPct} onChange={(event) => setDropAlertPct(event.target.value)} aria-label="가격 하락 알림 비율" /></label>
            <label><span>목표가 (만원, 선택)</span><input type="number" min="1" step="1" inputMode="numeric" value={targetPriceMan} onChange={(event) => setTargetPriceMan(event.target.value)} placeholder="85000" aria-label="목표가" /></label>
            <label className="full"><span>급매 기준 (만원 이하, 선택)</span><input type="number" min="1" step="1" inputMode="numeric" value={bargainBelowMan} onChange={(event) => setBargainBelowMan(event.target.value)} placeholder="80000" aria-label="급매 기준가" /></label>
            {existing && (
              <label className="full checkline"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> 이 단지의 시세 확인을 일시 중지 (체크 해제 시 비활성)</label>
            )}
            {!existing && <p className="full tracking-note">등록 후 확인을 실행하면 바로 사용할 수 있습니다.</p>}
            <label className="full"><span>메모 (선택)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="예: 방 3개, 고층 우선 검토" aria-label="관심 단지 메모" /></label>
          </div>
          {formError && <p className="error-copy" role="alert">{formError}</p>}
          <div className="form-actions">
            {existing && <button type="button" className="danger-button" disabled={remove.isPending} onClick={() => { setFormError(null); remove.mutate(); }}><Icon name="trash" size={17} /> 삭제</button>}
            <span />
            <button type="button" className="secondary-button" onClick={onClose}>취소</button>
            <button type="submit" className="primary-button" disabled={invalid || create.isPending || update.isPending}>{create.isPending || update.isPending ? "저장 중…" : existing ? "변경 저장" : "단지 저장"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ---------------- 임장 코스·동선 ----------------

const defaultCourseTitle = () => {
  const now = new Date();
  return `임장 코스 · ${now.getMonth() + 1}월 ${now.getDate()}일`;
};

function CourseCardRow({ item, onOpen }: { item: TourCourseListItem; onOpen: () => void }) {
  const progress = item.stopCount === 0 ? 0 : Math.round((item.completedCount / item.stopCount) * 100);
  return (
    <button className="course-card" onClick={onOpen}>
      <div className="course-card-top">
        <span className="course-date">{formatVisitDate(item.visitDate)}</span>
        <span className="course-stop-count">{item.stopCount}곳</span>
      </div>
      <strong className="course-title">{item.title}</strong>
      {item.notes && <p className="course-notes">{item.notes}</p>}
      {item.stopCount > 0 ? (
        <>
          <div className="course-progress" role="img" aria-label={`방문 진행률 ${progress}%`}>
            <i style={{ width: `${progress}%` }} />
          </div>
          <span className="course-distance">
            {item.completedCount}/{item.stopCount} 완료 · 총 {formatDistance(item.totalDistanceM)} · 도보 {formatWalkMinutes(item.totalWalkMinutes)} · 직선거리 기준
          </span>
        </>
      ) : (
        <span className="course-distance">아직 매물이 없습니다. 코스를 열어 매물을 추가하세요.</span>
      )}
    </button>
  );
}

function CourseView({ initialSelectedId, properties, onBack, onOpenProperty }: {
  initialSelectedId: number | null;
  properties: Property[];
  onBack: () => void;
  onOpenProperty: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const courses = useQuery({ queryKey: ["tour-courses"], queryFn: () => api.listTourCourses({}) });
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId);
  const [formState, setFormState] = useState<{ open: boolean; editing: TourCourseListItem | null }>({ open: false, editing: null });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["tour-courses"] });

  if (courses.isPending) {
    return (
      <div className="course-page">
        <div className="loading-screen"><span className="loading-mark" />임장 코스를 여는 중…</div>
      </div>
    );
  }
  if (courses.error || !courses.data) {
    return (
      <div className="course-page">
        <div className="loading-screen">
          <p>임장 코스를 불러오지 못했습니다.</p>
          <button className="secondary-button" onClick={onBack}>현장 보드로 돌아가기</button>
        </div>
      </div>
    );
  }
  const items = courses.data.courses;

  if (selectedId !== null) {
    return (
      <div className="course-page">
        <CourseDetailView
          courseId={selectedId}
          properties={properties}
          onBack={() => { setSelectedId(null); invalidate(); }}
          onDeleted={() => { setSelectedId(null); invalidate(); }}
          onOpenProperty={onOpenProperty}
        />
      </div>
    );
  }

  return (
    <div className="course-page">
      <header className="course-header">
        <button className="icon-button" aria-label="현장 보드로 돌아가기" onClick={onBack}><Icon name="back" /></button>
        <div className="course-header-copy">
          <p className="eyebrow">현장 동선</p>
          <h1>임장 코스</h1>
        </div>
        <button className="primary-button" onClick={() => setFormState({ open: true, editing: null })}>
          <Icon name="plus" size={17} /> 새 코스
        </button>
      </header>
      <section className="course-list" aria-label="임장 코스 목록">
        {items.length === 0 ? (
          <div className="course-empty">
            <Icon name="route" size={30} />
            <strong>아직 만든 코스가 없습니다</strong>
            <p>방문할 매물 여러 곳을 한 코스로 묶고, 방문 순서와 구간별 도보시간을 지도에 그려보세요.</p>
            <button className="primary-button" onClick={() => setFormState({ open: true, editing: null })}>
              <Icon name="plus" size={17} /> 첫 코스 만들기
            </button>
            <p className="course-assumption">도보시간은 직선거리 기준, 시속 4km 가정으로 계산한 추정치입니다.</p>
          </div>
        ) : (
          <div className="course-cards">
            {items.map((item) => (
              <CourseCardRow key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
            ))}
          </div>
        )}
      </section>
      <footer className="comparison-source">
        임장 코스·동선 참고 · <a href="https://github.com/ljhdy/dotherich" target="_blank" rel="noreferrer">doTheRich 원문 ↗</a>
      </footer>
      {formState.open && (
        <CourseFormModal
          existing={formState.editing ? { id: formState.editing.id, title: formState.editing.title, visitDate: formState.editing.visitDate, notes: formState.editing.notes } : null}
          onClose={() => setFormState({ open: false, editing: null })}
          onSaved={(id) => { setFormState({ open: false, editing: null }); setSelectedId(id); invalidate(); }}
        />
      )}
    </div>
  );
}

function CourseDetailView({ courseId, properties, onBack, onDeleted, onOpenProperty }: {
  courseId: number;
  properties: Property[];
  onBack: () => void;
  onDeleted: () => void;
  onOpenProperty: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["tour-course", courseId], queryFn: () => api.getTourCourse({ id: courseId }) });
  const [mapTileFailed, setMapTileFailed] = useState(false);
  const vworldTile = useVworldTileUrl();
  const [showForm, setShowForm] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["tour-course", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["tour-courses"] });
  };
  const remove = useMutation({
    mutationFn: () => api.deleteTourCourse({ id: courseId }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["tour-courses"] }); onDeleted(); },
  });
  const saveStop = useMutation({
    mutationFn: (payload: { id: number; completed: boolean; memo: string }) => api.updateCourseStop(payload),
    onSuccess: invalidate,
  });
  const reorder = useMutation({
    mutationFn: (propertyIds: number[]) => api.setCourseStops({ courseId, propertyIds }),
    onSuccess: invalidate,
  });

  if (detail.isPending) return <div className="loading-screen"><span className="loading-mark" />코스를 불러오는 중…</div>;
  const detailData = detail.data;
  if (detail.error || !detailData?.course) {
    return (
      <div className="course-detail-missing">
        <h2>코스를 찾지 못했습니다</h2>
        <p>삭제되었거나 확인할 수 없는 코스입니다.</p>
        <button className="secondary-button" onClick={onBack}>코스 목록으로 돌아가기</button>
      </div>
    );
  }
  const course = detailData.course;
  const stops = detailData.stops;
  const coords: Array<[number, number]> = stops.map((stop) => [stop.property.latitude, stop.property.longitude]);
  const bounds: LatLngBoundsExpression | null = coords.length > 1 ? coords : null;
  const center: [number, number] = coords[0] ?? defaultMapCenter;
  const completedCount = stops.filter((stop) => stop.completed).length;
  const progress = stops.length === 0 ? 0 : Math.round((completedCount / stops.length) * 100);
  const actionPending = reorder.isPending || saveStop.isPending;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stops.length || actionPending) return;
    const next = [...stops];
    const current = next[index];
    const other = next[target];
    if (current === undefined || other === undefined) return;
    next[index] = other;
    next[target] = current;
    reorder.mutate(next.map((stop) => stop.property.id));
  };
  const removeStop = (stop: TourCourseStop) => {
    if (actionPending) return;
    reorder.mutate(stops.filter((item) => item.id !== stop.id).map((item) => item.property.id));
  };

  return (
    <div className="course-detail">
      <header className="course-header">
        <button className="icon-button" aria-label="코스 목록으로 돌아가기" onClick={onBack}><Icon name="back" /></button>
        <div className="course-header-copy">
          <p className="eyebrow">{formatVisitDate(course.visitDate)}</p>
          <h1>{course.title}</h1>
        </div>
        <div className="course-header-actions">
          <button className="icon-button" aria-label="코스 수정하기" onClick={() => setShowForm(true)}><Icon name="edit" size={17} /></button>
          <button className="icon-button danger-icon" aria-label="코스 삭제하기" disabled={remove.isPending} onClick={() => remove.mutate()}><Icon name="trash" size={17} /></button>
        </div>
      </header>

      {course.notes && <p className="course-detail-notes">{course.notes}</p>}

      <section className="course-summary" aria-label="코스 요약">
        <div><span>방문 순서</span><strong>{stops.length}곳 · {completedCount} 완료</strong></div>
        <div><span>총 직선거리</span><strong>{formatDistance(detailData.totalDistanceM)}</strong></div>
        <div><span>도보 추정</span><strong>{formatWalkMinutes(detailData.totalWalkMinutes)}</strong></div>
      </section>
      {stops.length > 0 && (
        <div className="course-progress detail" role="img" aria-label={`방문 진행률 ${progress}%`}>
          <i style={{ width: `${progress}%` }} />
        </div>
      )}
      <p className="course-assumption">{detailData.walkAssumption}. 실제 도로 기준이 아니므로 구간 거리가 길면 지도 앱에서 다시 확인해 주세요.</p>

      <section className="course-map-wrap" aria-label="방문 순서 지도">
        <MapContainer center={center} zoom={coords.length > 0 ? 14 : 7} className="map-canvas course-map" scrollWheelZoom={true} zoomControl={true} doubleClickZoom={true} dragging={true} attributionControl={true}>
          {vworldTile.tileUrl && (
            <TileLayer
              attribution={VWORLD_ATTRIBUTION}
              url={vworldTile.tileUrl}
              maxZoom={20}
              maxNativeZoom={19}
              eventHandlers={{
                load: () => setMapTileFailed(false),
                tileerror: () => setMapTileFailed(true),
              }}
            />
          )}
          <MapViewport bounds={bounds} center={center} zoom={coords.length > 0 ? 14 : 7} />
          {coords.length > 1 && <Polyline positions={coords} pathOptions={{ color: "#087e7b", weight: 4, dashArray: "1 7", lineCap: "round" }} />}
          {stops.map((stop, index) => (
            <Marker
              key={stop.id}
              position={[stop.property.latitude, stop.property.longitude]}
              icon={divIcon({ className: `property-map-marker course${stop.completed ? " done" : ""}`, html: `<span>${index + 1}</span>`, iconSize: [34, 40], iconAnchor: [17, 40], popupAnchor: [0, -36] })}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{index + 1}. {stop.property.name}</strong>
                  <span>{stop.property.address}</span>
                  <button onClick={() => onOpenProperty(stop.property.id)}>임장기록 열기</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        <button className="course-map-button" onClick={() => setShowPicker(true)}>
          <Icon name="plus" size={16} /> 매물 추가·정리
        </button>
        {!vworldTile.isPending && !vworldTile.configured && stops.length > 0 && (
          <div className="map-key-guide" role="status">
            <Icon name="key" size={22} />
            <strong>배경지도 키가 없습니다</strong>
            <p>설정에서 무료 VWorld API 키를 등록하면 코스 지도에도 배경이 표시됩니다. 방문 순서와 경로는 지금도 확인할 수 있습니다.</p>
          </div>
        )}
        {vworldTile.configured && mapTileFailed && (
          <div className="map-tile-warning" role="status">
            <strong>배경지도를 불러오지 못했습니다</strong>
            <span>키의 도메인 허용 범위에 이 앱 주소가 포함되어 있는지 확인해 주세요. 아래 순서 목록은 그대로 사용할 수 있습니다.</span>
          </div>
        )}
        {stops.length === 0 && (
          <div className="map-empty">
            <Icon name="route" size={26} />
            <strong>방문할 매물을 추가하세요</strong>
            <p>저장한 매물을 순서대로 담으면 동선 지도에 경로가 그려집니다.</p>
            <button className="primary-button" onClick={() => setShowPicker(true)}>
              <Icon name="plus" size={17} /> 매물 담기
            </button>
          </div>
        )}
      </section>

      <section className="course-stops-wrap" aria-label="방문 순서 목록">
        {stops.length === 0 ? (
          <p className="empty-copy">코스에 매물을 담으면 이곳에 방문 순서와 구간별 도보시간이 표시됩니다.</p>
        ) : (
          <ol className="course-stops">
            {stops.map((stop, index) => (
              <CourseStopRow
                key={stop.id}
                stop={stop}
                index={index}
                isFirst={index === 0}
                isLast={index === stops.length - 1}
                pending={actionPending}
                onSave={(completed, memo) => saveStop.mutate({ id: stop.id, completed, memo })}
                onMove={(direction) => move(index, direction)}
                onRemove={() => removeStop(stop)}
                onOpen={() => onOpenProperty(stop.property.id)}
              />
            ))}
          </ol>
        )}
      </section>

      {showForm && (
        <CourseFormModal
          existing={{ id: course.id, title: course.title, visitDate: course.visitDate, notes: course.notes }}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); invalidate(); }}
        />
      )}
      {showPicker && (
        <StopsPickerModal
          courseId={courseId}
          orderedIds={stops.map((stop) => stop.property.id)}
          properties={properties}
          onClose={() => setShowPicker(false)}
          onSaved={() => { setShowPicker(false); invalidate(); }}
        />
      )}
    </div>
  );
}

function CourseStopRow({ stop, index, isFirst, isLast, pending, onSave, onMove, onRemove, onOpen }: {
  stop: TourCourseStop;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  onSave: (completed: boolean, memo: string) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const [memo, setMemo] = useState(stop.memo);
  useEffect(() => setMemo(stop.memo), [stop.memo]);
  const commitMemo = () => {
    if (memo !== stop.memo && !pending) onSave(stop.completed, memo);
  };
  return (
    <li className={`course-stop${stop.completed ? " done" : ""}`}>
      <div className="course-stop-main">
        <button
          className="stop-complete"
          aria-label={`${stop.property.name} ${stop.completed ? "방문 완료 해제" : "방문 완료 표시"}`}
          disabled={pending}
          onClick={() => onSave(!stop.completed, memo)}
        >
          <span className="stop-number">{index + 1}</span>
          <span className={`stop-check${stop.completed ? " on" : ""}`} aria-hidden={true}>
            {stop.completed && <Icon name="check" size={15} />}
          </span>
        </button>
        <div className="course-stop-copy">
          <strong>{stop.property.name}</strong>
          <small>{stop.property.address}</small>
          {stop.legFromPrevious && (
            <span className="leg-info">
              직선거리 {formatDistance(stop.legFromPrevious.distanceM)} · 도보 {formatWalkMinutes(stop.legFromPrevious.walkMinutes)}
            </span>
          )}
          <div className="stop-meta">
            {stop.revisitOpenCount > 0 && (
              <button className="stop-chip" onClick={onOpen} aria-label={`${stop.property.name} 재확인 ${stop.revisitOpenCount}건 보기`}>
                재확인 {stop.revisitOpenCount}건
              </button>
            )}
            <span className="stop-checklist-meta">현장 확인 {stop.checklistDone}/{stop.checklistTotal}</span>
          </div>
        </div>
      </div>
      <input
        className="stop-memo"
        aria-label={`${stop.property.name} 구간 메모`}
        value={memo}
        maxLength={300}
        onChange={(event) => setMemo(event.target.value)}
        onBlur={commitMemo}
        placeholder="방문 시 확인사항"
      />
      <div className="stop-actions">
        <div className="stop-movers">
          <button className="icon-button stop-mover" aria-label={`${stop.property.name} 순서 올리기`} disabled={isFirst || pending} onClick={() => onMove(-1)}><Icon name="up" size={15} /></button>
          <button className="icon-button stop-mover" aria-label={`${stop.property.name} 순서 내리기`} disabled={isLast || pending} onClick={() => onMove(1)}><Icon name="down" size={15} /></button>
        </div>
        <a
          className="icon-button stop-mover"
          aria-label={`${stop.property.name} 카카오맵 길찾기`}
          href={`https://map.kakao.com/link/to/${encodeURIComponent(stop.property.name)},${stop.property.latitude},${stop.property.longitude}`}
          target="_blank"
          rel="noreferrer"
          title="카카오맵 길찾기"
        >
          <Icon name="route" size={15} />
        </a>
        <button className="secondary-button stop-record" onClick={onOpen}>기록 열기</button>
        <button className="icon-button stop-mover danger-icon" aria-label={`${stop.property.name} 코스에서 제외`} disabled={pending} onClick={onRemove}><Icon name="trash" size={15} /></button>
      </div>
    </li>
  );
}

function CourseFormModal({ existing, onClose, onSaved }: {
  existing: { id: number; title: string; visitDate: string | null; notes: string } | null;
  onClose: () => void;
  onSaved: (id: number) => void;
}) {
  const [title, setTitle] = useState(existing?.title ?? defaultCourseTitle());
  const [visitDate, setVisitDate] = useState(existing?.visitDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const pending = existing === null;

  const create = useMutation({
    mutationFn: () => api.createTourCourse({ title: title.trim(), visitDate: visitDate || null, notes, propertyIds: [] }),
    onSuccess: (result) => {
      if (result.ok && result.id !== null) onSaved(result.id);
      else setError(result.message ?? "코스를 저장하지 못했습니다.");
    },
    onError: () => setError("코스를 저장하지 못했습니다. 입력값을 확인해 주세요."),
  });
  const update = useMutation({
    mutationFn: () => api.updateTourCourse({ id: existing?.id ?? 0, title: title.trim(), visitDate: visitDate || null, notes }),
    onSuccess: (result) => {
      if (result.ok && existing) onSaved(existing.id);
      else setError(result.message ?? "코스를 저장하지 못했습니다.");
    },
    onError: () => setError("코스를 저장하지 못했습니다. 입력값을 확인해 주세요."),
  });
  const isPending = create.isPending || update.isPending;
  const save = () => {
    if (!title.trim()) { setError("코스 이름을 입력해 주세요."); return; }
    setError(null);
    if (pending) create.mutate(); else update.mutate();
  };

  return (
    <div className="modal-backdrop">
      <section className="form-sheet" role="dialog" aria-modal="true" aria-label={pending ? "새 임장 코스 만들기" : "임장 코스 수정하기"}>
        <header className="sheet-header">
          <h2>{pending ? "새 임장 코스" : "코스 수정"}</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}><Icon name="back" /></button>
        </header>
        <div className="sheet-body">
          <label className="field">
            <span>코스 이름</span>
            <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="예: 10월 첫째 주 전포동 임장 코스" />
          </label>
          <label className="field">
            <span>방문 날짜 <i>(선택)</i></span>
            <input type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} />
          </label>
          <label className="field">
            <span>코스 메모 <i>(선택)</i></span>
            <textarea value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="코스를 빠져나가는 이유, 준비물, 이동 수단 등을 적어두세요." rows={3} />
          </label>
          {pending && <p className="picker-hint">코스를 만든 뒤 저장한 매물을 담으면 방문 순서와 지도 경로가 그려집니다.</p>}
          {error && <p className="error-copy" role="alert">{error}</p>}
          <button className="primary-button" disabled={isPending || !title.trim()} onClick={save}>
            {isPending ? "저장 중…" : pending ? "코스 만들기" : "저장하기"}
          </button>
        </div>
      </section>
    </div>
  );
}

function StopsPickerModal({ courseId, orderedIds, properties, onClose, onSaved }: {
  courseId: number;
  orderedIds: number[];
  properties: Property[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [ordered, setOrdered] = useState<number[]>(orderedIds);
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => api.setCourseStops({ courseId, propertyIds: ordered }),
    onSuccess: (result) => {
      if (result.ok) onSaved();
      else setError(result.message ?? "저장하지 못했습니다.");
    },
    onError: () => setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요."),
  });
  const propertyById = new Map(properties.map((property) => [property.id, property]));
  const available = properties.filter((property) => !ordered.includes(property.id));
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    const next = [...ordered];
    const current = next[index];
    const other = next[target];
    if (current === undefined || other === undefined) return;
    next[index] = other;
    next[target] = current;
    setOrdered(next);
  };
  const add = (id: number) => { if (!ordered.includes(id)) setOrdered((prev) => [...prev, id]); };
  const removeAt = (index: number) => setOrdered((prev) => prev.filter((_, position) => position !== index));

  return (
    <div className="modal-backdrop">
      <section className="form-sheet wide" role="dialog" aria-modal="true" aria-label="방문 순서 정리">
        <header className="sheet-header">
          <h2>매물 추가·정리</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}><Icon name="back" /></button>
        </header>
        <div className="sheet-body">
          <section aria-label="방문 순서">
            <h3 className="picker-title">방문 순서 · {ordered.length}곳</h3>
            {ordered.length === 0 ? (
              <p className="empty-copy">아직 담긴 매물이 없습니다. 아래 목록에서 추가하세요.</p>
            ) : (
              <ol className="picker-ordered">
                {ordered.map((id, index) => {
                  const property = propertyById.get(id);
                  if (!property) return null;
                  return (
                    <li key={id}>
                      <span className="picker-number">{index + 1}</span>
                      <div className="picker-copy">
                        <strong>{property.name}</strong>
                        <small>{property.address}</small>
                      </div>
                      <div className="picker-movers">
                        <button className="icon-button stop-mover" aria-label={`${property.name} 순서 올리기`} disabled={index === 0} onClick={() => move(index, -1)}><Icon name="up" size={15} /></button>
                        <button className="icon-button stop-mover" aria-label={`${property.name} 순서 내리기`} disabled={index === ordered.length - 1} onClick={() => move(index, 1)}><Icon name="down" size={15} /></button>
                        <button className="icon-button stop-mover danger-icon" aria-label={`${property.name} 제외하기`} onClick={() => removeAt(index)}><Icon name="trash" size={15} /></button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          <section aria-label="추가할 매물">
            <h3 className="picker-title">추가할 매물</h3>
            {available.length === 0 ? (
              <p className="empty-copy">{properties.length === 0 ? "등록된 매물이 없습니다. 현장 보드에서 먼저 매물을 등록해 주세요." : "추가할 수 있는 매물을 모두 담았습니다."}</p>
            ) : (
              <ul className="picker-available">
                {available.map((property) => (
                  <li key={property.id}>
                    <div className="picker-copy">
                      <strong>{property.name}</strong>
                      <small>{property.address}</small>
                    </div>
                    <button className="icon-button stop-mover" aria-label={`${property.name} 담기`} onClick={() => add(property.id)}><Icon name="plus" size={16} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {error && <p className="error-copy" role="alert">{error}</p>}
          <div className="picker-footer">
            <button className="secondary-button" onClick={onClose}>취소</button>
            <button className="primary-button" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "저장 중…" : "저장하기"}
            </button>
          </div>
          <p className="course-assumption">순서를 저장하면 코스 지도의 점선 경로와 구간별 도보시간이 갱신됩니다.</p>
        </div>
      </section>
    </div>
  );
}
