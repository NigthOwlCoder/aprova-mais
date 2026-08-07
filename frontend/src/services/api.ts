import type { DemoAnalysis } from "../types/analysis";

const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "" : "http://127.0.0.1:8000");

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error("Não foi possível concluir a solicitação.");
  return response.json() as Promise<T>;
}

export async function loadDemo(): Promise<DemoAnalysis> {
  return parseResponse<DemoAnalysis>(await fetch(`${API_URL}/api/analyses/demo`));
}

export async function createAnalysis(data: FormData): Promise<{ id: string }> {
  return parseResponse<{ id: string }>(await fetch(`${API_URL}/api/analyses`, { method: "POST", body: data }));
}
