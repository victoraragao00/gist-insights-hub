

## Plan: Melhorar UI do botão "Criar RFI" no DemandDetailSheet

### Problema atual
O botão "Criar RFI" aparece como um `outline` button pequeno e discreto, pouco chamativo. Quando a RFI já existe, o layout com número + badge é funcional mas pode ser mais destacado.

### Mudança proposta — `src/components/demands/DemandDetailSheet.tsx` (linhas 496-528)

Transformar a seção RFI em um card visual mais destacado:

**Sem RFI:**
- Card com borda tracejada (`border-dashed`) e fundo sutil
- Ícone `FileText` centralizado + texto "Nenhuma RFI vinculada"
- Botão primário "Criar RFI" com ícone `Plus`, tamanho `sm`, variante `default` (roxo)

**Com RFI:**
- Card com borda sólida e fundo leve (`bg-muted/30`)
- Número da RFI (`RFI-0001`) em destaque com `font-mono font-semibold`
- Badge de status com cor
- Ícone `ChevronRight` indicando que é clicável
- Assunto da RFI como subtexto (se existir)

### Código aproximado

```tsx
<div className="space-y-1">
  <Label className="text-xs text-muted-foreground">RFI</Label>
  {rfiData ? (
    <button
      onClick={() => setRfiSheetOpen(true)}
      className="w-full flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <span className="font-mono font-semibold text-sm">{rfiData.rfi_number}</span>
        {rfiData.rfi_statuses && (
          <Badge ...>{status.name}</Badge>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  ) : (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4">
      <FileText className="h-5 w-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">Nenhuma RFI vinculada</p>
      <Button size="sm" onClick={...} disabled={isPending}>
        {isPending ? <Loader2 .../> : <Plus .../>}
        Criar RFI
      </Button>
    </div>
  )}
</div>
```

### Arquivo editado
| Arquivo | Mudança |
|---------|---------|
| `src/components/demands/DemandDetailSheet.tsx` | Redesign seção RFI (linhas 496-528) |

### Sem alterações em
- Hooks, migrations, edge functions, `src/integrations/supabase/*`, `.env`

