"use client";
// 매물 상세 워크스페이스: 대시보드·현장 기록(체크리스트·사진)·자료실·매물 단위 기록 탭. 원본 App.tsx의 PropertyWorkspace 일대.
import { useState, type ChangeEvent, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fileToBase64, type ApiResponse } from "@/lib/api-client";
import {
  CHECKLIST_GROUPS,
  formatUpdated,
  Icon,
  listingDongHo,
  money,
  pyeong,
  type Detail,
  type Lens,
  type ListingSummary,
  type Property,
  type Tab,
} from "./shared";
import { ListingRecordsTab } from "./Listings";
import { VoiceMemoRow, VoiceRecorder, voiceLinkedLabel } from "./VoiceMemo";

export function PropertyWorkspace({ detail, tab, lens, onTab, onLens, onBack, onEdit }: { detail: Detail; tab: Tab; lens: Lens; onTab: (tab: Tab) => void; onLens: (lens: Lens) => void; onBack: () => void; onEdit: () => void }) {
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

export function RentMarketContext({ property }: { property: Property }) {
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

export function Dashboard({ property, gap, yieldRate, lens, onLens, checkedCount, totalCount, nearby }: { property: Property; gap: number | null; yieldRate: number | null; lens: Lens; onLens: (lens: Lens) => void; checkedCount: number; totalCount: number; nearby: Detail["nearby"] }) {
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

export function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{sub}</small></div>;
}

export function NavigationPanel({ property }: { property: Property }) {
  const encodedName = encodeURIComponent(property.name);
  const naverQuery = encodeURIComponent(`${property.name} ${property.address}`.trim());
  const lat = property.latitude;
  const lng = property.longitude;
  const kakao = `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`;
  const naver = `https://map.naver.com/p/search/${naverQuery}`;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  return <aside className="route-panel"><div className="route-icon"><Icon name="route" size={28} /></div><p className="eyebrow">바로 출발</p><h2>목적지 전송</h2><p>출발지는 지도 앱에서 현재 위치로 설정합니다.</p><div className="route-buttons"><a className="primary-button" href={kakao} target="_blank" rel="noreferrer">카카오맵으로 길찾기</a><a className="secondary-button" href={naver} target="_blank" rel="noreferrer">네이버지도에서 찾기</a><a className="ghost-link" href={google} target="_blank" rel="noreferrer">Google 지도에서 열기</a></div></aside>;
}

export function FieldNotes({ property, detail, listings }: { property: Property; detail: Detail; listings: ListingSummary[] }) {
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

export function SourceDesk({ property, references }: { property: Property; references: Detail["references"] }) {
  const queryClient = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => api.refreshReferences({ propertyId: property.id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["property", property.id] }),
  });
  const newest = references[0]?.fetchedAt;
  return <div className="sources-page">
    <section className="source-intro"><div><p className="eyebrow">외부 참고자료</p><h2>가격·입지 근거 찾기</h2><p>주소 기준 검색 결과를 그대로 보여드립니다. 가격 숫자는 계약 조건과 시점을 원문에서 다시 확인하세요.</p></div><button className="primary-button" onClick={() => refresh.mutate()} disabled={refresh.isPending}><Icon name="refresh" />{refresh.isPending ? "찾는 중…" : "자료 새로 찾기"}</button></section>
    {refresh.data?.message && <p className="notice">{refresh.data.message}</p>}
    {refresh.error && <p className="error-copy">자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>}
    {newest && <p className="fetched-time">최근 검색 {formatUpdated(newest)}</p>}
    {references.length === 0 && !refresh.isPending ? <div className="reference-empty"><Icon name="search" size={30} /><h3>아직 불러온 자료가 없습니다</h3><p>검색을 실행하면 실거래·시세와 주변 시설 관련 출처를 나눠 보여드립니다.</p></div> : <div className="reference-columns"><ReferenceColumn title="가격 자료" items={references.filter((item) => item.kind === "price")} /><ReferenceColumn title="입지 자료" items={references.filter((item) => item.kind === "location")} /></div>}
  </div>;
}

export function ReferenceColumn({ title, items }: { title: string; items: Detail["references"] }) {
  return <section className="reference-column"><h3>{title}</h3>{items.length === 0 ? <p className="empty-copy">확인 가능한 자료가 없습니다.</p> : items.map((item) => <a className="reference-card" href={item.url} target="_blank" rel="noreferrer" key={item.id}><span className="source-domain">{item.source ?? "출처 보기"}{item.publishedAt ? ` · ${item.publishedAt}` : ""}</span><strong>{item.title}</strong>{item.snippet && <p>{item.snippet.replace(/Last Updated:[^\n]*\n?/gi, "").replace(/Last Crawl:[^\n]*\n?/gi, "").slice(0, 220)}</p>}<span className="open-source">원문 열기 ↗</span></a>)}</section>;
}

