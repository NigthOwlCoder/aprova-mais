import { FormEvent, useState } from "react";
import { createAnalysis, loadDemo } from "./services/api";
import type { DemoAnalysis, ItemStatus } from "./types/analysis";

type View = "home" | "form" | "processing" | "result";

const statusLabel: Record<ItemStatus, string> = {
  COMPLIANT: "Conforme",
  WARNING: "Alerta",
  NON_COMPLIANT: "Não conforme",
  NOT_IDENTIFIED: "Não identificado",
};

const processingSteps = [
  "Lendo documentos",
  "Identificando legislação",
  "Extraindo parâmetros do projeto",
  "Comparando projeto e regras",
  "Gerando relatório",
];

export default function App() {
  const [view, setView] = useState<View>("home");
  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0);

  async function openDemo() {
    setError("");
    setView("processing");
    setActiveStep(0);
    try {
      const stepTimer = window.setInterval(() => setActiveStep((step) => Math.min(step + 1, 4)), 260);
      const data = await loadDemo();
      window.clearInterval(stepTimer);
      setActiveStep(4);
      window.setTimeout(() => { setAnalysis(data); setView("result"); }, 300);
    } catch {
      setError("Não foi possível acessar o modo demonstração. Confirme se o backend está ativo.");
      setView("home");
    }
  }

  async function submitAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    setView("processing");
    try {
      await createAnalysis(formData);
      await openDemo();
    } catch {
      setError("Não foi possível enviar o projeto. Revise o PDF e tente novamente.");
      setView("form");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="Voltar ao início">
          <span className="brand-mark">A+</span><span>Aprova<strong>+</strong></span>
        </button>
        <span className="beta">MVP • análise preliminar</span>
      </header>

      {view === "home" && (
        <main>
          <section className="hero">
            <div className="eyebrow">Inteligência aplicada à arquitetura</div>
            <h1>Antecipe pendências.<br /><span>Reduza retrabalho.</span></h1>
            <p>Validação inteligente de projetos arquitetônicos antes do protocolo na prefeitura, com referências claras e revisão humana no centro da decisão.</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setView("form")}>Nova análise <span>→</span></button>
              <button className="secondary" onClick={openDemo}>Carregar demonstração</button>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </section>
          <section className="how-it-works">
            <article><span>01</span><h3>Envie os documentos</h3><p>Projeto, legislação e regulamentos em PDF.</p></article>
            <article><span>02</span><h3>Compare parâmetros</h3><p>Medidas e regras reunidas com suas fontes.</p></article>
            <article><span>03</span><h3>Revise o relatório</h3><p>Pendências priorizadas para apoiar sua equipe.</p></article>
          </section>
        </main>
      )}

      {view === "form" && (
        <main className="page narrow">
          <button className="back" onClick={() => setView("home")}>← Voltar</button>
          <div className="page-heading"><span>Nova análise</span><h1>Conte-nos sobre o projeto</h1><p>Envie o conjunto de PDFs que compõe o processo. É necessário selecionar pelo menos um documento.</p></div>
          <form className="analysis-form" onSubmit={submitAnalysis}>
            <div className="form-grid">
              <label>Nome do projeto<input name="project_name" required placeholder="Ex.: Residência Alameda" /></label>
              <label>Município<input name="municipality" required defaultValue="Barueri" /></label>
              <label>Tipo de projeto<select name="project_type" defaultValue="Residencial unifamiliar"><option>Residencial unifamiliar</option><option>Residencial multifamiliar</option><option>Comercial</option><option>Institucional</option></select></label>
              <label>Zoneamento<input name="zoning" placeholder="Quando conhecido" /></label>
              <label className="wide">Endereço<input name="address" placeholder="Logradouro, número e bairro" /></label>
              <label>Área do terreno (m²)<input name="lot_area" type="number" min="1" step="0.01" /></label>
            </div>
            <div className="document-help"><strong>Documentos do processo</strong><span>Selecione todas as pranchas, levantamentos, RRTs e demais PDFs que serão protocolados.</span></div>
            <div className="uploads">
              <MultiFileField name="project_pdf" title="Documentos do projeto" required />
              <FileField name="regulation_pdf" title="Legislação municipal" />
              <FileField name="condominium_pdf" title="Regulamento do condomínio" />
              <FileField name="descriptive_memorial_pdf" title="Memorial descritivo" />
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="primary submit" type="submit">Analisar projeto <span>→</span></button>
          </form>
        </main>
      )}

      {view === "processing" && (
        <main className="processing">
          <div className="scan-icon"><span /></div>
          <p className="eyebrow">Análise em andamento</p>
          <h1>Estamos revisando seu projeto</h1>
          <div className="steps">{processingSteps.map((step, index) => <div className={index <= activeStep ? "step active" : "step"} key={step}><i>{index < activeStep ? "✓" : index + 1}</i><span>{step}</span></div>)}</div>
        </main>
      )}

      {view === "result" && analysis && <Result analysis={analysis} onRestart={() => setView("home")} />}

      <footer>© 2026 Aprova+ · Tecnologia de apoio à revisão técnica</footer>
    </div>
  );
}

function FileField({ name, title, required = false }: { name: string; title: string; required?: boolean }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const size = selectedFile ? formatFileSize(selectedFile.size) : null;

  return <label className={`file-field ${selectedFile ? "selected" : ""}`}>
    <span className="file-icon">{selectedFile ? "✓" : "PDF"}</span>
    <span className="file-copy">
      <strong>{title}</strong>
      {selectedFile
        ? <small className="selected-name" title={selectedFile.name}>{selectedFile.name}<em>{size} · arquivo selecionado</em></small>
        : <small>{required ? "Obrigatório" : "Opcional"} · clique para escolher</small>}
    </span>
    <span className="file-action">{selectedFile ? "Trocar" : "Selecionar"}</span>
    <input name={name} type="file" accept="application/pdf,.pdf" required={required} onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
  </label>;
}

function MultiFileField({ name, title, required = false }: { name: string; title: string; required?: boolean }) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const totalSize = selectedFiles.reduce((total, file) => total + file.size, 0);

  return <label className={`file-field multi-file ${selectedFiles.length ? "selected" : ""}`}>
    <span className="file-icon">{selectedFiles.length ? selectedFiles.length : "PDF"}</span>
    <span className="file-copy">
      <strong>{title}</strong>
      {selectedFiles.length
        ? <span className="file-list">{selectedFiles.map((file) => <small className="selected-name" title={file.name} key={`${file.name}-${file.size}`}><b>✓</b> {file.name}</small>)}<em>{selectedFiles.length} arquivos · {formatFileSize(totalSize)} no total</em></span>
        : <small>{required ? "Obrigatório" : "Opcional"} · selecione um ou vários PDFs</small>}
    </span>
    <span className="file-action">{selectedFiles.length ? "Alterar seleção" : "Selecionar arquivos"}</span>
    <input name={name} type="file" accept="application/pdf,.pdf" multiple required={required} onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))} />
  </label>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function Result({ analysis, onRestart }: { analysis: DemoAnalysis; onRestart: () => void }) {
  const s = analysis.summary;
  return <main className="result-page">
    <div className="result-title"><div><span className="eyebrow">Relatório preliminar</span><h1>{analysis.project.name}</h1><p>{analysis.project.address} · {analysis.project.project_type}</p></div><button className="secondary" onClick={onRestart}>Nova análise</button></div>
    <section className="score-panel">
      <div className="score-ring" style={{ "--score": `${s.score * 3.6}deg` } as React.CSSProperties}><div><strong>{s.score}</strong><small>/100</small></div></div>
      <div className="score-copy"><span>Índice preliminar de conformidade</span><h2>Revisão recomendada antes do protocolo</h2><p>A análise encontrou pontos que merecem ajuste e validação da equipe responsável.</p><div className="confidence"><span><i style={{ width: `${s.confidence}%` }} /></span>Confiança da análise automática: <strong>{s.confidence}%</strong></div></div>
      <div className="metrics"><Metric value={s.compliant} label="Conformes" tone="green" /><Metric value={s.warnings} label="Alertas" tone="yellow" /><Metric value={s.non_compliant} label="Não conformes" tone="red" /><Metric value={s.not_identified} label="Não identificado" tone="gray" /></div>
    </section>
    <section className="report-card"><div className="section-title"><div><span>Análise detalhada</span><h2>Itens verificados</h2></div><small>{analysis.items.length} regras avaliadas</small></div><div className="table-wrap"><table><thead><tr><th>Item</th><th>Exigência</th><th>Projeto</th><th>Status</th><th>Fonte</th><th>Recomendação</th></tr></thead><tbody>{analysis.items.map(item => <tr key={item.id}><td><strong>{item.topic}</strong><small>{item.id}</small></td><td>{item.requirement}</td><td>{item.project_value}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span></td><td className="source">{item.source}</td><td>{item.recommendation}</td></tr>)}</tbody></table></div></section>
    <aside className="disclaimer"><strong>Importante</strong><p>{analysis.disclaimer}</p></aside>
  </main>;
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}
