"use client";
// 음성 녹음 메모: 브라우저 MediaRecorder 녹음·저장·재생·제목 수정. 원본 App.tsx의 VoiceRecorder 일대.
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, fileToBase64 } from "@/lib/api-client";
import {
  CHECKLIST_GROUPS,
  CHECKLIST_LABELS,
  formatDuration,
  formatUpdated,
  Icon,
  type VoiceMemo,
} from "./shared";


export const VOICE_MAX_RECORD_SECONDS = 10 * 60;
export const VOICE_MIME_TYPES = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"] as const;
export type VoiceMimeType = (typeof VOICE_MIME_TYPES)[number];

export const VOICE_RECORDER_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg", "audio/wav"];

export function normalizeVoiceMimeType(raw: string): VoiceMimeType | null {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return (VOICE_MIME_TYPES as ReadonlyArray<string>).includes(base) ? (base as VoiceMimeType) : null;
}

export function formatElapsed(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export type PendingVoice = { blob: Blob; blobUrl: string; mimeType: VoiceMimeType; durationSec: number };

export function VoiceRecorder({ propertyId, listingId = null, showChecklistLink = false, onSaved }: {
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

export function VoiceMemoRow({ memo, displayIndex, linkedLabel, onChanged }: {
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

export function voiceLinkedLabel(memo: VoiceMemo, listingLabel: (listingId: number) => string | null): string | null {
  if (memo.checklistItemKey) {
    const label = CHECKLIST_LABELS.get(memo.checklistItemKey);
    return label ? `체크리스트 · ${label}` : "체크리스트";
  }
  if (memo.listingId) return listingLabel(memo.listingId);
  return null;
}

