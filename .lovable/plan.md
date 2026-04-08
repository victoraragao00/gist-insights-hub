

## Plan: Badge de lado na tabela + Regras anti-vies no Mega Agente

### 1. `src/pages/ClientDetailPage.tsx` — Badge sender_side na coluna Remetente

Na linha 844, onde hoje temos:

```tsx
<TableCell className="text-sm">{i.sender_raw ?? "—"}</TableCell>
```

Substituir por:

```tsx
<TableCell className="text-sm">
  <div className="flex items-center flex-wrap gap-1">
    <span>{i.sender_raw ?? "—"}</span>
    {i.sender_side === "umode" ? (
      <Badge className="ml-1.5 bg-blue-50 text-blue-600 border-blue-200 text-xs font-normal">
        uMode
      </Badge>
    ) : (
      <Badge className="ml-1.5 bg-orange-50 text-orange-600 border-orange-200 text-xs font-normal">
        Cliente
      </Badge>
    )}
  </div>
</TableCell>
```

`sender_side` already exists in the `Interaction` interface and the `nonOkData` query select.

### 2. `docs/mega-agente/MEGA_AGENTE_v2.md` — Adicionar Regras 10-13

Apos a Regra 9 (linha 189), antes de `---`, adicionar 4 novas regras anti-vies para mensagens da uMode:

```markdown
**Regra 10 — Mensagens curtas e neutras da uMode = ok**
Mensagens curtas da uMode como "ok", "certo", "entendido", "sim", "não", "obrigado", "até logo" NÃO devem ser classificadas como Atenção, Alerta ou Crítico. Tom = "ok" salvo conteúdo explicitamente problemático.

**Regra 11 — Mensagens de sistema = ok**
Mensagens de sistema ("This message was deleted", "This message was edited") NÃO devem receber tom negativo. Classificar sempre como "ok".

**Regra 12 — Encaminhamento operacional da uMode = ok**
Mensagens da uMode que expressam encaminhamento ("vou verificar", "passando para o time", "te aviso em breve") são neutras — classificar como "ok" mesmo que o contexto da conversa seja de Atenção.

**Regra 13 — Tom reflete sentimento do CLIENTE**
O tom deve refletir o sentimento do CLIENTE, não o conteúdo isolado de cada mensagem da uMode. Ao classificar uma mensagem da uMode, perguntar: "Isso indica que o cliente está insatisfeito?" Se não, classificar como "ok".
```

### Files changed

| Action | File |
|--------|------|
| Edit | `src/pages/ClientDetailPage.tsx` (badge sender_side na coluna Remetente) |
| Edit | `docs/mega-agente/MEGA_AGENTE_v2.md` (regras 10-13 anti-vies uMode) |

### No changes to
- Queries, hooks, migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

