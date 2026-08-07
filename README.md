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

O botão **Carregar demonstração** apresenta uma análise completa sem exigir chave de IA ou upload de arquivos. Para o funcionamento local, mantenha backend e frontend ativos em terminais separados.

## Publicação no Render

O arquivo `render.yaml` configura o Aprova+ como um único Web Service. O Render instala o backend, compila o frontend e disponibiliza ambos no mesmo endereço público.

1. Envie esta pasta para um repositório no GitHub.
2. No Render, selecione **New > Blueprint**.
3. Conecte o repositório e confirme o serviço definido em `render.yaml`.
4. Para o MVP, deixe `OPENAI_API_KEY` e `OPENAI_MODEL` vazios e mantenha `DEMO_MODE=true`.

Os arquivos enviados são armazenados no disco local da instância e podem ser removidos quando o serviço reiniciar. Esse comportamento é aceitável para a demonstração, mas deve ser substituído por armazenamento persistente antes do uso em produção.
