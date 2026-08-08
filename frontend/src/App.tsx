import { FormEvent, useEffect, useState } from "react";
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

async function loadDemoWithRetry() {
  try {
    return await loadDemo();
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    return loadDemo();
  }
}

export default function App() {
  const [view, setView] = useState<View>("home");
  const [analysis, setAnalysis] = useState<DemoAnalysis | null>(null);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [estimatedSeconds, setEstimatedSeconds] = useState(60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [reportOrigin, setReportOrigin] = useState<"demo" | "upload">("demo");

  useEffect(() => {
    if (view !== "processing") return;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [view]);

  useEffect(() => {
    if (view !== "processing") return;
    const stepDuration = Math.max(1, estimatedSeconds / processingSteps.length);
    setActiveStep(Math.min(4, Math.floor(elapsedSeconds / stepDuration)));
  }, [elapsedSeconds, estimatedSeconds, view]);

  async function openDemo(resetEstimate = true) {
    setError("");
    if (resetEstimate) setEstimatedSeconds(60);
    setView("processing");
    setActiveStep(0);
    try {
      const data = await loadDemoWithRetry();
      setReportOrigin("demo");
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
    const files = Array.from(formData.values()).filter((value): value is File => value instanceof File && value.size > 0);
    const totalMegabytes = files.reduce((total, file) => total + file.size, 0) / (1024 * 1024);
    setEstimatedSeconds(Math.min(180, Math.max(60, Math.round(45 + files.length * 12 + totalMegabytes * 2))));
    setError("");
    setView("processing");
    let receipt: { id: string };
    try {
      receipt = await createAnalysis(formData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o projeto. Tente novamente.");
      setView("form");
      return;
    }

    try {
      const demonstration = await loadDemoWithRetry();
      setAnalysis({
        ...demonstration,
        id: receipt.id,
        project: {
          ...demonstration.project,
          name: String(formData.get("project_name") || demonstration.project.name),
          municipality: String(formData.get("municipality") || demonstration.project.municipality),
          project_type: String(formData.get("project_type") || demonstration.project.project_type),
          address: String(formData.get("address") || "Endereço não informado"),
          lot_area: Number(formData.get("lot_area")) || demonstration.project.lot_area,
          zoning: String(formData.get("zoning") || "Não informado"),
        },
      });
      setReportOrigin("upload");
      setActiveStep(4);
      setView("result");
    } catch (cause) {
      setError(`Os ${files.length} documentos foram recebidos, mas o relatório não pôde ser aberto agora. Código da análise: ${receipt.id}. Tente carregar a demonstração novamente.`);
      setView("form");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView("home")} aria-label="Voltar ao início">
          <span className="brand-mark">A+</span><span>Aprova<strong>+</strong></span>
        </button>
        {view === "home" && <>
          <nav className="main-nav" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <button onClick={() => openDemo()}>Demonstração</button>
            <a href="#planos">Planos</a>
          </nav>
          <button className="login-button" onClick={() => setView("form")}>Entrar</button>
        </>}
      </header>

      {view === "home" && (
        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow">Menos retrabalho. Mais aprovações.</div>
              <div className="availability">Disponível inicialmente para Barueri — SP</div>
              <h1 id="hero-title"><span>Aprove</span> seu projeto arquitetônico na Prefeitura <span>mais</span> rápido</h1>
              <p>Confira se seu projeto está pronto para aprovação na Prefeitura.</p>
              <div className="hero-actions">
                <button className="primary" onClick={() => setView("form")}>Nova Análise <span>→</span></button>
                <button className="secondary" onClick={() => openDemo()}>Carregar Demonstração</button>
              </div>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
            <div className="hero-visual" aria-hidden="true"><img src="/aprova-plus-hero.png" alt="" /></div>
            <div className="trust-row" aria-label="Indicadores de confiança">
              <span>✓ Análise baseada na legislação</span>
              <span>✓ Relatórios técnicos</span>
              <span>✓ Revisão humana recomendada</span>
            </div>
          </section>
          <section className="how-section" id="como-funciona">
            <div className="section-intro"><span>Como funciona</span><h2>Da planta ao protocolo, com mais segurança.</h2></div>
            <div className="process-flow">
              <article><span>01</span><h3>Envie os documentos</h3><p>Projeto, legislação e regulamentos em PDF.</p></article>
              <article><span>02</span><h3>Compare parâmetros</h3><p>Medidas e regras reunidas com suas fontes.</p></article>
              <article><span>03</span><h3>Revise o relatório</h3><p>Pendências priorizadas para apoiar sua equipe.</p></article>
            </div>
          </section>
          <section className="resources-section" id="recursos">
            <div className="section-intro"><span>Recursos para arquitetos</span><h2>Uma conferência técnica completa antes do protocolo.</h2></div>
            <div className="how-it-works">
              <article><span className="card-icon">📄</span><small>01</small><h3>Projeto</h3><p>Faça upload do projeto arquitetônico.</p></article>
              <article><span className="card-icon">🏛️</span><small>02</small><h3>Legislação de Barueri</h3><p>Confira o projeto com base na legislação municipal de Barueri — SP.</p></article>
              <article><span className="card-icon">📋</span><small>03</small><h3>Conferência Técnica</h3><p>Confira automaticamente os pontos que precisam de revisão antes do protocolo.</p></article>
              <article><span className="card-icon">✅</span><small>04</small><h3>Relatório Técnico</h3><p>Receba um checklist completo com recomendações para revisão.</p></article>
            </div>
          </section>
          <section className="plans-cta" id="planos">
            <div><span>Acesso gratuito na fase de testes</span><h2>Revise com mais segurança. Protocole com mais confiança.</h2><p>Todos os recursos estão gratuitos. Planos pagos serão apresentados somente quando a conferência estiver tecnicamente validada.</p></div>
            <button className="primary" onClick={() => setView("form")}>Nova Análise <span>→</span></button>
          </section>
        </main>
      )}

      {view === "form" && (
        <main className="page narrow">
          <button className="back" onClick={() => setView("home")}>← Voltar</button>
          <div className="page-heading"><span>Nova análise</span><h1>Conte-nos sobre o projeto</h1><p>Envie o conjunto de PDFs que compõe o processo. É necessário selecionar pelo menos um documento.</p></div>
          <form className="analysis-form" onSubmit={submitAnalysis}>
            <p className="required-legend"><span>*</span> Campos obrigatórios</p>
            <div className="form-grid">
              <label>Nome do projeto <span className="required-mark" aria-hidden="true">*</span><input name="project_name" required placeholder="Ex.: Residência Alameda" /></label>
              <label>Município atendido <span className="required-mark" aria-hidden="true">*</span><select name="municipality" required defaultValue="Barueri - SP"><option>Barueri - SP</option></select></label>
              <label>Tipo de projeto<select name="project_type" defaultValue="Residencial unifamiliar"><option>Residencial unifamiliar</option><option>Residencial multifamiliar</option><option>Comercial</option><option>Institucional</option></select></label>
              <label>Zoneamento<input name="zoning" placeholder="Quando conhecido" /></label>
              <label className="wide">Endereço<input name="address" placeholder="Logradouro, número e bairro" /></label>
              <label>Área do terreno (m²)<input name="lot_area" type="number" min="1" step="0.01" /></label>
            </div>
            <div className="document-help"><strong>Documentos do processo</strong><span>Selecione todas as pranchas, levantamentos, RRTs e demais PDFs que serão protocolados.</span></div>
            <div className="uploads">
              <MultiFileField name="project_pdf" title="Documentos do projeto" required />
              <FileField name="regulation_pdf" title="Legislação complementar" />
              <FileField name="condominium_pdf" title="Regulamento do condomínio" />
              <FileField name="descriptive_memorial_pdf" title="Memorial descritivo" />
            </div>
            <label className="terms-check"><input name="accepted_terms" type="checkbox" required /><span><b className="required-mark" aria-hidden="true">*</b> Li e aceito os <a href="/termos-de-uso.html" target="_blank">Termos de Uso</a> e o <a href="/aviso-de-privacidade.html" target="_blank">Aviso de Privacidade</a>. Os documentos não serão usados para treinamento sem uma autorização voluntária e separada.</span></label>
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
          <div className="processing-estimate" aria-live="polite">
            <strong>{elapsedSeconds < estimatedSeconds ? `Tempo estimado: ${formatDuration(estimatedSeconds - elapsedSeconds)}` : "Finalizando a análise…"}</strong>
            <span>O tempo pode variar conforme a quantidade e o tamanho dos PDFs.</span>
            <i><b style={{ width: `${Math.min(94, Math.max(4, (elapsedSeconds / estimatedSeconds) * 100))}%` }} /></i>
          </div>
          <div className="steps">{processingSteps.map((step, index) => <div className={index <= activeStep ? "step active" : "step"} key={step}><i>{index < activeStep ? "✓" : index + 1}</i><span>{step}</span></div>)}</div>
        </main>
      )}

      {view === "result" && analysis && <Result analysis={analysis} origin={reportOrigin} onRestart={() => setView("home")} />}

      <footer><span>© 2026 Aprova+ · Tecnologia de apoio à revisão técnica</span><nav><a href="/termos-de-uso.html">Termos de Uso</a><a href="/aviso-de-privacidade.html">Privacidade</a></nav></footer>
    </div>
  );
}

function FileField({ name, title, required = false }: { name: string; title: string; required?: boolean }) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const size = selectedFile ? formatFileSize(selectedFile.size) : null;

  return <label className={`file-field ${selectedFile ? "selected" : ""}`}>
    <span className="file-icon">{selectedFile ? "✓" : "PDF"}</span>
    <span className="file-copy">
      <strong>{title}{required && <span className="required-mark" aria-hidden="true"> *</span>}</strong>
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
      <strong>{title}{required && <span className="required-mark" aria-hidden="true"> *</span>}</strong>
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

function formatDuration(seconds: number) {
  if (seconds < 60) return `menos de ${Math.max(10, Math.ceil(seconds / 10) * 10)} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return `aproximadamente ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

function Result({ analysis, origin, onRestart }: { analysis: DemoAnalysis; origin: "demo" | "upload"; onRestart: () => void }) {
  const s = analysis.summary;
  const annotatedItems = analysis.items.filter((item) => item.annotation);
  return <main className="result-page">
    <div className="result-title"><div><span className="eyebrow">Relatório preliminar</span><h1>{analysis.project.name}</h1><p>{analysis.project.address} · {analysis.project.project_type}</p></div><button className="secondary" onClick={onRestart}>Nova análise</button></div>
    {origin === "upload" && <aside className="report-mode"><strong>Documentos recebidos com sucesso</strong><p>Esta versão ainda não executa a conferência técnica dos arquivos enviados. O relatório abaixo demonstra o formato final e as marcações que serão geradas quando o motor de análise estiver concluído.</p></aside>}
    <section className="score-panel">
      <div className="score-ring" style={{ "--score": `${s.score * 3.6}deg` } as React.CSSProperties}><div><strong>{s.score}</strong><small>/100</small></div></div>
      <div className="score-copy"><span>Índice preliminar de conformidade</span><h2>Revisão recomendada antes do protocolo</h2><p>A análise encontrou pontos que merecem ajuste e validação da equipe responsável.</p><div className="confidence"><span><i style={{ width: `${s.confidence}%` }} /></span>Confiança da análise automática: <strong>{s.confidence}%</strong></div></div>
      <div className="metrics"><Metric value={s.compliant} label="Conformes" tone="green" /><Metric value={s.warnings} label="Alertas" tone="yellow" /><Metric value={s.non_compliant} label="Não conformes" tone="red" /><Metric value={s.not_identified} label="Não identificado" tone="gray" /></div>
    </section>
    <section className="plan-review"><div className="section-title"><div><span>Conferência visual</span><h2>Marcações na planta</h2></div><small>Exemplo demonstrativo</small></div><div className="plan-review-grid"><div className="annotated-plan" aria-label="Planta demonstrativa com três marcações técnicas">{annotatedItems.map((item) => item.annotation && <a href={`#report-${item.id}`} className="plan-marker" style={{ left: `${item.annotation.x}%`, top: `${item.annotation.y}%` }} aria-label={`Ver apontamento ${item.annotation.marker}: ${item.topic}`} key={item.id}>{item.annotation.marker}</a>)}</div><ol className="annotation-list">{annotatedItems.map((item) => item.annotation && <li key={item.id}><a href={`#report-${item.id}`}><b>{item.annotation.marker}</b><span><strong>{item.topic}</strong>{item.annotation.comment}</span></a></li>)}</ol></div></section>
    <section className="report-card"><div className="section-title"><div><span>Análise detalhada</span><h2>Itens verificados</h2></div><small>{analysis.items.length} regras avaliadas</small></div><div className="table-wrap"><table><thead><tr><th>Item</th><th>Exigência</th><th>Projeto</th><th>Status</th><th>Fonte</th><th>Recomendação</th></tr></thead><tbody>{analysis.items.map(item => <tr key={item.id} id={`report-${item.id}`}><td><strong>{item.topic}</strong><small>{item.annotation ? `Marcação ${item.annotation.marker} na planta · ` : ""}{item.id}</small></td><td>{item.requirement}</td><td>{item.project_value}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span></td><td className="source">{item.source}</td><td>{item.annotation && <span className="annotation-comment">Comentário {item.annotation.marker}: {item.annotation.comment}</span>}{item.recommendation}</td></tr>)}</tbody></table></div></section>
    <aside className="disclaimer"><strong>Importante</strong><p>{analysis.disclaimer}</p></aside>
  </main>;
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}
