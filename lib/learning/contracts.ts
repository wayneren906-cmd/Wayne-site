// Version 1 shared types. Routes and persistence services are not implemented by C1.
// Frontend code may import these types; never import the server authentication module.
export type TimePrecision = 'exact' | 'date' | 'unknown';
export type EvidenceStatus = 'unknown' | 'self_reported' | 'artifact_checked';
export type Assistance = 'unknown' | 'none' | 'concept_hint' | 'code_outline' | 'full_solution';
export type ExecutionMode = 'unknown' | 'reading' | 'simulated_analysis' | 'local_run' | 'hardware_run';
export type EventKind = 'learning_activity' | 'historical_summary' | 'user_correction';

export type LearningEventInput = {
  schema_version: 1;
  idempotency_key: string;
  source: {type: string; record_id: string | null};
  kind: EventKind;
  occurred_at: string | null;
  time_precision: TimePrecision;
  study_day_override: {study_day: string; reason: string} | null;
  content: {summary: string};
  evidence_status: EvidenceStatus;
  assistance: Assistance;
  execution_mode: ExecutionMode;
  knowledge_ids: string[];
  plan_id: string | null;
  test_run_id?: string;
};

export type LearningEventDTO = Pick<LearningEventInput,
  'source' | 'kind' | 'occurred_at' | 'time_precision' | 'content' | 'evidence_status' |
  'assistance' | 'execution_mode' | 'knowledge_ids' | 'plan_id'
> & {
  event_id: string;
  revision: number;
  received_at: string;
  study_day: string | null;
  study_day_override_reason: string | null;
  visibility: 'private';
};

export type SaveReceiptDTO = {
  receipt_id: string;
  event_id: string;
  revision: number;
  received_at: string;
  study_day: string | null;
  data_version: number;
  saved: true;
  processing_status: 'pending';
  replayed: boolean;
};

export type LearningCorrectionInput = {
  schema_version: 1;
  idempotency_key: string;
  expected_revision: number;
  reason: string;
  event: Omit<LearningEventInput, 'schema_version' | 'idempotency_key'>;
};

export type LearningEventHistoryDTO = {
  event_id: string;
  current_revision: number;
  data_version: number;
  next_before_revision: number | null;
  revisions: {
    event: LearningEventDTO;
    supersedes_revision: number | null;
    reason: string;
    created_at: string;
  }[];
};

export type LearningDeletionInput = {schema_version: 1; idempotency_key: string; expected_revision: number};
export type DeleteReceiptDTO = {
  event_id: string; deleted_revision: number; data_version: number; deleted_at: string;
  deleted: true; replayed: boolean;
};

export type ContextPurpose = 'teaching' | 'planning' | 'review' | 'portfolio';
export type LearningContextDTO = {
  purpose: ContextPurpose;
  generated_at: string;
  latest_observed_event_at: string | null;
  data_version: number;
  assessment_processed_version: number;
  outline_version: number | null;
  policy_version: number | null;
  covered_sources: string[];
  unknown_ranges: string[];
  evidence_refs: {event_id: string; revision: number}[];
  events: LearningEventDTO[];
};

export type LearningAPIErrorCode = 'PRIVATE_ACCESS_DENIED' | 'INVALID_INPUT' |
  'IDEMPOTENCY_CONFLICT' | 'REVISION_CONFLICT' | 'PAYLOAD_TOO_LARGE' |
  'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' | 'EVENT_DELETED' | 'EVENT_NOT_FOUND';
export type LearningAPIErrorDTO = {error: {code: LearningAPIErrorCode; message: string}};
