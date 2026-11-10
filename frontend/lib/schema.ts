import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enums (docs/CONTRACT.md §3)                                         */
/* ------------------------------------------------------------------ */

export const UserRole = z.enum(["PATIENT", "CAREGIVER", "CLINICIAN", "ADMIN"]);
export const AuthProvider = z.enum(["LOCAL", "MYCHART", "EPIC"]);
export const EncounterType = z.enum(["INPATIENT", "OUTPATIENT", "EMERGENCY", "TRANSFER"]);
export const EncounterStatus = z.enum(["PLANNED", "IN_PROGRESS", "FINISHED", "CANCELLED"]);
export const JourneyNodeType = z.enum([
  "CARE_EPISODE",
  "HOME_INTERVAL",
  "CARE_CATEGORY",
  "EVENT",
  "NEXT_STEP",
]);
export const CareEventType = z.enum([
  "ADMISSION",
  "DISCHARGE",
  "PROCEDURE",
  "INTUBATION",
  "EXTUBATION",
  "MEDICATION",
  "OBSERVATION",
  "UNIT_TRANSFER",
  "GOAL",
  "OTHER",
]);
export const EventStatus = z.enum(["COMPLETED", "ACTIVE", "PLANNED", "CHANGED", "UNKNOWN"]);
export const PlanStatus = z.enum(["CONFIRMED", "PLANNED", "UNDER_REVIEW", "COMPLETED", "CANCELLED"]);
export const ReviewStatus = z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]);
export const Visibility = z.enum(["FAMILY_APPROVED", "PATIENT_ONLY", "CLINICIAN_ONLY", "RESTRICTED"]);
export const ContentDepth = z.enum(["SIMPLE", "STANDARD", "CLINICAL"]);
export const FamilyEntryType = z.enum(["QUESTION", "HOME_OBSERVATION", "BILLING_QUESTION"]);
export const AccessRelationship = z.enum(["SELF", "GUARDIAN", "CARE_TEAM", "DEMO_EXPLORER"]);
export const MedicationStatus = z.enum(["ACTIVE", "RECENTLY_CHANGED", "STOPPED"]);
export const ContentTargetType = z.enum(["JOURNEY_NODE", "PROCEDURE", "MEDICATION", "ENCOUNTER"]);
export const TextSize = z.enum(["NORMAL", "LARGE", "EXTRA_LARGE"]);

export type UserRole = z.infer<typeof UserRole>;
export type EventStatus = z.infer<typeof EventStatus>;
export type PlanStatus = z.infer<typeof PlanStatus>;
export type ReviewStatus = z.infer<typeof ReviewStatus>;
export type Visibility = z.infer<typeof Visibility>;
export type ContentDepth = z.infer<typeof ContentDepth>;
export type TextSize = z.infer<typeof TextSize>;
export type MedicationStatus = z.infer<typeof MedicationStatus>;

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

const nullableString = z.string().nullish();

export const ProvenanceSchema = z.object({
  source_system: z.string(),
  source_record_id: nullableString,
  source_updated_at: nullableString,
  data_fetched_at: nullableString,
  review_status: ReviewStatus.or(z.string()),
  visibility: Visibility.or(z.string()),
  reviewed_by: nullableString,
  reviewed_at: nullableString,
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const NoteTargetType = z.enum([
  "PATIENT",
  "ENCOUNTER",
  "JOURNEY_NODE",
  "MEDICATION",
  "PROCEDURE",
  "PRECAUTION",
  "GOAL",
  "MILESTONE",
]);
export type NoteTargetType = z.infer<typeof NoteTargetType>;

/** Contract §8.3. Families only ever receive notes with shared_with_family=true. */
export const CareTeamNoteSchema = z.object({
  id: z.string(),
  target_type: NoteTargetType.or(z.string()),
  target_id: nullableString,
  target_label: nullableString,
  text: z.string(),
  shared_with_family: z.boolean(),
  author_display_name: nullableString,
  is_mine: z.boolean(),
  created_at: z.string(),
  updated_at: nullableString,
});
export type CareTeamNote = z.infer<typeof CareTeamNoteSchema>;
export const CareTeamNotesSchema = z.array(CareTeamNoteSchema);
const notesField = CareTeamNotesSchema.default([]);

/* ------------------------------------------------------------------ */
/* Outlook / looking ahead (contract §9)                               */
/* ------------------------------------------------------------------ */

export const MilestoneKind = z.enum(["DISCHARGE", "PROCEDURE", "MEDICATION_CHANGE", "CARE_STEP", "FOLLOW_UP"]);
export const Certainty = z.enum(["CONFIRMED", "LIKELY", "POSSIBLE", "NOT_SET"]);
export const ConditionStatus = z.enum(["DONE", "IN_PROGRESS", "NOT_YET"]);
export type MilestoneKind = z.infer<typeof MilestoneKind>;
export type Certainty = z.infer<typeof Certainty>;
export type ConditionStatus = z.infer<typeof ConditionStatus>;

export const OutlookConditionSchema = z.object({
  id: z.string(),
  label: z.string(),
  plain_detail: nullableString,
  status: ConditionStatus.or(z.string()),
  updated_at: nullableString,
});
export type OutlookCondition = z.infer<typeof OutlookConditionSchema>;

/** Every forward-looking item is set by a clinician; the UI never computes one. */
export const MilestoneSchema = z.object({
  id: z.string(),
  kind: MilestoneKind.or(z.string()),
  title: z.string(),
  plain_summary: nullableString,
  expected_at: nullableString,
  window_start: nullableString,
  window_end: nullableString,
  time_known: z.boolean().default(false),
  certainty: Certainty.or(z.string()),
  certainty_label: nullableString,
  shared_with_family: z.boolean().default(true),
  day_of_stay: z.number().nullish(),
  set_by: nullableString,
  set_at: nullableString,
  status: z.string().nullish(),
  conditions: z.array(OutlookConditionSchema).default([]),
  conditions_done: z.number().default(0),
  conditions_total: z.number().default(0),
  care_team_notes: notesField,
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const OutlookSchema = z.object({
  as_of: nullableString,
  patient_id: z.string(),
  discharge: MilestoneSchema.nullish(),
  next_24h: z.array(MilestoneSchema).default([]),
  upcoming: z.array(MilestoneSchema).default([]),
  after_discharge: z.array(MilestoneSchema).default([]),
  disclaimer: nullableString,
  last_updated_at: nullableString,
  last_updated_by: nullableString,
});
export type Outlook = z.infer<typeof OutlookSchema>;

export const OutlookHeadlineSchema = z.object({
  title: z.string(),
  certainty: Certainty.or(z.string()),
  certainty_label: nullableString,
  conditions_done: z.number().default(0),
  conditions_total: z.number().default(0),
});
export type OutlookHeadline = z.infer<typeof OutlookHeadlineSchema>;

/** Contract §10.3: family-only billing summary on PatientSummary (null for the care team). */
export const BillingHeadlineSchema = z.object({
  owed_now_cents: z.number().int().default(0),
  next_due_on: nullableString,
  pending_family_estimate_cents: z.number().int().nullish(),
});
export type BillingHeadline = z.infer<typeof BillingHeadlineSchema>;

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  display_name: z.string(),
  role: UserRole,
  auth_provider: AuthProvider.or(z.string()),
});
export type User = z.infer<typeof UserSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  expires_at: z.string(),
  user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export const PatientSummarySchema = z.object({
  id: z.string(),
  display_name: z.string(),
  first_name: z.string(),
  age: z.number().nullish(),
  is_synthetic: z.boolean(),
  relationship: AccessRelationship.or(z.string()),
  current_encounter_id: nullableString,
  current_day: z.number().nullish(),
  as_of: nullableString,
  headline: z.object({ title: z.string(), body: z.string() }).nullish(),
  data_fetched_at: nullableString,
  source_system: z.string(),
  outlook_headline: OutlookHeadlineSchema.nullish(),
  billing_headline: BillingHeadlineSchema.nullish(),
});
export type PatientSummary = z.infer<typeof PatientSummarySchema>;

export const ClinicianPatientSummarySchema = PatientSummarySchema.extend({
  current_stay_label: nullableString,
  pending_review_count: z.number().default(0),
  questions_for_rounds_count: z.number().default(0),
  care_team_note_count: z.number().default(0),
  last_updated_at: nullableString,
});
export type ClinicianPatientSummary = z.infer<typeof ClinicianPatientSummarySchema>;

/* ------------------------------------------------------------------ */
/* Journey                                                             */
/* ------------------------------------------------------------------ */

export const JourneyNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: nullableString,
  node_type: JourneyNodeType.or(z.string()).nullish(),
  state: EventStatus.or(z.string()).nullish(),
  is_current: z.boolean(),
  icon_key: z.string(),
  has_children: z.boolean(),
  display_order: z.number(),
  start_at: nullableString,
  end_at: nullableString,
  occurred_at: nullableString,
  home_interval_id: nullableString,
  event_type: nullableString,
  /** Contract §9.3: clinician-set going-home hint, only on Next steps / What's next nodes. */
  outlook_hint: nullableString,
});
export type JourneyNode = z.infer<typeof JourneyNodeSchema>;

export const FamilyContentSchema = z.object({
  id: z.string(),
  review_state: z.enum(["APPROVED", "PENDING"]).or(z.string()),
  depth_used: ContentDepth.or(z.string()),
  summary: nullableString,
  what_happened: nullableString,
  why: nullableString,
  what_next: nullableString,
  medical_terms: z.array(z.string()).default([]),
  provenance: ProvenanceSchema,
});
export type FamilyContent = z.infer<typeof FamilyContentSchema>;

export const BreadcrumbSchema = z.object({ id: z.string(), title: z.string() });
export type Breadcrumb = z.infer<typeof BreadcrumbSchema>;

export const JourneyNodeDetailSchema = JourneyNodeSchema.extend({
  level: z.number(),
  patient_id: z.string(),
  heading: nullableString,
  breadcrumbs: z.array(BreadcrumbSchema),
  parent_id: nullableString,
  children: z.array(JourneyNodeSchema),
  content: FamilyContentSchema.nullish(),
  /** Additive: CLINICIAN_ONLY/RESTRICTED notes, only ever filled for care team clinicians. */
  restricted_content: z.array(FamilyContentSchema).optional(),
  care_team_notes: notesField,
  synthetic: z.boolean().optional(),
});
export type JourneyNodeDetail = z.infer<typeof JourneyNodeDetailSchema>;

/* ------------------------------------------------------------------ */
/* Clinical                                                            */
/* ------------------------------------------------------------------ */

export const EncounterSchema = z.object({
  id: z.string(),
  encounter_type: EncounterType.or(z.string()),
  status: EncounterStatus.or(z.string()),
  start_at: nullableString,
  end_at: nullableString,
  label: z.string(),
  day_count: z.number().nullish(),
  journey_node_id: nullableString,
});
export type Encounter = z.infer<typeof EncounterSchema>;

export const TodaySchema = z.object({
  as_of: nullableString,
  day_number: z.number().nullish(),
  summary_simple: nullableString,
  goals: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: nullableString,
      status: PlanStatus.or(z.string()),
      responsible_party: nullableString,
      care_team_notes: notesField,
    }),
  ),
  medications_summary: z
    .object({
      active_count: z.number(),
      recently_changed_count: z.number(),
      status: PlanStatus.or(z.string()),
    })
    .nullish(),
  next_procedure: z
    .object({
      id: z.string(),
      name: z.string(),
      status: PlanStatus.or(z.string()),
      timing_confirmed: z.boolean(),
      scheduled_at: nullableString,
    })
    .nullish(),
  precautions_summary: z.object({ count: z.number(), pending_review_count: z.number() }).nullish(),
  last_reviewed_at: nullableString,
  last_reviewed_by: nullableString,
  coming_up: z.array(MilestoneSchema).default([]),
});
export type Today = z.infer<typeof TodaySchema>;

export const MedicationSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  purpose: nullableString,
  status: MedicationStatus.or(z.string()),
  how_given: nullableString,
  schedule: nullableString,
  schedule_verified: z.boolean(),
  started_at: nullableString,
  ended_at: nullableString,
  change_note: nullableString,
  is_order: z.boolean(),
  demo_example: z.boolean(),
  provenance: ProvenanceSchema,
  care_team_notes: notesField,
});
export type Medication = z.infer<typeof MedicationSchema>;

export const MedicationsSchema = z.object({
  active: z.array(MedicationSchema),
  recently_changed: z.array(MedicationSchema),
  past: z.array(MedicationSchema),
  note: nullableString,
});
export type Medications = z.infer<typeof MedicationsSchema>;

export const ProcedureSchema = z.object({
  id: z.string(),
  name: z.string(),
  plain_name: nullableString,
  status: PlanStatus.or(z.string()),
  timing_confirmed: z.boolean(),
  scheduled_at: nullableString,
  performed_at: nullableString,
  what_is_it: nullableString,
  what_to_expect: nullableString,
  preparation: z.object({ review_state: z.string(), text: nullableString }).nullish(),
  provenance: ProvenanceSchema,
  care_team_notes: notesField,
});
export type Procedure = z.infer<typeof ProcedureSchema>;

export const ProceduresSchema = z.object({
  planned: z.array(ProcedureSchema),
  completed: z.array(ProcedureSchema),
});
export type Procedures = z.infer<typeof ProceduresSchema>;

export const PrecautionSchema = z.object({
  id: z.string(),
  title: z.string(),
  instruction: nullableString,
  status: PlanStatus.or(z.string()),
  label: z.string(),
  valid_from: nullableString,
  valid_until: nullableString,
  demo_only: z.boolean(),
  provenance: ProvenanceSchema,
  care_team_notes: notesField,
});
export type Precaution = z.infer<typeof PrecautionSchema>;
export const PrecautionsSchema = z.array(PrecautionSchema);

export const FamilyEntrySchema = z.object({
  id: z.string(),
  entry_type: FamilyEntryType.or(z.string()),
  text: z.string(),
  author_display_name: nullableString,
  is_mine: z.boolean(),
  marked_for_rounds: z.boolean(),
  handled: z.boolean(),
  related_encounter_id: nullableString,
  observed_at: nullableString,
  created_at: z.string(),
  updated_at: nullableString,
  family_reported: z.boolean(),
});
export type FamilyEntry = z.infer<typeof FamilyEntrySchema>;
export const FamilyEntriesSchema = z.array(FamilyEntrySchema);

/* ------------------------------------------------------------------ */
/* Bills & costs (contract §10). Read-only; money is integer cents.    */
/* ------------------------------------------------------------------ */

const cents = z.number().int();

export const BillItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  category_label: nullableString,
  description: z.string(),
  service_date: nullableString,
  status: z.string(),
  status_label: nullableString,
  charged_cents: cents,
  insurance_expected_cents: cents.nullish(),
  family_share_cents: cents.nullish(),
  family_paid_cents: cents.default(0),
  estimate_note: nullableString,
  milestone: z
    .object({
      id: z.string(),
      title: z.string(),
      expected_at: nullableString,
      certainty_label: nullableString,
    })
    .nullish(),
  provenance: z
    .object({ source_system: z.string(), source_record_id: nullableString, source_updated_at: nullableString })
    .nullish(),
});
export type BillItem = z.infer<typeof BillItemSchema>;

export const BillStatementSchema = z.object({
  id: z.string(),
  issued_on: nullableString,
  due_on: nullableString,
  amount_cents: cents,
  paid_cents: cents.default(0),
  status: z.string(),
  status_label: nullableString,
});
export type BillStatement = z.infer<typeof BillStatementSchema>;

export const BillingStaySchema = z.object({
  encounter_id: nullableString,
  label: z.string(),
  dates: nullableString,
  status_label: nullableString,
  items: z.array(BillItemSchema).default([]),
  charged_cents: cents.default(0),
  insurance_expected_cents: cents.nullish(),
  family_share_cents: cents.nullish(),
  family_paid_cents: cents.default(0),
  statement: BillStatementSchema.nullish(),
});
export type BillingStay = z.infer<typeof BillingStaySchema>;

export const BillingSchema = z.object({
  as_of: nullableString,
  currency: z.string().default("USD"),
  demo_notice: nullableString,
  coverage: z
    .object({
      plan_name: z.string(),
      plan_year_end: nullableString,
      deductible_cents: cents,
      deductible_met_cents: cents,
      out_of_pocket_max_cents: cents,
      out_of_pocket_met_cents: cents,
      coinsurance_percent: z.number(),
      data_fetched_at: nullableString,
    })
    .nullish(),
  summary: z.object({
    owed_now_cents: cents.default(0),
    next_due_on: nullableString,
    pending_family_estimate_cents: cents.nullish(),
    upcoming_family_estimate_cents: cents.nullish(),
    total_charged_cents: cents.nullish(),
    insurance_expected_cents: cents.nullish(),
    family_paid_cents: cents.nullish(),
  }),
  stays: z.array(BillingStaySchema).default([]),
  upcoming: z.array(BillItemSchema).default([]),
  help: z
    .object({
      billing_office_phone: nullableString,
      payment_portal_enabled: z.boolean().default(false),
      financial_assistance: nullableString,
      payment_plans: nullableString,
    })
    .nullish(),
  questions: FamilyEntriesSchema.default([]),
});
export type Billing = z.infer<typeof BillingSchema>;

export const HomeIntervalSchema = z.object({
  id: z.string(),
  start_at: nullableString,
  end_at: nullableString,
  days: z.number().nullish(),
  days_known: z.boolean(),
  preceding_encounter: z.object({ id: z.string(), label: z.string() }).nullish(),
  following_encounter: z.object({ id: z.string(), label: z.string() }).nullish(),
  family_observations: z.array(FamilyEntrySchema),
  documented_return_reason: z.object({ text: nullableString, provenance: ProvenanceSchema }).nullish(),
  causation_disclaimer: nullableString,
});
export type HomeInterval = z.infer<typeof HomeIntervalSchema>;

export const RoundsCardSchema = z.object({
  title: z.string(),
  body: nullableString,
  icon_key: z.string(),
  status_label: nullableString,
});
export type RoundsCard = z.infer<typeof RoundsCardSchema>;

export const RoundsSchema = z.object({
  steps: z.array(
    z.object({
      number: z.number(),
      key: z.string(),
      title: z.string(),
      cards: z.array(RoundsCardSchema),
    }),
  ),
});
export type Rounds = z.infer<typeof RoundsSchema>;
export type RoundsStep = Rounds["steps"][number];

export const CarePathSchema = z.object({
  current: JourneyNodeSchema.nullish(),
  options: z.array(JourneyNodeSchema),
  note: nullableString,
});
export type CarePath = z.infer<typeof CarePathSchema>;

/* ------------------------------------------------------------------ */
/* Clinician                                                           */
/* ------------------------------------------------------------------ */

export const ReviewItemSchema = z.object({
  id: z.string(),
  target_type: ContentTargetType.or(z.string()),
  target_label: z.string(),
  depth: ContentDepth.or(z.string()),
  summary: nullableString,
  visibility: Visibility.or(z.string()),
  review_status: ReviewStatus.or(z.string()),
  source_system: nullableString,
  source_record_id: nullableString,
  updated_at: nullableString,
  reviewed_by: nullableString,
  reviewed_at: nullableString,
  review_note: nullableString,
});
export type ReviewItem = z.infer<typeof ReviewItemSchema>;
export const ReviewQueueSchema = z.array(ReviewItemSchema);

/* ------------------------------------------------------------------ */
/* Preferences / integrations                                          */
/* ------------------------------------------------------------------ */

export const PreferencesSchema = z.object({
  depth: ContentDepth,
  preferred_language: z.string(),
  text_size: TextSize,
  read_aloud: z.boolean(),
  high_contrast: z.boolean(),
});
export type Preferences = z.infer<typeof PreferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  depth: "SIMPLE",
  preferred_language: "en",
  text_size: "NORMAL",
  read_aloud: false,
  high_contrast: false,
};

export const IntegrationStatusSchema = z.object({
  clinical_data_provider: z.string(),
  demo_mode: z.boolean(),
  mychart_login_enabled: z.boolean(),
  epic_launch_enabled: z.boolean(),
  fhir_connected: z.boolean(),
  message: nullableString,
});
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

/* ------------------------------------------------------------------ */
/* Form inputs (validated in Server Actions)                           */
/* ------------------------------------------------------------------ */

export const LoginInput = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export const RegisterInput = z.object({
  display_name: z.string().trim().min(1, "Enter your name.").max(80, "Name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/\d/, "Password must include at least one number."),
});

export const QuestionInput = z.object({
  text: z.string().trim().min(1, "Type a question first.").max(500, "Keep questions under 500 characters."),
  marked_for_rounds: z.boolean().optional(),
});

export const ObservationInput = z.object({
  text: z.string().trim().min(1, "Describe what you noticed.").max(500, "Keep it under 500 characters."),
  observed_at: z.string().datetime({ offset: true }).optional(),
});

export const ReviewDecisionInput = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(500).optional(),
});

export const NoteInput = z.object({
  target_type: NoteTargetType,
  target_id: z.string().regex(/^[A-Za-z0-9-]{1,64}$/).nullable(),
  text: z.string().trim().min(1, "Write a note first.").max(1000, "Keep notes under 1000 characters."),
  shared_with_family: z.boolean(),
});

export const NoteUpdateInput = z.object({
  text: z.string().trim().min(1, "Write a note first.").max(1000, "Keep notes under 1000 characters."),
  shared_with_family: z.boolean(),
});

const optionalText = (max: number, msg: string) =>
  z
    .string()
    .trim()
    .max(max, msg)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a full date.");
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Use a time like 15:00.");

/** Clinician milestone form. Dates and times are entered and shown in UTC. */
export const MilestoneFormInput = z
  .object({
    kind: MilestoneKind,
    title: z.string().trim().min(1, "Give this a short title.").max(120, "Keep the title under 120 characters."),
    plain_summary: z.string().trim().max(500, "Keep the summary under 500 characters."),
    expected_date: isoDate.nullable(),
    expected_time: hhmm.nullable(),
    window_start: isoDate.nullable(),
    window_end: isoDate.nullable(),
    certainty: Certainty,
    shared_with_family: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.expected_time && !v.expected_date) {
      ctx.addIssue({ code: "custom", path: ["expected_date"], message: "Add a date for this time." });
    }
    if (v.window_end && !v.window_start) {
      ctx.addIssue({ code: "custom", path: ["window_start"], message: "Add the first day of the window." });
    }
    if (v.window_start && v.window_end && v.window_end < v.window_start) {
      ctx.addIssue({ code: "custom", path: ["window_end"], message: "The window cannot end before it starts." });
    }
    if (v.certainty === "CONFIRMED" && !v.expected_date && !v.window_start) {
      ctx.addIssue({ code: "custom", path: ["certainty"], message: "A confirmed item needs a date." });
    }
  });

export const ConditionInput = z.object({
  label: z.string().trim().min(1, "Describe what needs to happen.").max(160, "Keep it under 160 characters."),
  plain_detail: optionalText(300, "Keep the detail under 300 characters."),
  status: ConditionStatus,
});

export const BillingQuestionInput = z.object({
  text: z.string().trim().min(1, "Type a question first.").max(500, "Keep questions under 500 characters."),
  bill_item_id: z.string().regex(/^[A-Za-z0-9-]{1,64}$/).nullable(),
});

export const PreferencesInput = PreferencesSchema.partial();

export const UuidLike = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

/** Common shape returned by Server Actions used with useActionState. */
export type ActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Non-secret values echoed back so forms keep what the user typed. */
  values?: Record<string, string>;
};
