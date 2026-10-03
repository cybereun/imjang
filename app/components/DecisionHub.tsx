"use client";
// 의사결정 허브: 재임장 검증 플랜·임장 리포트·수동 가격 추적·매수 시뮬레이터. 원본 App.tsx의 DecisionHub 일대.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api-client";
import {
  CHECKLIST_GROUPS,
  formatDuration,
  Icon,
  listingDongHo,
  listingPriceText,
  LISTING_STATUS_LABEL,
  money,
  pyeong,
  TRADE_TYPE_LABEL,
  type Property,
  type VoiceMemo,
} from "./shared";
import { voiceLinkedLabel } from "./VoiceMemo";

export type DecisionSupport = ApiResponse<typeof api, "getDecisionSupport">;
export type DecisionSection = "revisit" | "report" | "price" | "finance";

export function calculateFinance(values: { purchasePriceMan: number; ownFundsMan: number; annualIncomeMan: number; otherAnnualDebtMan: number; loanRatePct: number; loanYears: number; ltvPct: number; acquisitionTaxPct: number; brokeragePct: number }) {
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

export function DecisionHub({ onBack, onOpenProperty }: { onBack: () => void; onOpenProperty: (id: number) => void }) {
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

export function RevisitRow({ task, pending, onSave, reasonLabel }: { task: DecisionSupport["revisitTasks"][number]; pending: boolean; onSave: (completed: boolean, note: string) => void; reasonLabel: string }) {
  const [note, setNote] = useState(task.note);
  useEffect(() => setNote(task.note), [task.note]);
  return <div className={`revisit-row ${task.completed ? "done" : ""}`}><button aria-label={`${task.label} ${task.completed ? "미완료로 변경" : "완료"}`} disabled={pending} onClick={() => onSave(!task.completed, note)}><span><Icon name="check" size={15} /></span></button><div><strong>{task.label}</strong><small>{reasonLabel}</small><input aria-label={`${task.label} 재임장 메모`} value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => onSave(task.completed, note)} placeholder="다음 방문에서 확인할 기준" /></div></div>;
}

