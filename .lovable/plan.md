

## Sincronização em segundo plano + indicador de progresso

### O que muda

**1. Mover a lógica de sync para o `ClientContext`** (mesmo padrão do `handleImportHistory`)

Atualmente o `runSync` vive no `SettingsPage.tsx` — quando o componente desmonta (navegação), o processo morre. Movendo para o Context, a sync sobrevive à navegação.

O `ClientContext` ganha:
- `syncState`: objeto com `syncing`, `cancelled`, `currentClientName`, `currentClientIndex`, `totalClients`, `completedResults`, `startedAt`, `progressPct`, `estimatedRemaining`
- `runSync(params)`: inicia a sincronização
- `cancelSync()`: cancela via ref
- O banner de aviso some — o usuário pode navegar livremente

**2. Barra de progresso global no `DashboardLayout`**

Quando `syncState.syncing === true`, mostra uma barra fina fixa no topo do `<main>` (ou abaixo do header):
- Progress bar com % real
- Texto: "Sincronizando: ClienteX (3/45) — 42% — ~12min restantes"
- Botão de cancelar (X)
- Visível em qualquer página

**3. Cálculo de ETA**

No loop de sync, registrar `startedAt` ao iniciar. A cada cliente concluído:
```
elapsedMs = Date.now() - startedAt
avgPerClient = elapsedMs / completedCount
remainingMs = avgPerClient * (totalClients - completedCount)
```
Formatar como "~Xmin" ou "~Xs".

### Arquivos alterados

1. **`src/context/ClientContext.tsx`** — adicionar estado de sync, `runSync`, `cancelSync`, cálculo de ETA
2. **`src/pages/SettingsPage.tsx`** — remover `runSync` local, consumir do context. Remover banner de aviso. Manter UI de seleção/filtro/inativação como está
3. **`src/components/DashboardLayout.tsx`** — adicionar barra de progresso global quando sync ativa

