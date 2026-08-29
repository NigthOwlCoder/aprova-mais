import { FormEvent, useEffect, useState } from "react";
import {
  addPartnerFeedback,
  addProjectVersion,
  activateTester,
  createPartnerProject,
  listPartnerProjects,
  requestTesterAccess,
  type PartnerProject,
} from "./services/api";

const TOKEN_KEY = "confere_mais_partner_token";
const EMAIL_KEY = "confere_mais_partner_email";
const stageLabels = {
  pre_protocol: "Antes do protocolo",
  submitted: "Enviado à Prefeitura",
  municipal_return: "Retorno da Prefeitura",
  revision: "Revisão corrigida",
};
const verdictLabels = {
  correct: "Correto",
  partial: "Parcialmente correto",
  incorrect: "Incorreto",
  unable_to_assess: "Não consegui avaliar",
};

export default function PartnerPortal({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) ?? "");
  const [projects, setProjects] = useState<PartnerProject[]>([]);
  const [activeId, setActiveId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [accessMode, setAccessMode] = useState<"request" | "invite">("request");
  const [receipt, setReceipt] = useState("");
  const active = projects.find((project) => project.id === activeId);

  useEffect(() => {
    if (!token) return;
    listPartnerProjects(token).then(setProjects).catch(() => {
      localStorage.removeItem(TOKEN_KEY);
      setToken("");
    });
  }, [token]);

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const result = await requestTesterAccess({
        email: form.get("email"), full_name: form.get("full_name"), professional_role: form.get("professional_role"),
        city_state: form.get("city_state"), municipalities: String(form.get("municipalities")).split(",").map(v => v.trim()).filter(Boolean),
        project_types: form.getAll("project_types"), has_project: form.get("has_project") === "yes",
        has_municipal_feedback: form.get("has_municipal_feedback") === "yes", interest: form.get("interest") || null,
        accepted_terms: form.get("accepted_terms") === "on",
      });
      setReceipt(`Solicitação recebida para ${result.email}. Você poderá entrar depois que receber seu convite.`);
      event.currentTarget.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível enviar a solicitação."); }
    finally { setBusy(false); }
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const session = await activateTester({
        email: form.get("email"), invite_code: form.get("invite_code"), accepted_terms: form.get("accepted_terms") === "on",
        full_name: form.get("full_name"), professional_role: form.get("professional_role"), city_state: form.get("city_state"),
        municipalities: String(form.get("municipalities")).split(",").map(v => v.trim()).filter(Boolean),
        project_types: form.getAll("project_types"), has_project: form.get("has_project") === "yes",
        has_municipal_feedback: form.get("has_municipal_feedback") === "yes",
      });
      localStorage.setItem(TOKEN_KEY, session.token); localStorage.setItem(EMAIL_KEY, session.email);
      setEmail(session.email); setToken(session.token); setProjects([]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ativar o acesso."); }
    finally { setBusy(false); }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const project = await createPartnerProject(token, {
        name: String(form.get("name")), municipality: String(form.get("municipality")), project_type: String(form.get("project_type")),
      });
      formElement.reset(); setProjects((current) => [project, ...current]); setActiveId(project.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar o projeto."); }
    finally { setBusy(false); }
  }

  async function addVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active) return; const formElement = event.currentTarget; setBusy(true); setError("");
    try {
      const updated = await addProjectVersion(token, active.id, new FormData(formElement));
      formElement.reset(); setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar a versão."); }
    finally { setBusy(false); }
  }

  async function addFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!active) return; const formElement = event.currentTarget; setBusy(true); setError("");
    try {
      const form = new FormData(event.currentTarget);
      const updated = await addPartnerFeedback(token, active.id, {
        reference: String(form.get("reference")), verdict: String(form.get("verdict")), comment: String(form.get("comment")),
      });
      formElement.reset(); setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar a avaliação."); }
    finally { setBusy(false); }
  }

  function logout() { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(EMAIL_KEY); setToken(""); setEmail(""); setProjects([]); }

  if (!token) return <main className="partner-login access-page">
    <button className="back" onClick={onExit}>← Voltar ao site</button>
    <section><span className="eyebrow">Programa fechado de testes</span><h1>Área dos parceiros</h1><p>O acesso nesta fase é exclusivo para profissionais convidados ou aprovados pela equipe do Confere+.</p>
      <div className="access-tabs"><button className={accessMode === "request" ? "active" : ""} onClick={() => setAccessMode("request")}>Solicitar participação</button><button className={accessMode === "invite" ? "active" : ""} onClick={() => setAccessMode("invite")}>Já tenho convite</button></div>
      {accessMode === "request" ? <form className="access-form" onSubmit={requestAccess}>
        <label>E-mail *<input name="email" type="email" required /></label><label>Nome completo *<input name="full_name" required /></label>
        <label>Atuação profissional *<select name="professional_role" required><option value="">Selecione</option><option>Arquiteto(a)</option><option>Engenheiro(a)</option><option>Designer/Projetista</option><option>Outro profissional técnico</option></select></label>
        <label>Cidade e estado *<input name="city_state" required placeholder="Ex.: Barueri - SP" /></label>
        <label className="wide">Municípios em que atua *<input name="municipalities" required placeholder="Separe por vírgulas" /></label>
        <fieldset className="wide"><legend>Tipos de projeto *</legend>{["Obra nova", "Reforma ou ampliação", "Regularização", "Outro"].map(v => <label key={v}><input type="checkbox" name="project_types" value={v} /> {v}</label>)}</fieldset>
        <label>Tem projeto para testar agora? *<select name="has_project" required><option value="yes">Sim</option><option value="no">Não</option></select></label>
        <label>Tem retorno da Prefeitura? *<select name="has_municipal_feedback" required><option value="no">Não</option><option value="yes">Sim</option></select></label>
        <label className="wide">O que gostaria de testar? <textarea name="interest" maxLength={500} /></label>
        <label className="terms-check wide"><input name="accepted_terms" type="checkbox" required /><span>Li e aceito os <a href="/termos-de-uso.html" target="_blank">Termos de Uso</a> e o <a href="/aviso-de-privacidade.html" target="_blank">Aviso de Privacidade</a>.</span></label>
        <button className="primary wide" disabled={busy}>{busy ? "Enviando…" : "Solicitar acesso"}</button>
      </form> : <form className="access-form" onSubmit={activate}>
        <label>E-mail autorizado *<input name="email" type="email" required /></label><label>Código do convite *<input name="invite_code" required /></label>
        <label>Nome completo *<input name="full_name" required /></label><label>Atuação profissional *<input name="professional_role" required placeholder="Ex.: Arquiteta" /></label>
        <label>Cidade e estado *<input name="city_state" required /></label><label>Municípios em que atua<input name="municipalities" placeholder="Separe por vírgulas" /></label>
        <fieldset className="wide"><legend>Tipos de projeto</legend>{["Obra nova", "Reforma ou ampliação", "Regularização", "Outro"].map(v => <label key={v}><input type="checkbox" name="project_types" value={v} /> {v}</label>)}</fieldset>
        <input type="hidden" name="has_project" value="yes" /><input type="hidden" name="has_municipal_feedback" value="no" />
        <label className="terms-check wide"><input name="accepted_terms" type="checkbox" required /><span>Li e aceito os <a href="/termos-de-uso.html" target="_blank">Termos de Uso</a> e o <a href="/aviso-de-privacidade.html" target="_blank">Aviso de Privacidade</a>.</span></label>
        <button className="primary wide" disabled={busy}>{busy ? "Ativando…" : "Ativar meu acesso"}</button>
      </form>}
      <small>Solicitamos somente dados profissionais necessários para selecionar e acompanhar os testes.</small>{receipt && <p className="success-message">{receipt}</p>}{error && <p className="error">{error}</p>}
    </section>
  </main>;

  if (active) return <main className="partner-page">
    <div className="partner-toolbar"><button className="back" onClick={() => setActiveId("")}>← Todos os projetos</button><span>{email}</span></div>
    <div className="project-heading"><div><span className="eyebrow">Projeto em homologação</span><h1>{active.name}</h1><p>{active.municipality}{active.project_type ? ` · ${active.project_type}` : ""}</p></div><strong>Versão {active.versions.length || "—"}</strong></div>
    {error && <p className="error">{error}</p>}
    <div className="partner-columns">
      <section className="partner-card"><h2>Registrar nova versão</h2><p>Os nomes dos arquivos ficam vinculados à versão para garantir rastreabilidade.</p><form onSubmit={addVersion} className="stack-form">
        <label>Identificação da versão<input name="label" required placeholder="Ex.: Revisão 02 — retorno de 10/08" /></label>
        <label>Etapa<select name="stage" defaultValue="pre_protocol">{Object.entries(stageLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>PDFs ou fotos<input name="documents" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" multiple required /></label>
        <label>Observações<textarea name="notes" placeholder="O que mudou nesta versão?" /></label>
        <label className="inline-check"><input name="municipal_feedback" type="checkbox" /> Este envio contém retorno da Prefeitura</label>
        <label className="inline-check consent"><input name="improvement_consent" type="checkbox" /> Autorizo voluntariamente o uso desta devolutiva, após anonimização, para melhorar o Confere+.</label>
        <button className="primary" disabled={busy}>Registrar versão</button><small>O protótipo registra metadados e nomes; os arquivos originais não são mantidos nesta etapa.</small>
      </form></section>
      <section className="partner-card"><h2>Avaliar um apontamento</h2><p>Seu retorno permite medir acertos, alertas indevidos e itens não identificados.</p><form onSubmit={addFeedback} className="stack-form">
        <label>Referência<input name="reference" required placeholder="Ex.: Relatório 01 · item A3" /></label>
        <label>Sua avaliação<select name="verdict" defaultValue="correct">{Object.entries(verdictLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Comentário<textarea name="comment" required placeholder="Explique o motivo e, se possível, informe a fonte." /></label>
        <button className="secondary" disabled={busy}>Salvar avaliação</button>
      </form></section>
    </div>
    <section className="timeline"><div className="section-title"><div><span>Rastreabilidade</span><h2>Histórico do projeto</h2></div><small>{active.versions.length} versões · {active.feedback.length} avaliações</small></div>
      {!active.versions.length && <p className="empty-state">Comece registrando a primeira versão enviada para conferência.</p>}
      {active.versions.slice().reverse().map((version) => <article key={version.id}><b>V{version.number}</b><div><strong>{version.label}</strong><span>{stageLabels[version.stage]} · {new Date(version.created_at).toLocaleDateString("pt-BR")}</span><ul>{version.documents.map((file) => <li key={file.name}>{file.name} <small>{formatSize(file.size_bytes)}</small></li>)}</ul>{version.notes && <p>{version.notes}</p>}</div></article>)}
      {active.feedback.map((item) => <article className="feedback-entry" key={item.id}><b>✓</b><div><strong>{item.reference} · {verdictLabels[item.verdict]}</strong><span>{new Date(item.created_at).toLocaleDateString("pt-BR")}</span><p>{item.comment}</p></div></article>)}
    </section>
  </main>;

  return <main className="partner-page">
    <div className="partner-toolbar"><button className="back" onClick={onExit}>← Voltar ao site</button><div><span>{email}</span><button onClick={logout}>Sair</button></div></div>
    <div className="project-heading"><div><span className="eyebrow">Programa de homologação</span><h1>Seus projetos</h1><p>Centralize versões, devolutivas e avaliações técnicas.</p></div></div>
    {error && <p className="error">{error}</p>}
    <div className="partner-columns dashboard-columns"><section className="partner-card"><h2>Novo projeto</h2><form onSubmit={createProject} className="stack-form"><label>Nome do projeto<input name="name" required placeholder="Ex.: Residência Alameda" /></label><label>Município<input name="municipality" required placeholder="Ex.: Barueri - SP" /></label><label>Tipologia<input name="project_type" placeholder="Ex.: Residencial unifamiliar" /></label><button className="primary" disabled={busy}>Criar projeto</button></form></section>
      <section className="project-list"><h2>Projetos cadastrados</h2>{!projects.length && <p className="empty-state">Nenhum projeto cadastrado ainda.</p>}{projects.map((project) => <button key={project.id} onClick={() => setActiveId(project.id)}><span><strong>{project.name}</strong><small>{project.municipality} · {project.versions.length} versões</small></span><b>→</b></button>)}</section></div>
  </main>;
}

function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`; }
