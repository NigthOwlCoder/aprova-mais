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
