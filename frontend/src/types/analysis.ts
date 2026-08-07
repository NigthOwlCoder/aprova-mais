export type ItemStatus = "COMPLIANT" | "WARNING" | "NON_COMPLIANT" | "NOT_IDENTIFIED";

export interface AnalysisItem {
  id: string;
  topic: string;
  requirement: string;
  project_value: string;
  status: ItemStatus;
  source: string;
  recommendation: string;
  confidence: number;
}

export interface DemoAnalysis {
  id: string;
  project: {
    name: string;
    municipality: string;
    project_type: string;
    address: string;
    lot_area: number;
    zoning: string;
  };
  documents: Array<{ name: string; pages: number }>;
  summary: {
    score: number;
    confidence: number;
    compliant: number;
    warnings: number;
    non_compliant: number;
    not_identified: number;
  };
  items: AnalysisItem[];
  disclaimer: string;
}
