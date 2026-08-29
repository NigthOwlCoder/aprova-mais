# Confere+

MVP para análise preliminar de conformidade de projetos arquitetônicos.

> Esta análise é preliminar e tem caráter informativo. O resultado não substitui a avaliação de um arquiteto, engenheiro, responsável técnico, condomínio ou órgão público competente.

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

O backend fica disponível em `http://127.0.0.1:8000` e a documentação em `http://127.0.0.1:8000/docs`.

## Frontend

```powershell
cd frontend
npm install
npm run dev
```

O frontend fica disponível em `http://localhost:5173`.

O botão **Carregar demonstração** apresenta o formato completo do relatório, incluindo marcações demonstrativas na planta. Para o funcionamento local, mantenha backend e frontend ativos em terminais separados.

Durante a fase atual de testes, o acesso é gratuito. Os planos pagos serão definidos somente depois da validação técnica do produto.

## Área de homologação

A opção **Área de parceiros** permite que profissionais solicitem participação ou ativem um convite previamente emitido. A administração aprova solicitações, pré-autoriza e-mails e pode suspender ou reativar acessos.

Depois da ativação, os parceiros podem:

- cadastrem seus projetos;
- registrem cada conjunto documental como uma versão identificada;
- enviem PDFs ou fotos de devolutivas da Prefeitura;
- avaliem os apontamentos como corretos, parciais, incorretos ou não avaliáveis;
- concedam, de forma separada e opcional, autorização para usar uma devolutiva anonimizada na melhoria do produto.

O sistema usa PostgreSQL quando `DATABASE_URL` está configurada e SQLite em `runtime_data/confere.db` apenas no desenvolvimento local. O Blueprint cria o banco PostgreSQL, conecta-o pela rede privada do Render e bloqueia conexões externas. Os arquivos originais enviados pela área de homologação não são retidos; ficam registrados somente nome, tipo, tamanho e histórico da versão.

Configure `CONFERE_ADMIN_KEY` com uma chave longa e exclusiva para habilitar o painel administrativo. Convites expiram em 72 horas e são vinculados ao e-mail autorizado. A chave administrativa atual é adequada somente para esta fase controlada; antes de ampliar o acesso, substitua-a por autenticação administrativa completa e banco PostgreSQL.

## Proteção de dados e treinamento

- [Regra de proteção de dados](PROTECAO_DE_DADOS.md)
- [Aviso de privacidade](AVISO_DE_PRIVACIDADE.md)
- [Termos de uso](TERMOS_DE_USO.md)
- [Estratégia de treinamento](ESTRATEGIA_DE_TREINAMENTO.md)

Nenhum arquivo é usado para treinamento sem autorização voluntária, específica e individual por projeto. Na implementação atual, os PDFs originais são removidos depois da extração de texto e o registro da análise tem retenção operacional de até 24 horas.

## Publicação no Render

O arquivo `render.yaml` configura o Confere+ como um único Web Service. O Render instala o backend, compila o frontend e disponibiliza ambos no mesmo endereço público.

Durante a homologação inicial, o Blueprint cria um PostgreSQL gratuito com 1 GB e acesso somente pela rede privada. Bancos gratuitos do Render expiram após 30 dias: exporte os dados ou migre para um plano pago antes da data indicada no painel. `DATABASE_URL` é conectada automaticamente. Defina `CONFERE_ADMIN_KEY` manualmente no ambiente do serviço e nunca registre essa chave no Git.

1. Envie esta pasta para um repositório no GitHub.
2. No Render, selecione **New > Blueprint**.
3. Conecte o repositório e confirme o serviço definido em `render.yaml`.
4. Para o MVP, deixe `OPENAI_API_KEY` e `OPENAI_MODEL` vazios e mantenha `DEMO_MODE=true`.

O armazenamento do Render gratuito é efêmero. Antes do uso em produção, será necessário adotar armazenamento protegido para relatórios, autenticação, controle de acesso, exclusão solicitada pelo usuário e registro das autorizações voluntárias.
