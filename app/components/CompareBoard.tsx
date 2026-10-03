"use client";
// 비교 보드: 최대 3개 후보 나란히 비교·비교 메모·가치평가·최종 선정. 원본 App.tsx의 ComparisonView/ComparisonCard.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api-client";
import { Icon, money, pyeong, type Property } from "./shared";

export type ComparisonItem = ApiResponse<typeof api, "getComparisonBoard">["items"][number];

export function ComparisonView({ properties, onBack, onOpenProperty, onOpenDecision, onOpenCourse }: { properties: Property[]; onBack: () => void; onOpenProperty: (id: number) => void; onOpenDecision: () => void; onOpenCourse: (id: number) => void }) {
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

export function ComparisonCard({ item, onOpen, onFinal, finalPending }: { item: ComparisonItem; onOpen: () => void; onFinal: () => void; finalPending: boolean }) {
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

