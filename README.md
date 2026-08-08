# Aprova+

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

## Proteção de dados e treinamento

- [Regra de proteção de dados](PROTECAO_DE_DADOS.md)
- [Aviso de privacidade](AVISO_DE_PRIVACIDADE.md)
- [Termos de uso](TERMOS_DE_USO.md)
- [Estratégia de treinamento](ESTRATEGIA_DE_TREINAMENTO.md)

Nenhum arquivo é usado para treinamento sem autorização voluntária, específica e individual por projeto. Na implementação atual, os PDFs originais são removidos depois da extração de texto e o registro da análise tem retenção operacional de até 24 horas.

## Publicação no Render

O arquivo `render.yaml` configura o Aprova+ como um único Web Service. O Render instala o backend, compila o frontend e disponibiliza ambos no mesmo endereço público.

1. Envie esta pasta para um repositório no GitHub.
2. No Render, selecione **New > Blueprint**.
3. Conecte o repositório e confirme o serviço definido em `render.yaml`.
4. Para o MVP, deixe `OPENAI_API_KEY` e `OPENAI_MODEL` vazios e mantenha `DEMO_MODE=true`.

O armazenamento do Render gratuito é efêmero. Antes do uso em produção, será necessário adotar armazenamento protegido para relatórios, autenticação, controle de acesso, exclusão solicitada pelo usuário e registro das autorizações voluntárias.
