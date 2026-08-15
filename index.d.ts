/**
 * Type definitions for open-crucible-protocol.
 * Hand written and checked in, because this package has no build step.
 */

export type Side = 'A' | 'B';
export type ClaimType = 'empirical' | 'logical' | 'definitional';
export type Qualifier = 'certain' | 'probable' | 'plausible';
export type Tier = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
export type Relevance = 0.25 | 0.5 | 0.75 | 1.0;
export type VersionStatus = 'candidate' | 'merged' | 'superseded' | 'demoted' | 'rejected';
export type Phase =
  | 'framing' | 'construction' | 'challenge' | 'steelman'
  | 'adjudication' | 'verdict' | 'closed';
export type ChallengeGround =
  | 'evidence-validity' | 'warrant-failure' | 'relevance' | 'counter-evidence';
export type AppealGround = 'A1' | 'A2' | 'A3';
export type BandKey = 'unresolved' | 'balance' | 'clear' | 'decisive';

export interface Citation {
  source: string; url?: string; tier: Tier;
  /** Set by an arbiter via `verifyTier`. Until then the tier scores at no better than T3. */
  tierVerified?: boolean;
  tierVerifiedNote?: string;
}

export interface ClaimVersion {
  id: string; threadId: string; num: number; parentId: string | null;
  author: string; side: Side; type: ClaimType;
  assertion: string; grounds: string; warrant: string;
  evidence: Citation[]; qualifier: Qualifier;
  status: VersionStatus; relevance: Relevance | null;
  mergeRationale: string; createdAt: number;
}

export interface ClaimThread {
  id: string; side: Side; title: string;
  versions: ClaimVersion[]; canonicalId: string | null; createdAt: number;
}

export interface ChallengeResponse { text: string; author: string; side: Side; ts: number }

export interface Challenge {
  id: string; threadId: string; versionId: string;
  ground: ChallengeGround; text: string; evidence: Citation[];
  author: string; side: Side;
  response: ChallengeResponse | null;
  resolution: 'upheld' | 'dismissed' | null;
  rationale: string; appealId: string | null; createdAt: number;
}

export interface Steelman {
  text: string; author: string; side: Side | null;
  status: 'none' | 'submitted' | 'certified' | 'returned';
  note: string; ts: number | null;
}

export interface LedgerRow {
  side: Side; threadId: string; threadTitle: string;
  versionId: string; versionNum: number; assertion: string;
  type: ClaimType; qualifier: Qualifier;
  E: number; R: number; S: number; Q: number; dismissed: number; merit: number;
}

export interface Ledger { rows: LedgerRow[]; totals: { A: number; B: number } }
export interface Band { key: BandKey; label: string }

export interface Verdict {
  n: number; issuedAt: number; winner: Side | null;
  totals: { A: number; B: number }; margin: number; band: Band;
  rationale: string; ledger: LedgerRow[]; viaAppealId: string | null;
  /** True when the ledger was unresolved and the declared burden decided it. */
  byBurden?: boolean;
}

export interface Appeal {
  id: string; side: Side; author: string; ground: AppealGround;
  justification: string; evidence: Citation[]; targetThreadIds: string[];
  status: 'filed' | 'admitted' | 'denied' | 'resolved';
  decisionRationale: string; filedAt: number;
}

export interface Definition { term: string; definition: string; author: string; side: Side }
export interface LogEntry {
  ts: number; actor: string; side: Side | null; action: string; detail: string;
}

export interface Debate {
  schemaVersion: number; id: string; createdAt: number;
  resolution: string; positions: { A: string; B: string };
  burden: Side | 'shared';
  /** Claims each side may score. Null scores every canonical claim, as in 1.0. */
  claimBudget: number | null;
  definitions: Definition[];
  phase: Phase | 'appeal-review';
  threads: ClaimThread[]; challenges: Challenge[];
  steelmans: { A: Steelman; B: Steelman };
  verdicts: Verdict[]; appeals: Appeal[];
  appealTargets: string[]; activeAppealId: string | null;
  log: LogEntry[];
}

export interface GateField {
  name?: string; label: string; text: string;
  argumentative?: boolean; required?: boolean;
}

export interface GateContext {
  kind: 'claim' | 'challenge' | 'response' | 'steelman' | 'appeal' | 'definition';
  author?: string; side?: Side | null; role?: 'contributor' | 'arbiter' | 'observer';
  type?: ClaimType; qualifier?: Qualifier | '';
  evidenceCount?: number; maxTierWeight?: number;
  ground?: ChallengeGround | AppealGround | string;
}

export interface GateViolation {
  rule: string; ruleName: string; field: string;
  excerpt: string; message: string; fix: string;
}

export interface GateRule {
  id: string; name: string; description: string; global?: boolean;
  check?: (field: GateField, ctx: GateContext) => Omit<GateViolation, 'rule' | 'ruleName'>[];
  checkGlobal?: (fields: GateField[], ctx: GateContext) => Omit<GateViolation, 'rule' | 'ruleName'>[];
}

export interface ProtocolError { code: string; message: string }
export type Refusal = ProtocolError | null;

export interface Env { now(): number; newId(prefix: string): string }

export interface NewDebateInput {
  resolution: string; posA: string; posB: string; burden?: Side | 'shared';
  /** Claims each side may score. Omit to score every canonical claim, as in 1.0. */
  claimBudget?: number | null;
}

export interface VersionInput {
  author: string; side: Side; type: ClaimType;
  assertion: string; grounds: string; warrant: string;
  evidence?: Citation[]; qualifier: Qualifier;
  relevance?: Relevance | null; parentId?: string | null;
}

export interface ChallengeInput {
  threadId: string; versionId: string; ground: ChallengeGround;
  text: string; evidence?: Citation[]; author: string; side: Side;
}

export interface AppealInput {
  side: Side; author: string; ground: AppealGround;
  justification: string; evidence?: Citation[]; targetThreadIds?: string[];
}

export interface VerdictOptions {
  actor?: string;
  rationale?: (
    d: Debate, ledger: Ledger, totals: { A: number; B: number },
    winner: Side | null, margin: number, band: Band
  ) => string;
}

export interface Protocol {
  env: Env;
  newDebate(input: NewDebateInput): Debate;
  addLog(d: Debate, actor: string, side: Side | null, action: string, detail: string): Debate;
  createThread(d: Debate, side: Side, title: string, actor: string): ClaimThread;
  addVersion(d: Debate, thread: ClaimThread, data: VersionInput): ClaimVersion;
  addDefinition(d: Debate, def: Omit<Definition, never>): Definition;
  mergeVersion(d: Debate, thread: ClaimThread, versionId: string, rationale: string, actor: string): Refusal;
  rejectVersion(d: Debate, thread: ClaimThread, versionId: string, rationale: string, actor: string): Refusal;
  /** Records that an arbiter checked a citation. An unverified tier scores at no better than T3. */
  verifyTier(d: Debate, thread: ClaimThread, versionId: string, citationIndex: number, note: string, actor: string): Refusal;
  fileChallenge(d: Debate, data: ChallengeInput): Challenge;
  respondChallenge(d: Debate, c: Challenge, text: string, author: string, side: Side): Refusal;
  resolveChallenge(d: Debate, c: Challenge, resolution: 'upheld' | 'dismissed', rationale: string, actor: string): Refusal;
  submitSteelman(d: Debate, ofSide: Side, text: string, author: string, side: Side): Refusal;
  certifySteelman(d: Debate, ofSide: Side, actor: string, side: Side): Refusal;
  /** Certifies a restatement the restated side will not certify, with a recorded reason. */
  arbiterCertifySteelman(d: Debate, ofSide: Side, reason: string, actor: string): Refusal;
  returnSteelman(d: Debate, ofSide: Side, note: string, actor: string, side: Side): Refusal;
  advancePhase(d: Debate, actor: string): Refusal;
  closeDebate(d: Debate, actor: string): Refusal;
  issueVerdict(d: Debate, viaAppealId?: string | null, options?: VerdictOptions): Verdict;
  fileAppeal(d: Debate, data: AppealInput): Appeal;
  decideAppeal(d: Debate, a: Appeal, admit: boolean, rationale: string, actor: string): Refusal;
  concludeAppealReview(d: Debate, actor: string, options?: VerdictOptions): Refusal;
}

export function createProtocol(env?: Partial<Env>): Protocol;

// Scoring and read-only queries.
export function evidenceBase(v: Pick<ClaimVersion, 'type' | 'evidence'>): number;
export function versionMerit(d: Pick<Debate, 'challenges'>, v: ClaimVersion): {
  E: number; R: number; S: number; Q: number; dismissed: number; merit: number;
};
export function computeLedger(d: Debate): Ledger;
export function verdictBand(margin: number): Band;
export function summarize(totals: { A: number; B: number }): {
  leader: Side | null; winner: Side | null; margin: number; band: Band;
};
export function generateRationale(
  d: Debate, ledger: Ledger, totals: { A: number; B: number },
  winner: Side | null, margin: number, band: Band
): string;
export function phasePrereq(d: Debate): Refusal;
export function canAppeal(d: Debate, side: Side): Refusal;
export function canOpenThread(d: Debate): boolean;
export function canProposeVersion(d: Debate, thread: ClaimThread): boolean;
export function canChallenge(d: Debate, thread: ClaimThread): boolean;
export function emptySteelman(): Steelman;
export function migrate<T>(d: T): T;

// Gate.
export const RULES: GateRule[];
export function check(fields: GateField[], ctx: GateContext): GateViolation[];
export const LEX: Readonly<Record<string, readonly string[]>>;
export const ACRONYM_WHITELIST: Set<string>;
export const WORD_LIMITS: Readonly<Record<string, number>>;
export const PICTOGRAPH_RE: RegExp;
export function wordCount(text: string): number;
export function findPhrases(text: string, phrases: readonly string[]): string[];
export function excerptAround(text: string, needle: string): string;

// Semantic screen.
export const S_RULES: Readonly<Record<string, string>>;
export const SCREEN_SYSTEM: string;
export function parseSemanticScreenResponse(rawText: string):
  { pass: boolean; violations: unknown[] } | { skipped: true; error: string };
export function buildScreenRequest(text: string): {
  system: string; messages: { role: 'user'; content: string }[];
};
export function fieldsToScreenText(fields: GateField[]): string;

// Constants.
export const SCHEMA_VERSION: number;
export const TIER_WEIGHT: Readonly<Record<Tier, number>>;
export const TIER_LABEL: Readonly<Record<Tier, string>>;
export const QUAL_WEIGHT: Readonly<Record<Qualifier, number>>;
export const RELEVANCE_STEPS: readonly Relevance[];
export const PHASES: readonly Phase[];
export const APPEAL_PHASE: 'appeal-review';
export const CHALLENGE_GROUNDS: Readonly<Record<ChallengeGround, string>>;
export const APPEAL_GROUNDS: Readonly<Record<AppealGround, string>>;
export const VERDICT_BANDS: readonly { key: BandKey; max: number; label: string }[];
export const VERSION_STATUS: Readonly<Record<string, VersionStatus>>;
export const CLAIM_TYPES: readonly ClaimType[];
export const SIDES: readonly Side[];

// Environment and errors.
export const defaultEnv: Env;
export function defaultNewId(prefix: string): string;
export function fixedClock(startMs: number, stepMs?: number): (() => number) & { reset(): void };
export function counterIds(): (prefix: string) => string;
export function resolveEnv(env?: Partial<Env>): Env;
export const ERR: Readonly<Record<string, string>>;
export function err(code: string, message: string): ProtocolError;
