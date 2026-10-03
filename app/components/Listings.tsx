"use client";
// 매물 단위 기록: 중개업소·동호수·거래유형·호가 이력·목표가·협상 메모. 원본 App.tsx의 ListingRecordsTab 일대 + PropertyForm.
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api-client";
import {
  Icon,
  listingDongHo,
  listingPriceText,
  LISTING_STATUS_LABEL,
  LISTING_STATUS_ORDER,
  money,
  pyeong,
  TRADE_TYPE_LABEL,
  type GeocodeCandidate,
  type ListingDetailData,
  type ListingStatus,
  type ListingSummary,
  type Property,
  type TradeType,
} from "./shared";
import { VoiceMemoRow, VoiceRecorder } from "./VoiceMemo";

export function ListingRecordsTab({ property, listings, isPending }: { property: Property; listings: ListingSummary[]; isPending: boolean }) {
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

export function ListingCard({ listing, onOpen, onEdit }: { listing: ListingSummary; onOpen: () => void; onEdit: () => void }) {
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

export function ListingFormModal({ propertyId, defaultAreaSqm, existing, onClose, onSaved }: {
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

export function ListingDetailModal({ property, listingId, onClose, onEdit }: {
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

export function PropertyForm({ existing, onClose, onSaved }: { existing: Property | null; onClose: () => void; onSaved: (id: number) => void }) {
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

