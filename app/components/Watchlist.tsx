"use client";
// 관심 단지 시세 트래킹: 관심 단지 등록·실거래 시세 차트·알림 규칙·알림함·직접 호가 기록. 원본 App.tsx의 PriceTrackingView 일대.
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { api, type ApiResponse } from "@/lib/api-client";
import {
  formatUpdated,
  Icon,
  money,
  pyeong,
  type AlertType,
  type PriceAlertItem,
  type WatchDetailData,
  type WatchListItem,
} from "./shared";

// ---------------- 관심 단지 시세 트래킹 ----------------

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  price_drop: "가격 하락",
  target_reached: "목표가 도달",
  bargain: "급매 후보",
};

export const RUN_STATUS_LABELS: Record<"ok" | "needs_key" | "rate_limited" | "error" | "skipped", string> = {
  ok: "확인 완료",
  needs_key: "인증키 필요",
  rate_limited: "호출 한도 초과",
  error: "오류",
  skipped: "건너뜀",
};

export type AlertSummary = Pick<PriceAlertItem, "id" | "type" | "title" | "detail" | "month" | "triggerValueMan" | "baselineValueMan" | "changePct" | "sourceUrl" | "createdAt" | "readAt">;

export function monthSequence(from: string, to: string): string[] {
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

export type ChartPoint = { month: string; label: string; avg: number | null; min: number | null; max: number | null; trades: number; ask: number | null };

export function buildChartPoints(series: WatchDetailData["series"], asks: WatchDetailData["askRecords"]): ChartPoint[] {
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
  const sorted = Array.from(monthSet).sort();
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

export function WatchChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: ChartPoint }>; label?: string }) {
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

export function WatchChart({ series, asks }: { series: WatchDetailData["series"]; asks: WatchDetailData["askRecords"] }) {
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

export type RentChartPoint = { month: string; label: string; jeonse: number | null; wolseMonthly: number | null; jeonseTrades: number; wolseTrades: number };

export function buildRentChartPoints(rentSeries: WatchDetailData["rentSeries"]): RentChartPoint[] {
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

export function WatchRentChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload: RentChartPoint }>; label?: string }) {
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

export function WatchRentChart({ rentSeries }: { rentSeries: WatchDetailData["rentSeries"] }) {
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

export type JeonseRow = { month: string; sale: number; saleCount: number; jeonse: number; jeonseCount: number };

export function JeonseRatioTable({ series, rentSeries }: { series: WatchDetailData["series"]; rentSeries: WatchDetailData["rentSeries"] }) {
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

export function PriceTrackingView({ apiKey, onBack }: { apiKey: string; onBack: () => void }) {
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

export function WatchRow({ item, selected, onOpen }: { item: WatchListItem; selected: boolean; onOpen: () => void }) {
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

export function WatchDetailPanel({ watch, apiKey, onClose, onEdit, onChanged, onOpenAlerts }: { watch: WatchListItem; apiKey: string; onClose: () => void; onEdit: () => void; onChanged: () => void; onOpenAlerts: () => void }) {
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

export function AlertItemRow({ alert }: { alert: AlertSummary }) {
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

export function AlertInbox({ onOpenWatch }: { onOpenWatch: (watchId: number) => void }) {
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

export function WatchFormModal({ existing, onClose, onDeleted, onSaved }: { existing: WatchListItem | null; onClose: () => void; onDeleted: () => void; onSaved: (id: number) => void }) {
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
