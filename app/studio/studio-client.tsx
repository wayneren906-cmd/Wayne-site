"use client";

import { useEffect, useState, useRef, type ReactElement } from "react";
import {receiptSchema} from '../../lib/ui/studio-protocol.ts';
import type { LearningEventDTO, SaveReceiptDTO } from "@/lib/learning/contracts";
import StudioOverview, { type StudioOverviewProps } from "./studio-overview";
import StudioEventList from "./studio-event-list";
import StudioEventDetail from "./studio-event-detail";
import StudioSupplementForm from "./studio-supplement-form";
import {useUnsavedChanges} from '../../lib/ui/use-unsaved-changes.ts';

export type StudioDataAdapter = {
  loadSnapshot?: () => Promise<{overview:StudioOverviewProps;events:readonly LearningEventDTO[]}>;
  loadOverview: () => Promise<StudioOverviewProps>;
  loadEvents: () => Promise<readonly LearningEventDTO[]>;
  submitSupplement: (
    text: string,
    options?: { idempotencyKey: string }
  ) => Promise<SaveReceiptDTO>;
};

export type StudioClientProps = {
  showSupplement?: boolean;
  readOnly?: boolean;
  adapter?: StudioDataAdapter;
  initialOverview?: StudioOverviewProps;
  initialEvents?: readonly LearningEventDTO[];
};

const defaultOverview: StudioOverviewProps = {
  currentFocus: null,
  notice: null,
  connectionState: "not_connected",
  lastContentUpdatedAt: null,
  supplementHref: "#supplement",
  loading: false,
};

export default function StudioClient({
  showSupplement = true,
  readOnly = false,
  adapter,
  initialOverview,
  initialEvents = [],
}: StudioClientProps): ReactElement {
  const [overview, setOverview] = useState<StudioOverviewProps>(
    initialOverview ?? defaultOverview
  );
  const [events, setEvents] = useState<readonly LearningEventDTO[]>(initialEvents);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [loadingEvents, setLoadingEvents] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [supplementText, setSupplementText] = useState<string>("");
  const [supplementState, setSupplementState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [supplementError, setSupplementError] = useState<string | null>(null);
  useUnsavedChanges(!!supplementText.trim());

  // 容器层幂等保护：记录用于重试的幂等键与锁定的草稿载荷


  const submitting=useRef(false);
  const retry=useRef<{key:string;text:string}|null>(null);
  const generation=useRef(0);
  const detail=useRef<HTMLDivElement>(null);
  const selectedButton=useRef<HTMLElement|null>(null);
  function closeDetail() {setSelectedEventId(null);selectedButton.current?.focus();}

  async function refresh() {
    if(readOnly||!adapter) return;
    const version=++generation.current;
    setLoadingEvents(true);setEventsError(null);
    setOverview(prev=>({...prev,loading:true}));
    try {
      const snapshot=adapter.loadSnapshot?await adapter.loadSnapshot():await Promise.all([adapter.loadOverview(),adapter.loadEvents()]).then(([overview,events])=>({overview,events}));
      if(version!==generation.current)return;
      setOverview(snapshot.overview);setEvents(snapshot.events);
      setSelectedEventId(prev=>snapshot.events.some(e=>e.event_id===prev)?prev:null);
    } catch(error) {
      if(version!==generation.current)return;
      const message=error instanceof Error?error.message:'读取失败，请重试。';
      setEventsError(message);setEvents([]);setSelectedEventId(null);
      setOverview(prev=>({...prev,loading:false,connectionState:'temporarily_unavailable',lastContentUpdatedAt:null,
        notice:{kind:'action_required',text:message}}));
    } finally {if(version===generation.current)setLoadingEvents(false);}
  }

  useEffect(() => {
    if (adapter&&!readOnly) {
      refresh();
    }
    return ()=>{generation.current++;};
  }, [adapter,readOnly]);

  useEffect(()=>{if(selectedEventId)detail.current?.focus();},[selectedEventId]);

  function handleDraftChange(val: string) {
    if(submitting.current)return;
    setSupplementText(val);
    if(retry.current && val.trim()!==retry.current.text)retry.current=null;

    // 载荷一旦修改，废弃之前的重试幂等键，确保不会改载荷后沿用旧键

    if (supplementState === "saved" || supplementState === "error") {
      setSupplementState("idle");
    }
  }

  async function handleSupplementSubmit(text: string) {
    const trimmed = text.trim();
    if (readOnly || !trimmed || submitting.current) return;
    if(trimmed.length>2000){setSupplementState('error');setSupplementError('记录内容最多 2000 字，请缩短后提交。');return;}

    if (!adapter) {
      setSupplementState("error");
      setSupplementError("未接入数据适配器，无法保存记录。");
      return;
    }

    // 幂等键防改载荷：
    // 若这是失败后的重试且文本内容未改动，继续沿用上一次生成的 activeIdempotencyKey；
    // 否则生成全新的幂等键，并锁定载荷内容。
    submitting.current=true;
    let keyToUse = retry.current?.text===trimmed?retry.current.key:null;
    if (!keyToUse) {
      keyToUse = `suppl-${crypto.randomUUID()}`;
      retry.current={key:keyToUse,text:trimmed};
    }

    setSupplementState("saving");
    setSupplementError(null);

    try {
      const receipt = await adapter.submitSupplement(trimmed, { idempotencyKey: keyToUse });

      // 强校验：成功状态必须依据可信保存回执，缺失/错误回执不显示已保存
      if (!receiptSchema.safeParse(receipt).success) {
        throw new Error("服务端未返回有效的持久化保存回执。");
      }

      // 保存成功后：重置键和载荷锁，清空输入
      retry.current=null;
      setSupplementState("saved");
      setSupplementText("");

      // 自动刷新事件列表和概览状态
      await refresh();
    } catch (err) {
      // 失败时保留草稿文本与现存幂等键，便于用户重试
      setSupplementState("error");
      setSupplementError(err instanceof Error ? err.message : "保存补充记录失败。");
    } finally {submitting.current=false;}
  }

  const selectedEvent = events.find((e) => e.event_id === selectedEventId) ?? null;

  return (
    <div className={`studio-client${showSupplement?'':' studio-client--records'}`} aria-label="学习操作台主界面">
      <div className="studio-client__top">
        <StudioOverview {...overview} supplementHref={showSupplement?overview.supplementHref:'/studio/private/workspace'} />
      </div>

      <div className="studio-client__body">
        <div className="studio-client__events-section">
          <StudioEventList
            events={events}
            selectedEventId={selectedEventId}
            loading={loadingEvents}
            errorMessage={eventsError}
            onSelect={(id) => {selectedButton.current=document.activeElement as HTMLElement;setSelectedEventId(id);}}
            onRetry={refresh}
          />

          {selectedEvent && (
            <div ref={detail} tabIndex={-1} className="studio-client__detail-overlay" onKeyDown={e=>{if(e.key==='Escape')closeDetail();}}>
              <StudioEventDetail
                event={selectedEvent}
                onClose={closeDetail}
              />
            </div>
          )}
        </div>

        {showSupplement&&<div className="studio-client__aside" id="supplement">
          <StudioSupplementForm
            readOnly={readOnly}
            text={supplementText}
            state={supplementState}
            errorMessage={supplementError}
            onChange={handleDraftChange}
            onSubmit={handleSupplementSubmit}
          />
        </div>}
      </div>
    </div>
  );
}
