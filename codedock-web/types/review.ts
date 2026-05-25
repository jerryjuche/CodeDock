export type ReviewRiskLevel = "low" | "medium" | "high";

export type ReviewCategory =
  | "Frontend"
  | "Backend"
  | "Config"
  | "Security"
  | "General";

export type ReviewStatus = "reviewed" | "unreviewed";

export type ReviewInsight = {
  id: string;
  severity: "low" | "medium" | "high";
  title: string;
  description: string;
  confidence: number;
  suggestion: string;
};

export type ReviewFile = {
  id: string;
  path: string;
  file: string;
  language: string;
  category: ReviewCategory;
  lastModified: string;
  author: string;
  authorInitials: string;
  reviewStatus: ReviewStatus;
  riskLevel: ReviewRiskLevel;
  riskReasons: string[];
  aiInsights: ReviewInsight[];
  aiFlagged: boolean;
  isSecuritySensitive: boolean;
  isConfig: boolean;
  addedLines: number;
  removedLines: number;
  totalChanges: number;
  baseCode: string;
  currentCode: string;
};

export type ReviewFilterValue =
  | "all"
  | "highRisk"
  | "unreviewed"
  | "aiFlagged"
  | "backend"
  | "frontend"
  | "config"
  | "security";

export type ReviewSortValue = "recent" | "risky" | "largest" | "author";
