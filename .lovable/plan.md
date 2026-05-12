## 1. Scroll horizontal no painel de demanda

**Problema:** O `DemandDetailSheet` (`sm:max-w-lg` ≈ 512px) está exibindo scroll lateral em viewports menores. O conteúdo (Board, RFI, Tempo trabalhado, Adicionar manual, BLOQUEIO, SLA) tem elementos lado a lado que estouram a largura — ex.: "Board: CX Hub | Mover para TECH", "Adicionar manual: Horas | Des(crição) | +", "Iniciar timer".

**Fix em `src/components/demands/DemandDetailSheet.tsx`:**
- Adicionar `overflow-x-hidden` no `SheetContent` (linha 90) e padding interno mais conservador.
- No bloco Board: empilhar nome + botão "Mover para TECH" em coluna no breakpoint default (já que o sheet é estreito), em vez de inline.
- Na seção "Adicionar manual": trocar layout flex inline por grid `grid-cols-[1fr_1fr_auto] gap-1.5` para que os inputs encolham e o botão `+` não force overflow.
- Na seção "Tempo trabalhado": permitir wrap entre o texto "Nenhum timer rodando" e o botão "Iniciar timer".
- Em todos os Inputs/Selects da meta grid, garantir `min-w-0` nos containers `flex-1` para evitar overflow do conteúdo do `<SelectValue>`.
- Garantir `truncate` em labels longos (Board name, criador).

Sem mudanças em hooks/lógica — puramente CSS/layout.

## 2. Data de entrega aparece errada após salvar

**Causa raiz:** Em `src/pages/ProjectDetailPage.tsx` (linha 525) e no tooltip (linha 482), o código faz `format(new Date(project.due_date), "dd/MM/yyyy")`. Como `due_date` vem como `"YYYY-MM-DD"`, o construtor `new Date()` interpreta como **UTC midnight**. No fuso de Brasília (UTC-3) isso vira o dia anterior ao formatar localmente — usuário escolhe 17/06 e vê 16/06.

**Fix:**
- Criar helper local (ou usar inline) `new Date(dateStr + "T00:00:00")` para parse como horário local.
- Aplicar nos dois pontos do `ProjectDueDateField` (linhas 482 e 525).
- Verificar e aplicar o mesmo fix em outros usos de `format(new Date(date_string)...)` no mesmo arquivo se houver (ex.: `actual_*_date`, `planned_*_date` na seção Datas — `ProjectDatesSection.tsx` já faz isso corretamente).
- Também aplicar em `ProjectCard.tsx` (linha 90+) onde `due_date` é exibido/comparado.

Sem mudanças no banco ou na mutation — apenas formatação no frontend.

## Arquivos editados
- `src/components/demands/DemandDetailSheet.tsx` — espaçamentos / overflow
- `src/pages/ProjectDetailPage.tsx` — parse local de `due_date`
- `src/components/projects/ProjectCard.tsx` — parse local de `due_date` (se aplicável)
