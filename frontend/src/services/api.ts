import type { DemoAnalysis } from "../types/analysis";

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { detail?: string | Array<{ msg?: string }> } | null;
    const detail = typeof payload?.detail === "string"
      ? payload.detail
      : payload?.detail?.map((item) => item.msg).filter(Boolean).join("; ");
    throw new Error(detail || `Não foi possível concluir a solicitação (erro ${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export async function loadDemo(): Promise<DemoAnalysis> {
  return parseResponse<DemoAnalysis>(await fetch(`${API_URL}/api/analyses/demo`));
}

export async function createAnalysis(data: FormData): Promise<{ id: string }> {
  try {
    return parseResponse<{ id: string }>(await fetch(`${API_URL}/api/analyses`, { method: "POST", body: data }));
  } catch (error) {
    if (error instanceof TypeError) throw new Error("A conexão com o servidor foi interrompida. Aguarde alguns segundos e tente novamente.");
    throw error;
  }
}

export interface PartnerProject {
  id: string;
  name: string;
  municipality: string;
  project_type?: string;
  created_at: string;
  updated_at: string;
  versions: Array<{
    id: string;
    number: number;
    label: string;
    stage: "pre_protocol" | "submitted" | "municipal_return" | "revision";
    created_at: string;
    notes?: string;
    municipal_feedback: boolean;
    improvement_consent: boolean;
    documents: Array<{ name: string; content_type: string; size_bytes: number }>;
  }>;
  feedback: Array<{
    id: string;
    created_at: string;
    reference: string;
    verdict: "correct" | "partial" | "incorrect" | "unable_to_assess";
    comment: string;
  }>;
}

function partnerHeaders(token: string, json = false): HeadersInit {
  return { "X-Partner-Token": token, ...(json ? { "Content-Type": "application/json" } : {}) };
}

export interface TesterProfile {
  id: string; email: string; full_name?: string; professional_role?: string; city_state?: string;
  municipalities: string[]; project_types: string[]; has_project?: boolean; has_municipal_feedback?: boolean;
  interest?: string; source: "public_request" | "admin_invite";
  status: "requested" | "preapproved" | "active" | "rejected" | "suspended" | "invite_expired";
  created_at: string; updated_at: string; invite_expires_at?: string;
}

export async function requestTesterAccess(data: object) {
  return parseResponse<{ id: string; status: string; email: string }>(await fetch(`${API_URL}/api/homologation/access-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }));
}

export async function activateTester(data: object) {
  return parseResponse<{ token: string; email: string }>(await fetch(`${API_URL}/api/homologation/activate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  }));
}

function adminHeaders(key: string): HeadersInit { return { "X-Admin-Key": key, "Content-Type": "application/json" }; }
export async function listTesters(key: string) { return parseResponse<TesterProfile[]>(await fetch(`${API_URL}/api/homologation/admin/testers`, { headers: adminHeaders(key) })); }
export async function preapproveTester(key: string, data: { email: string; full_name?: string }) {
  return parseResponse<{ tester: TesterProfile; invite_code: string; expires_at: string }>(await fetch(`${API_URL}/api/homologation/admin/invites`, { method: "POST", headers: adminHeaders(key), body: JSON.stringify(data) }));
}
export async function approveTester(key: string, id: string) {
  return parseResponse<{ tester: TesterProfile; invite_code: string; expires_at: string }>(await fetch(`${API_URL}/api/homologation/admin/testers/${id}/approve`, { method: "POST", headers: adminHeaders(key) }));
}
export async function setTesterStatus(key: string, id: string, status: "active" | "rejected" | "suspended") {
  return parseResponse<TesterProfile>(await fetch(`${API_URL}/api/homologation/admin/testers/${id}/status?new_status=${status}`, { method: "POST", headers: adminHeaders(key) }));
}

export async function listPartnerProjects(token: string) {
  return parseResponse<PartnerProject[]>(await fetch(`${API_URL}/api/homologation/projects`, { headers: partnerHeaders(token) }));
}

export async function createPartnerProject(token: string, data: { name: string; municipality: string; project_type?: string }) {
  return parseResponse<PartnerProject>(await fetch(`${API_URL}/api/homologation/projects`, {
    method: "POST",
    headers: partnerHeaders(token, true),
    body: JSON.stringify(data),
  }));
}

export async function addProjectVersion(token: string, projectId: string, data: FormData) {
  return parseResponse<PartnerProject>(await fetch(`${API_URL}/api/homologation/projects/${projectId}/versions`, {
    method: "POST",
    headers: partnerHeaders(token),
    body: data,
  }));
}

export async function addPartnerFeedback(token: string, projectId: string, data: { reference: string; verdict: string; comment: string }) {
  return parseResponse<PartnerProject>(await fetch(`${API_URL}/api/homologation/projects/${projectId}/feedback`, {
    method: "POST",
    headers: partnerHeaders(token, true),
    body: JSON.stringify(data),
  }));
}
