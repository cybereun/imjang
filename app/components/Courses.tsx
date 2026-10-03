"use client";
// 임장 코스·동선: 코스 생성·정류장 순서·지도 경로·도보 시간·카카오맵 길찾기 연결. 원본 App.tsx의 CourseView 일대.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { divIcon, type LatLngBoundsExpression } from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "@/lib/api-client";
import {
  defaultMapCenter,
  formatDistance,
  formatVisitDate,
  formatWalkMinutes,
  Icon,
  useVworldTileUrl,
  VWORLD_ATTRIBUTION,
  type Property,
  type TourCourseDetailData,
  type TourCourseListItem,
  type TourCourseStop,
} from "./shared";
import { MapViewport } from "./MapExplorer";

// ---------------- 임장 코스·동선 ----------------

export const defaultCourseTitle = () => {
  const now = new Date();
  return `임장 코스 · ${now.getMonth() + 1}월 ${now.getDate()}일`;
};

export function CourseCardRow({ item, onOpen }: { item: TourCourseListItem; onOpen: () => void }) {
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

export function CourseView({ initialSelectedId, properties, onBack, onOpenProperty }: {
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

export function CourseDetailView({ courseId, properties, onBack, onDeleted, onOpenProperty }: {
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

export function CourseStopRow({ stop, index, isFirst, isLast, pending, onSave, onMove, onRemove, onOpen }: {
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

export function CourseFormModal({ existing, onClose, onSaved }: {
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

export function StopsPickerModal({ courseId, orderedIds, properties, onClose, onSaved }: {
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

