

# Hub de Integrações Gist — Design System uMode

## Design System (baseado no site uMode)
- **Cores primárias**: Roxo/violeta (#7C3AED / purple-600) como cor principal, com gradientes suaves de roxo
- **Background**: Cinza muito claro (#F8F7FC) com tons levemente lilás
- **Cards**: Brancos com border-radius grande (16px), sombras sutis, sem bordas fortes
- **Tipografia**: Fonte clean sans-serif, headings bold em preto, textos secundários em cinza médio
- **Badges/Tags**: Chips com fundo cinza claro e texto escuro, border-radius arredondado
- **Ícones**: Em círculos com fundo lilás claro e ícone roxo
- **Navegação**: Header clean com logo à esquerda, links à direita, botão ativo com fundo roxo e texto branco
- **Estilo geral**: Minimalista, muito espaço em branco, hierarquia visual clara

## Fase 1 — Infraestrutura & Theme
1. Atualizar o design system (CSS variables) com as cores roxo/violeta da uMode
2. Habilitar Lovable Cloud e criar Edge Function `gist-proxy` para chamadas seguras à API do Gist (Bearer Auth, rate limiting, paginação)
3. Criar Edge Function `ai-insights` para integração com Google Gemini API externo
4. Configurar secrets: `GIST_API_KEY` e `GEMINI_API_KEY`

## Fase 2 — Layout Principal
5. Criar layout com sidebar de navegação estilo uMode (logo, módulos com ícones em círculos roxos)
6. Header com info do workspace Gist (via `/token/info`)
7. Página de configuração para inserir/gerenciar API keys

## Fase 3 — Módulos de Dashboard
8. **Módulo Conversas**: Cards brancos com métricas (abertas/fechadas), gráfico de volume (Recharts com cores roxas), lista de conversas recentes
9. **Módulo Contatos & Leads**: Total, crescimento temporal, distribuição por tags (donut chart roxo), segmentos ativos como badges/chips
10. **Módulo Campanhas**: Cards de status (ativa/pausada) com badges, subscribers por campanha, métricas resumidas

## Fase 4 — Insights com Gemini AI
11. Painel de Insights com botão "Gerar Análise" que envia dados ao Gemini
12. Card de insights em linguagem natural com ícone de IA
13. Chat simples para perguntas sobre os dados

## Fase 5 — Refinamentos
14. Filtros de período (7d, 30d, custom) em todos os módulos
15. Loading states com skeletons, tratamento de erros amigável
16. Responsividade mobile/tablet

