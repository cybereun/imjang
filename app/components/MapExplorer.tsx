"use client";
// 지도 탐색기: 저장 매물·국토부 실거래·전월세·내 주변 반경 라벨. 원본 App.tsx의 MapExplorer 일대.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { divIcon, type LatLngBoundsExpression } from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api, type ApiResponse } from "@/lib/api-client";
import {
  defaultMapCenter,
  escapeHtml,
  formatUpdated,
  Icon,
  money,
  pyeong,
  useVworldTileUrl,
  VWORLD_ATTRIBUTION,
  type AreaCandidate,
  type GeocodeCandidate,
  type Property,
} from "./shared";

export function MapViewport({ bounds, center, zoom }: { bounds: LatLngBoundsExpression | null; center: [number, number]; zoom: number }) {
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

export function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonthValue() {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return monthValue(date);
}

export function currentMonthValue() {
  return monthValue(new Date());
}

export type MapMode = "saved" | "official" | "rent" | "nearby";
export type OfficialTransaction = ApiResponse<typeof api, "searchOfficialTransactions">["transactions"][number];
export type OfficialRentTransaction = ApiResponse<typeof api, "searchOfficialRentTransactions">["transactions"][number];

export function rentSummary(tx: OfficialRentTransaction): { kind: "전세" | "월세"; price: string; sub: string | null } {
  if (tx.monthlyRentMan === 0) {
    return { kind: "전세", price: `${money(tx.depositMan)}원`, sub: null };
  }
  return { kind: "월세", price: `${money(tx.depositMan)}원 / ${money(tx.monthlyRentMan)}원`, sub: contractTermLabel(tx.contractTerm) };
}

export function contractTermLabel(term: string | null): string | null {
  if (!term) return null;
  const digits = term.replace(/\D/g, "");
  return digits ? `계약 ${digits}개월` : term;
}

export function MapExplorer({ properties, apiKey, onBack, onOpenSettings, onAdd, onSelect }: { properties: Property[]; apiKey: string; onBack: () => void; onOpenSettings: () => void; onAdd: () => void; onSelect: (id: number) => void }) {
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
      // 가져온 뒤에도 지도 검색 결과를 유지해 여러 거래를 이어서 가져올 수 있게 한다.
      // 상세 보기로 이동은 시트의 "보드에서 열기" 버튼에서만 수행한다.
      if (result.ok && result.id) {
        void queryClient.invalidateQueries({ queryKey: ["properties"] });
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
        {mode === "official" && mappableTrades.map((transaction) => <Marker key={transaction.id} position={[transaction.latitude, transaction.longitude]} icon={divIcon({ className: "property-map-marker official", html: `<span>${pyeong(transaction.areaSqm).toFixed(0)}평</span>`, iconSize: [48, 31], iconAnchor: [24, 31], popupAnchor: [0, -28] })}><Popup><div className="map-popup"><strong>{transaction.apartmentName}</strong><span>{transaction.roadAddress ?? `${transaction.legalDong} ${transaction.jibun ?? ""}`}</span><b>{pyeong(transaction.areaSqm).toFixed(1)}평 · {money(transaction.dealAmountMan)}</b><button onClick={() => { importTrade.reset(); setSelectedTrade(transaction); }}>거래 상세 보기</button></div></Popup></Marker>)}
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
        : mode === "official" ? (visibleTrades.length === 0 ? <p className="empty-copy">지역과 계약년월을 선택한 뒤 실거래 조회를 눌러주세요.</p> : visibleTrades.map((transaction) => <button key={transaction.id} onClick={() => { importTrade.reset(); setSelectedTrade(transaction); }}><span className="result-pin official"><Icon name="pin" size={16} /></span><span><strong>{transaction.apartmentName}</strong><small>{transaction.dealYmd} · {transaction.legalDong}{transaction.floor === null ? "" : ` · ${transaction.floor}층`}</small></span><span><b>{pyeong(transaction.areaSqm).toFixed(1)}평</b><small>{money(transaction.dealAmountMan)}</small></span></button>))
        : (visibleRents.length === 0 ? <p className="empty-copy">지역과 계약년월을 선택한 뒤 전월세 조회를 눌러주세요.</p> : visibleRents.map((transaction) => <button key={transaction.id} onClick={() => setSelectedRent(transaction)}><span className="result-pin rent"><Icon name="pin" size={16} /></span><span><strong><i className={`trade-kind ${rentSummary(transaction).kind === "전세" ? "jeonse" : "wolse"}`}>{rentSummary(transaction).kind}</i>{transaction.apartmentName}</strong><small>{transaction.dealYmd} · {transaction.legalDong}{transaction.floor === null ? "" : ` · ${transaction.floor}층`}</small></span><span><b>{pyeong(transaction.areaSqm).toFixed(1)}평</b><small>{rentSummary(transaction).price}</small></span></button>))}
    </section>

    {selectedTrade && <div className="modal-backdrop" role="presentation"><section className="trade-sheet" role="dialog" aria-modal="true" aria-labelledby="trade-title"><div className="form-head"><div><p className="eyebrow">국토교통부 신고 거래</p><h2 id="trade-title">{selectedTrade.apartmentName}</h2></div><button className="close-button" aria-label="실거래 상세 닫기" onClick={() => { setSelectedTrade(null); importTrade.reset(); }}>닫기</button></div><dl className="trade-facts"><div><dt>계약일</dt><dd>{selectedTrade.dealYmd}</dd></div><div><dt>거래금액</dt><dd>{money(selectedTrade.dealAmountMan)}</dd></div><div><dt>전용면적</dt><dd>{selectedTrade.areaSqm.toFixed(2)}㎡ · {pyeong(selectedTrade.areaSqm).toFixed(1)}평</dd></div><div><dt>층</dt><dd>{selectedTrade.floor === null ? "정보 없음" : `${selectedTrade.floor}층`}</dd></div><div><dt>건축년도</dt><dd>{selectedTrade.buildYear ?? "정보 없음"}</dd></div><div><dt>거래유형</dt><dd>{selectedTrade.dealingType ?? "정보 없음"}</dd></div><div><dt>등기일자</dt><dd>{selectedTrade.registrationDate || "정보 없음"}</dd></div><div><dt>거래주체</dt><dd>{selectedTrade.sellerType || selectedTrade.buyerType ? `매도 ${selectedTrade.sellerType ?? "-"} · 매수 ${selectedTrade.buyerType ?? "-"}` : "정보 없음"}</dd></div><div><dt>중개사 소재지</dt><dd>{selectedTrade.estateAgentDistrict || "정보 없음"}</dd></div><div><dt>동</dt><dd>{selectedTrade.apartmentDong || "정보 없음"}</dd></div></dl><p className="trade-response-note">{selectedTrade.apiVariant === "detail" ? "상세 API 응답" : "기본 API 폴백 응답 · 신규 상세 항목은 제공되지 않을 수 있습니다."}</p><p className="trade-address"><Icon name="pin" size={17} />{selectedTrade.roadAddress ?? `${selectedTrade.regionLabel} ${selectedTrade.legalDong} ${selectedTrade.jibun ?? ""}`}</p>{importTrade.data?.message && <p className="error-copy">{importTrade.data.message}</p>}{importTrade.data?.ok && importTrade.data.id ? (<><p className="trade-response-note">임장자료로 가져왔습니다. 검색 결과는 그대로 두었으니 다른 거래도 이어서 가져올 수 있습니다.</p><div className="trade-actions"><button className="secondary-button" onClick={() => { setSelectedTrade(null); importTrade.reset(); }}>계속 찾기</button><button className="primary-button" onClick={() => { const id = importTrade.data?.id; if (id) onSelect(id); }}>보드에서 열기</button></div></>) : (<div className="trade-actions"><a className="secondary-button" href={official.data?.sourceUrl ?? "https://www.data.go.kr/data/15126469/openapi.do"} target="_blank" rel="noreferrer">공식 출처</a><button className="primary-button" disabled={importTrade.isPending} onClick={() => importTrade.mutate(selectedTrade.id)}>{importTrade.isPending ? "가져오는 중…" : "임장자료로 가져오기"}</button></div>)}</section></div>}

    {selectedRent && <div className="modal-backdrop" role="presentation"><section className="trade-sheet" role="dialog" aria-modal="true" aria-labelledby="rent-title"><div className="form-head"><div><p className="eyebrow">국토교통부 {rentSummary(selectedRent).kind} 신고 거래</p><h2 id="rent-title">{selectedRent.apartmentName}</h2></div><button className="close-button" aria-label="전월세 거래 상세 닫기" onClick={() => setSelectedRent(null)}>닫기</button></div><dl className="trade-facts"><div><dt>계약일</dt><dd>{selectedRent.dealYmd}</dd></div><div><dt>거래유형</dt><dd>{rentSummary(selectedRent).kind}</dd></div><div><dt>보증금</dt><dd>{money(selectedRent.depositMan)}원</dd></div><div><dt>월세</dt><dd>{selectedRent.monthlyRentMan === 0 ? "없음 (전세)" : `${money(selectedRent.monthlyRentMan)}원`}</dd></div><div><dt>전용면적</dt><dd>{selectedRent.areaSqm.toFixed(2)}㎡ · {pyeong(selectedRent.areaSqm).toFixed(1)}평</dd></div><div><dt>층</dt><dd>{selectedRent.floor === null ? "정보 없음" : `${selectedRent.floor}층`}</dd></div><div><dt>계약기간</dt><dd>{selectedRent.contractTerm ?? "정보 없음"}</dd></div><div><dt>건축년도</dt><dd>{selectedRent.buildYear ?? "정보 없음"}</dd></div><div><dt>중개사 소재지</dt><dd>{selectedRent.estateAgentDistrict || "정보 없음"}</dd></div></dl><p className="trade-response-note">신고·확정일자 자료 기준. 개인정보 보호를 위해 동·호 등 개별 세대 식별 정보는 제공되지 않습니다.</p><p className="trade-address"><Icon name="pin" size={17} />{selectedRent.roadAddress ?? `${selectedRent.regionLabel} ${selectedRent.legalDong} ${selectedRent.jibun ?? ""}`}</p><div className="trade-actions"><a className="secondary-button" href={rentSearch.data?.sourceUrl ?? "https://www.data.go.kr/data/15126474/openapi.do"} target="_blank" rel="noreferrer">공식 출처</a></div></section></div>}
  </main>;
}

