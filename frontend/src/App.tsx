import { FormEvent, useEffect, useState } from "react";
import { createAnalysis, loadDemo } from "./services/api";
import type { DemoAnalysis, ItemStatus } from "./types/analysis";
import PartnerPortal from "./PartnerPortal";
import AdminPortal from "./AdminPortal";

type View = "home" | "form" | "processing" | "result" | "partner" | "admin";

const statusLabel: Record<ItemStatus, string> = {
  COMPLIANT: "Critério aparentemente atendido",
  WARNING: "Requer revisão",
  NON_COMPLIANT: "Requer revisão",
  NOT_IDENTIFIED: "Não foi possível verificar",
};

const processingSteps = [
  "Lendo documentos",
  "Consultando as regras cadastradas na plataforma",
  "Extraindo parâmetros do projeto",
  "Preparando relatório demonstrativo",
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
  const [municipalityChoice, setMunicipalityChoice] = useState<"barueri" | "jundiai" | "campinas" | "other">("barueri");
  const [otherMunicipality, setOtherMunicipality] = useState("");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [view]);

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
    for (const [key, value] of Array.from(formData.entries())) {
      if (value instanceof File && value.size === 0 && !value.name) formData.delete(key);
    }
    const files = Array.from(formData.values()).filter((value): value is File => value instanceof File && value.size > 0);
    const totalMegabytes = files.reduce((total, file) => total + file.size, 0) / (1024 * 1024);
    setEstimatedSeconds(Math.min(180, Math.max(60, Math.round(45 + files.length * 12 + totalMegabytes * 2))));
    setError("");
    setView("processing");
    let receipt: { id: string };
    try {
      const token = localStorage.getItem("confere_mais_partner_token") ?? "";
      const partnerEmail = localStorage.getItem("confere_mais_partner_email") ?? "";
      if (!token || !partnerEmail) throw new Error("Entre na Área de teste antes de iniciar uma análise.");
      formData.set("contact_email", partnerEmail);
      receipt = await createAnalysis(formData, token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar o projeto. Tente novamente.");
      setView("form");
      return;
    }

    try {
      const demonstration = await loadDemoWithRetry();
      const municipality = String(formData.get("municipality") || demonstration.project.municipality);
      setAnalysis({
        ...demonstration,
        id: receipt.id,
        project: {
          ...demonstration.project,
          name: String(formData.get("project_name") || demonstration.project.name),
          municipality,
          project_type: String(formData.get("project_type") || demonstration.project.project_type),
          address: String(formData.get("address") || "Endereço não informado"),
          lot_area: Number(formData.get("lot_area")) || demonstration.project.lot_area,
          zoning: String(formData.get("zoning") || "Não informado"),
        },
        legislation_basis: municipality === "Barueri - SP"
          ? demonstration.legislation_basis
          : municipality === "Jundiaí - SP"
            ? {
                title: "Base municipal de Jundiaí",
                version: "Código de Obras LC 606/2021 consolidado até a LC 627/2023; Plano Diretor Lei 9.321/2019 consolidado até a Lei 10.177/2024",
                source: "https://jundiai.sp.gov.br/planejamento-e-meio-ambiente/obras-particulares/legislacao/",
                registered_at: "09/08/2026",
              }
            : municipality === "Campinas - SP"
              ? {
                  title: "Base municipal de Campinas",
                  version: "LC 9/2003, LC 189/2018, LC 208/2018, LC 295/2020, Decreto 23.443/2024 atualizado pelo Decreto 24.118/2025, LC 560/2025 e Resolução 1/2019-Seplurb",
                  source: "https://portal-adm.campinas.sp.gov.br/servico/consultar-cartilha-e-modelos-para-aprovacao-de-projetos",
                  registered_at: "09/08/2026",
                }
              : {
              title: "Legislação local enviada pelo usuário",
              version: "Arquivo fornecido nesta análise",
              source: "#",
              registered_at: new Date().toLocaleDateString("pt-BR"),
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
          <span className="brand-mark">C+</span><span>Confere<strong>+</strong></span>
        </button>
        {view === "home" && <>
          <nav className="main-nav" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#recursos">Recursos</a>
            <button onClick={() => openDemo()}>Demonstração</button>
            <a href="#planos">Planos</a>
          </nav>
          <button className="login-button" onClick={() => setView("partner")}>Área de teste</button>
        </>}
      </header>

      {view === "home" && (
        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow">Menos retrabalho. Mais clareza antes do protocolo.</div>
              <div className="availability">Bases municipais cadastradas: Barueri, Jundiaí e Campinas — SP</div>
              <h1 id="hero-title"><span>Prepare</span> seu projeto para aprovação na Prefeitura</h1>
              <p>Evite retrabalho. Faça uma conferência preliminar dos documentos e requisitos antes do protocolo.</p>
              <div className="legal-notices">
                <p><strong>Ferramenta independente de apoio à revisão.</strong> Não possui vínculo com prefeituras, condomínios ou órgãos públicos. O resultado é preliminar, não constitui aprovação, laudo ou parecer técnico e não substitui a avaliação do responsável técnico nem a decisão do órgão competente.</p>
                <p><strong>Versão demonstrativa:</strong> os documentos enviados ainda não são submetidos a uma conferência técnica completa. O relatório apresentado demonstra o formato previsto para o serviço.</p>
              </div>
              <div className="hero-actions">
                <button className="primary" onClick={() => setView("partner")}>Acessar área de teste <span>→</span></button>
                <button className="secondary" onClick={() => openDemo()}>Carregar Demonstração</button>
              </div>
              {error && <p className="error" role="alert">{error}</p>}
            </div>
            <div className="hero-visual" aria-hidden="true"><img src="/confere-mais-hero.png" alt="" /></div>
            <div className="trust-row" aria-label="Características do serviço">
              <span>✓ Análise baseada na legislação</span>
              <span>✓ Relatórios técnicos</span>
              <span>✓ Revisão humana recomendada</span>
            </div>
          </section>
          <section className="how-section" id="como-funciona">
            <div className="section-intro"><span>Como funciona</span><h2>Do envio dos documentos à organização das revisões.</h2></div>
            <div className="workflow-phase">
              <div className="phase-label"><b>Antes do protocolo</b><span>Prepare um conjunto documental consistente</span></div>
              <div className="process-flow">
                <article><span>01</span><h3>Organize a versão</h3><p>Envie plantas e documentos com o nome completo de cada arquivo.</p></article>
                <article><span>02</span><h3>Confira a completude</h3><p>Identifique arquivos ausentes, repetidos, ilegíveis ou mantidos da versão anterior.</p></article>
                <article><span>03</span><h3>Revise as pendências</h3><p>Receba primeiro os pontos que requerem revisão, com fontes e recomendações.</p></article>
              </div>
            </div>
            <div className="workflow-phase return-phase">
              <div className="phase-label"><b>Se a Prefeitura solicitar correções</b><span>Transforme o retorno em um plano de revisão</span></div>
              <div className="process-flow">
                <article><span>04</span><h3>Envie o retorno</h3><p>Adicione o PDF ou fotografe as folhas físicas recebidas da Prefeitura.</p></article>
                <article><span>05</span><h3>Organize o checklist</h3><p>As marcações são reunidas por prancha, página e arquivo de origem.</p></article>
                <article><span>06</span><h3>Confira as correções realizadas</h3><p>Compare a nova versão e confira o tratamento dado a cada exigência.</p></article>
              </div>
            </div>
          </section>
          <section className="resources-section" id="recursos">
            <div className="section-intro"><span>Recursos para arquitetos</span><h2>Controle técnico e histórico em cada revisão.</h2></div>
            <div className="how-it-works">
              <article><span className="card-icon" aria-hidden="true">V</span><small>01</small><h3>Versões organizadas</h3><p>Saiba quais arquivos são novos, substituídos ou mantidos da revisão anterior.</p></article>
              <article><span className="card-icon" aria-hidden="true">✓</span><small>02</small><h3>Screening de completude</h3><p>Confirme a composição documental antes de iniciar a conferência técnica.</p></article>
              <article><span className="card-icon" aria-hidden="true">§</span><small>03</small><h3>Base normativa</h3><p>Consulte a legislação utilizada e as possíveis divergências entre regras.</p></article>
              <article><span className="card-icon" aria-hidden="true">↺</span><small>04</small><h3>Histórico de correções</h3><p>Acompanhe exigências da Prefeitura e confira o que mudou em cada arquivo.</p></article>
            </div>
          </section>
          <section className="plans-cta" id="planos">
            <div><span>Acesso gratuito na fase de testes</span><h2>Revise com mais segurança. Organize melhor o protocolo.</h2><p>Todos os recursos estão gratuitos. Planos pagos serão apresentados somente quando a conferência estiver tecnicamente implementada e testada.</p></div>
            <button className="primary" onClick={() => setView("partner")}>Acessar área de teste <span>→</span></button>
          </section>
        </main>
      )}

      {view === "form" && (
        <main className="page narrow">
          <button className="back" onClick={() => setView("home")}>← Voltar</button>
          <div className="page-heading"><span>Nova análise</span><h1>Conte-nos sobre o projeto</h1><p>Envie o conjunto de PDFs que compõe o processo. É necessário selecionar pelo menos um documento.</p></div>
          <div className="pre-upload-notices" role="note">
            <p><strong>Ferramenta independente de apoio à revisão.</strong> Não possui vínculo com prefeituras, condomínios ou órgãos públicos. O resultado é preliminar, não constitui aprovação, laudo ou parecer técnico e não substitui a avaliação do responsável técnico nem a decisão do órgão competente.</p>
            <p><strong>Versão demonstrativa:</strong> os documentos enviados ainda não são submetidos a uma conferência técnica completa. O relatório apresentado demonstra o formato previsto para o serviço.</p>
          </div>
          <form className="analysis-form" onSubmit={submitAnalysis}>
            <p className="required-legend"><span>*</span> Campos obrigatórios</p>
            <div className="form-grid">
              <label>Nome do projeto <span className="required-mark" aria-hidden="true">*</span><input name="project_name" required placeholder="Ex.: Residência Alameda" /></label>
              <label>Município atendido <span className="required-mark" aria-hidden="true">*</span><select required value={municipalityChoice} onChange={(event) => setMunicipalityChoice(event.target.value as "barueri" | "jundiai" | "campinas" | "other")}><option value="barueri">Barueri - SP</option><option value="jundiai">Jundiaí - SP</option><option value="campinas">Campinas - SP</option><option value="other">Outro município</option></select></label>
              {municipalityChoice === "other" && <label>Qual município? <span className="required-mark" aria-hidden="true">*</span><input name="municipality" required value={otherMunicipality} onChange={(event) => setOtherMunicipality(event.target.value)} placeholder="Ex.: Osasco - SP" /></label>}
              {municipalityChoice === "barueri" && <input type="hidden" name="municipality" value="Barueri - SP" />}
              {municipalityChoice === "jundiai" && <input type="hidden" name="municipality" value="Jundiaí - SP" />}
              {municipalityChoice === "campinas" && <input type="hidden" name="municipality" value="Campinas - SP" />}
              <label>Tipo de projeto<select name="project_type" defaultValue="Residencial unifamiliar"><option>Residencial unifamiliar</option><option>Residencial multifamiliar</option><option>Comercial</option><option>Institucional</option></select></label>
              <label>Zoneamento<input name="zoning" placeholder="Quando conhecido" /></label>
              <label className="wide">Endereço<input name="address" placeholder="Logradouro, número e bairro" /></label>
              <label>Área do terreno (m²)<input name="lot_area" type="number" min="1" step="0.01" /></label>
            </div>
            <div className="document-help"><strong>Documentos do processo</strong><span>Selecione todas as pranchas, levantamentos, RRTs e demais PDFs que serão protocolados.</span></div>
            <div className="uploads">
              <MultiFileField name="project_pdf" title="Documentos do projeto" required />
              {municipalityChoice === "barueri" && <div className="municipal-basis"><span>✓</span><div><strong>Base municipal de Barueri incluída</strong><small>Código de Edificações — alteração LC nº 349/2015 · base cadastrada em 08/08/2026</small></div></div>}
              {municipalityChoice === "jundiai" && <div className="municipal-basis"><span>✓</span><div><strong>Base municipal de Jundiaí incluída</strong><small>LC 606/2021 até LC 627/2023 + Plano Diretor Lei 9.321/2019 até Lei 10.177/2024 · cadastrada em 09/08/2026</small></div></div>}
              {municipalityChoice === "campinas" && <div className="municipal-basis"><span>✓</span><div><strong>Base municipal de Campinas incluída</strong><small>Código de Obras, LUOS, regra da APA, projeto simplificado e EIV/RIV · textos oficiais verificados em 09/08/2026</small></div></div>}
              {municipalityChoice === "other" && <FileField name="regulation_pdf" title="Legislação local" required />}
              <FileField name="condominium_pdf" title="Regulamento do condomínio" />
              <FileField name="descriptive_memorial_pdf" title="Memorial descritivo" />
            </div>
            <label className="terms-check"><input name="accepted_terms" type="checkbox" required /><span><b className="required-mark" aria-hidden="true">*</b> Li e aceito os <a href="/termos-de-uso.html" target="_blank">Termos de Uso</a> e o <a href="/aviso-de-privacidade.html" target="_blank">Aviso de Privacidade</a>.</span></label>
            <label className="terms-check"><input name="training_consent" type="checkbox" required /><span><b className="required-mark" aria-hidden="true">*</b> Li o <a href="/consentimento-aprendizagem.html" target="_blank">Termo de Consentimento</a> e autorizo o uso das plantas, documentos e retornos da Prefeitura deste envio para desenvolvimento, treinamento, teste, avaliação e aprimoramento do Confere+. Declaro possuir as autorizações necessárias.</span></label>
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

      {view === "partner" && <PartnerPortal onExit={() => setView("home")} onNewAnalysis={() => setView("form")} />}
      {view === "admin" && <AdminPortal onExit={() => setView("home")} />}

      {view === "result" && analysis && <Result analysis={analysis} origin={reportOrigin} onRestart={() => setView("home")} />}

      <footer><span>© 2026 Confere+ · Tecnologia de apoio à revisão técnica</span><nav><a href="mailto:contato.conferemais@gmail.com">Contato</a><a href="/termos-de-uso.html">Termos de Uso</a><a href="/aviso-de-privacidade.html">Privacidade</a><a href="/consentimento-aprendizagem.html">Consentimento</a><button className="footer-admin" onClick={() => setView("admin")}>Administração</button></nav></footer>
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
    <div className="result-title"><div><span className="eyebrow">Relatório preliminar</span><h1>{analysis.project.name}</h1><p>{analysis.project.municipality} · {analysis.project.address} · {analysis.project.project_type}</p></div><button className="secondary" onClick={onRestart}>Nova análise</button></div>
    {origin === "upload" && <aside className="report-mode"><strong>Documentos recebidos com sucesso</strong><p>Esta versão ainda não executa a conferência técnica dos arquivos enviados. O relatório abaixo demonstra o formato final e as marcações que serão geradas quando o motor de análise estiver concluído.</p></aside>}
    {analysis.legislation_basis && <section className="legislation-basis"><span>Base legal utilizada</span><strong>{analysis.legislation_basis.title}</strong><p>{analysis.legislation_basis.version} · cadastrada em {analysis.legislation_basis.registered_at}</p>{analysis.legislation_basis.source !== "#" && <a href={analysis.legislation_basis.source} target="_blank" rel="noreferrer">Consultar fonte oficial</a>}</section>}
    <section className="score-panel">
      <div className="score-ring" style={{ "--score": `${s.score * 3.6}deg` } as React.CSSProperties}><div><strong>{s.score}</strong><small>/100</small></div></div>
      <div className="score-copy"><span>Indicador preliminar de atendimento aos critérios analisados</span><h2>Revisão recomendada antes do protocolo</h2><p>O demonstrativo apresenta pontos que merecem conferência da equipe responsável.</p></div>
      <div className="metrics"><Metric value={s.compliant} label="Aparentemente atendidos" tone="green" /><Metric value={s.warnings + s.non_compliant} label="Requerem revisão" tone="red" /><Metric value={s.not_identified} label="Não verificados" tone="gray" /></div>
    </section>
    <section className="plan-review"><div className="section-title"><div><span>Conferência visual</span><h2>Marcações na planta</h2></div><small>Exemplo demonstrativo</small></div><div className="plan-review-grid"><div className="annotated-plan" aria-label="Planta demonstrativa com três marcações técnicas">{annotatedItems.map((item) => item.annotation && <a href={`#report-${item.id}`} className="plan-marker" style={{ left: `${item.annotation.x}%`, top: `${item.annotation.y}%` }} aria-label={`Ver apontamento ${item.annotation.marker}: ${item.topic}`} key={item.id}>{item.annotation.marker}</a>)}</div><ol className="annotation-list">{annotatedItems.map((item) => item.annotation && <li key={item.id}><a href={`#report-${item.id}`}><b>{item.annotation.marker}</b><span><strong>{item.topic}</strong>{item.annotation.comment}</span></a></li>)}</ol></div></section>
    <section className="report-card"><div className="section-title"><div><span>Conferência demonstrativa</span><h2>Critérios exibidos</h2><p className="status-explanation">“Não foi possível verificar” significa que o critério não foi analisado com os dados disponíveis; não significa que ele deixou de ser atendido.</p></div><small>{analysis.items.length} critérios no exemplo</small></div><div className="table-wrap"><table><thead><tr><th>Item</th><th>Exigência</th><th>Projeto</th><th>Classificação preliminar</th><th>Fonte consultada</th><th>Recomendação</th></tr></thead><tbody>{analysis.items.map(item => <tr key={item.id} id={`report-${item.id}`}><td><strong>{item.topic}</strong><small>{item.annotation ? `Marcação ${item.annotation.marker} na planta · ` : ""}{item.id}</small></td><td>{item.requirement}</td><td>{item.project_value}</td><td><span className={`badge ${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span></td><td className="source">{item.source}</td><td>{item.annotation && <span className="annotation-comment">Comentário {item.annotation.marker}: {item.annotation.comment}</span>}{item.recommendation}</td></tr>)}</tbody></table></div></section>
    <aside className="disclaimer"><strong>Ferramenta independente</strong><p>O resultado é preliminar, não constitui aprovação, laudo ou parecer técnico, não substitui o responsável técnico ou o órgão competente e não possui vínculo com prefeituras ou condomínios. {analysis.disclaimer}</p></aside>
  </main>;
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}
