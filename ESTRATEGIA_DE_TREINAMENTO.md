# Estratégia de Treinamento do Confere+

Versão: 1.0 — 8 de agosto de 2026

## Objetivo

Melhorar a precisão da conferência técnica sem gravar legislação desatualizada no modelo e sem utilizar projetos que não tenham autorização expressa.

## Arquitetura recomendada

1. **Legislação consultável:** leis, códigos e regulamentos ficam em uma base versionada, com município, vigência, artigo e página. O sistema consulta essa base em cada análise.
2. **Extração do projeto:** plantas e documentos são convertidos em informações estruturadas, sempre preservando a referência de página e região.
3. **Motor de regras:** verificações determinísticas são usadas quando a regra permite cálculo objetivo, como taxa de ocupação, coeficiente ou recuo.
4. **Modelo especializado:** o modelo ajuda a classificar informações, relacionar evidências e redigir recomendações. Ele não substitui a fonte legal nem a revisão profissional.
5. **Revisão humana:** um arquiteto confirma resultado, evidência, regra aplicada e recomendação.

## Construção da base voluntária

Cada exemplo deve conter: município, tipo de projeto, versão da legislação, tema, exigência, valor identificado, página/região da evidência, resultado correto, recomendação validada e identificador anônimo.

Não entram na base: arquivos sem consentimento, dados pessoais desnecessários, exemplos sem revisão, legislação sem versão e respostas cuja fonte não possa ser localizada.

## Fases

### Fase A — Avaliação sem treinamento

- Criar um conjunto inicial de casos revisados.
- Medir a solução atual e registrar falsos positivos, falsos negativos e fontes incorretas.
- Melhorar extração, regras e consulta à legislação antes de ajustar um modelo.

### Fase B — Piloto supervisionado

- Preparar exemplos estruturados em formato aceito pelo provedor do modelo.
- Separar projetos, e não páginas do mesmo projeto, entre treinamento, validação e teste.
- Treinar somente tarefas que tenham ganho mensurável, como classificação e padronização do relatório.

### Fase C — Publicação controlada

- Versionar modelo, prompt, regras e base legal.
- Comparar a nova versão com a anterior em casos nunca vistos.
- Liberar gradualmente e manter possibilidade de retorno à versão anterior.

## Métricas mínimas

- precisão por tipo de regra;
- taxa de pendências reais encontradas;
- taxa de alertas incorretos;
- referências legais e páginas corretas;
- concordância com o arquiteto revisor;
- tempo de análise;
- percentual de itens marcados como não identificados.

## Critério para começar a cobrar

O início dos planos pagos deve depender de evidência: estabilidade operacional, relatórios recuperáveis, proteção de dados implementada e desempenho técnico validado em casos nunca vistos. A decisão não deve ser baseada apenas na quantidade de projetos coletados.
