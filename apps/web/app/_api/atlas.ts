"use client";

// Pattern Atlas API: Realgo Taxonomy tree, per-user mastery, company
// relevance overlay and node detail. Mirrors services/api/internal/patterns
// atlas_models.go.

import { apiFetch } from "./client";

export type MasteryStatus =
  | "not_started"
  | "learning"
  | "weak"
  | "unstable"
  | "strong"
  | "mastered";

export type RelevanceLevel =
  | "high"
  | "medium"
  | "low"
  | "insufficient_evidence"
  | "no_evidence";

export type SubpatternStats = {
  problem_count: number;
  solved_count: number;
  in_progress_count: number;
  due_count: number;
  card_count: number;
  attempt_count: number;
  hard_count: number;
  difficulty_counts?: Partial<Record<"easy" | "medium" | "hard" | "unknown", number>>;
  next_review_at?: string;
  last_solved_at?: string;
};

export type Mastery = {
  status: MasteryStatus;
  percent: number;
  components: { practice: number; retention: number };
};

export type CompanyRelevance = {
  relevance: RelevanceLevel;
  confidence: "high" | "medium" | "low";
  evidence_count: number;
  last_seen_at?: string;
  source_type: "demo" | "manual" | "community" | "dataset";
};

export type AtlasTool = {
  code: string;
  name: string;
  position: number;
  subpattern_codes: string[];
};

export type AtlasFamily = {
  code: string;
  name: string;
  description: string;
  position: number;
  subpattern_codes: string[];
};

export type AtlasSubpattern = {
  code: string;
  name: string;
  position: number;
  family_codes: string[];
  tool_codes: string[];
  stats: SubpatternStats;
  mastery: Mastery;
  relevance?: CompanyRelevance;
};

export type AtlasGap = {
  code: string;
  name: string;
  relevance: RelevanceLevel;
  mastery_percent: number;
};

export type AtlasCoverage = {
  relevant_subpatterns: number;
  strong: number;
  unstable: number;
  weak: number;
  not_started: number;
  top_gaps: AtlasGap[];
};

export type AtlasRelevantProblem = PracticeProblem & {
  subpattern_code: string;
  subpattern_name: string;
  evidence_count: number;
  last_seen_at?: string;
  source_type: string;
};

export type AtlasCompanyOverlay = {
  code: string;
  name: string;
  demo_only: boolean;
  coverage: AtlasCoverage;
  relevant_problems?: AtlasRelevantProblem[];
};

export type AtlasResponse = {
  taxonomy_version: string;
  tools: AtlasTool[];
  families: AtlasFamily[];
  subpatterns: AtlasSubpattern[];
  company?: AtlasCompanyOverlay;
};

export type AtlasCompany = {
  code: string;
  name: string;
  subpattern_count: number;
  demo_only: boolean;
  last_seen_at?: string;
};

export type NodeRef = { code: string; name: string };

export type ContrastPair = { title: string; note: string };

export type LearningMaterial = {
  what_it_is: string;
  mental_model: string;
  recognition_cues: string[];
  anti_cues: string[];
  core_invariant: string;
  canonical_skeleton: string;
  common_mistakes: string[];
  dont_confuse_with: ContrastPair[];
  mini_example: string;
};

export type CardSummary = {
  id: number;
  type: string;
  question: string;
  next_review_at?: string;
  last_rating?: string;
};

export type PracticeProblem = {
  id: number;
  title: string;
  url: string;
  difficulty: string;
  tier?: string;
  status: string;
  platform?: string;
  rating?: string;
  solved_at?: string;
  next_review_at?: string;
};

export type CompanyPracticeProblem = PracticeProblem & {
  evidence_count: number;
  last_seen_at?: string;
  source_type: string;
};

export type CompanyPracticeGroup = {
  company: NodeRef;
  problems: CompanyPracticeProblem[];
};

export type RelevantCompany = NodeRef & CompanyRelevance;

export type ExampleProblem = { title: string; difficulty: string; url: string };

export type NodeDetail = {
  code: string;
  name: string;
  kind: "pattern" | "tool" | "family" | "subpattern";
  description: string;
  taxonomy_version?: string;
  techniques: string[];
  recognition_symptoms: string[];
  checklist: string[];
  example_problems: ExampleProblem[];
  families?: NodeRef[];
  tools?: NodeRef[];
  subpatterns?: NodeRef[];
  material?: LearningMaterial;
  stats?: SubpatternStats;
  mastery?: Mastery;
  cards: CardSummary[];
  practice: PracticeProblem[];
  company_practice: CompanyPracticeGroup[];
  relevant_companies: RelevantCompany[];
};

export function getAtlas(companyCode?: string, signal?: AbortSignal) {
  const params = companyCode ? `?company=${encodeURIComponent(companyCode)}` : "";
  return apiFetch<AtlasResponse>(`/me/patterns/atlas${params}`, { signal });
}

export function getAtlasCompanies(signal?: AbortSignal) {
  return apiFetch<{ companies: AtlasCompany[] }>("/me/patterns/atlas/companies", { signal });
}

// platform ("" = все) сужает practice-список узла до одной площадки; ключ
// выбора хранит тулбар атласа в localStorage (realgo.atlas.platform).
export function getAtlasNode(code: string, platform?: string, signal?: AbortSignal) {
  const params = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  return apiFetch<NodeDetail>(`/me/patterns/atlas/${encodeURIComponent(code)}${params}`, { signal });
}
