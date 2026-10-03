"use client";
// 앱 셸: 전역 상태·뷰 라우팅·설정 화면. 원본 App.tsx의 App/ServerKeyCard/SettingsView/VworldKeyCard/EmptyState.
// 지도 컴포넌트(MapExplorer·CourseView)는 Leaflet의 window 의존성 때문에 next/dynamic(ssr: false)으로 로드한다.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  API_KEY_STORAGE_KEY,
  Icon,
  money,
  pyeong,
  readSavedApiKey,
  SafeAreaTopScrim,
  VWORLD_TILE_BASE,
  type AppView,
  type Lens,
  type Property,
  type Tab,
} from "./shared";
import { WELCOME_IMAGE } from "./welcomeImage";
import { ComparisonView } from "./CompareBoard";
import { DecisionHub } from "./DecisionHub";
import { PropertyWorkspace } from "./PropertyDetail";
import { PropertyForm } from "./Listings";
import { PriceTrackingView } from "./Watchlist";

export const MapExplorer = dynamic(() => import("./MapExplorer").then((m) => m.MapExplorer), { ssr: false });
export const CourseView = dynamic(() => import("./Courses").then((m) => m.CourseView), { ssr: false });

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

  useEffect(() => {
    if (!list.data) return;
    if (selectedId !== null && !list.data.properties.some((item) => item.id === selectedId)) {
      setSelectedId(null);
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
              properties.length === 0 ? (
                <div className="desktop-empty"><WelcomeHero onAdd={openNewProperty} onMap={() => setView("map")} /></div>
              ) : (
                <div className="desktop-empty"><div className="pin-orbit"><Icon name="pin" size={34} /></div><h2>매물을 선택하세요</h2><p>왼쪽 목록에서 매물을 누르면 현장 기록과 판단판이 여기에 표시됩니다.</p><div className="empty-actions"><button className="secondary-button" onClick={() => setView("map")}><Icon name="pin" /> 지도에서 찾기</button><button className="primary-button" onClick={openNewProperty}><Icon name="plus" /> 매물 등록</button></div></div>
              )
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

export function ServerKeyCard() {
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

export function SettingsView({ apiKey, onApiKeyChange, onBack }: { apiKey: string; onApiKeyChange: (value: string) => void; onBack: () => void }) {
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

export function VworldKeyCard() {
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

export function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><img className="welcome-hero-media" src={WELCOME_IMAGE} alt="아파트 임장 웰컴 일러스트" /><h2>현장 판단은 주소부터</h2><p>아직 등록된 매물이 없습니다. 첫 주소를 찾고 조사 노트를 시작해 보세요.</p><button className="primary-button" onClick={onAdd}><Icon name="plus" /> 첫 매물 등록</button></div>;
}

export function WelcomeHero({ onAdd, onMap }: { onAdd: () => void; onMap: () => void }) {
  return <div className="welcome-hero"><img className="welcome-hero-media" src={WELCOME_IMAGE} alt="아파트 임장 웰컴 일러스트" /><div className="welcome-hero-actions"><button className="secondary-button" onClick={onMap}><Icon name="pin" /> 지도에서 찾기</button><button className="primary-button" onClick={onAdd}><Icon name="plus" /> 매물 등록</button></div></div>;
}

