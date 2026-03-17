

## Plano: Corrigir bug de build + Capturar jornada de screenshots

### Passo 1 — Corrigir build error (SearchPage.tsx)

O build está quebrado por causa do bug TDZ (item A1 do PENDENTES.md). Sem corrigir, a página `/search` não renderiza.

**Correção:** Mover o `useEffect` das linhas 59-61 para depois da linha 103 (após a declaração de `clientSearchError`). Uma única mudança de posição, zero impacto funcional.

### Passo 2 — Capturar 8 screenshots via browser tool

Após o fix, navego por cada rota na ordem da jornada e capturo os prints:

| # | Rota | Narrativa PPT |
|---|------|---------------|
| 1 | `/login` | Acesso seguro |
| 2 | `/` | Visão executiva em tempo real |
| 3 | `/` (card expandido) | Detecção automática de padrões |
| 4 | `/clients` | Gestão de carteira |
| 5 | `/clients/:slug` | 360° do cliente |
| 6 | `/clients/:slug` (aba interações) | Cada interação classificada por IA |
| 7 | `/search` | Busca inteligente |
| 8 | `/audits` | Governança automatizada |

**Pré-requisito:** Você precisa estar logado no preview antes de eu iniciar a captura. Caso contrário, todas as rotas protegidas redirecionam para `/login`.

### Entregáveis

- Build corrigido (1 arquivo: `SearchPage.tsx`)
- 8 imagens capturadas em 1920x1080 entregues diretamente no chat

