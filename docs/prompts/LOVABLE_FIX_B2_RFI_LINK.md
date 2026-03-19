# Prompt Lovable — Fix B2: Campo RFI não é link clicável

> **Issue:** https://github.com/HyTrackWater/gist-insights-hub/issues/67
> **Severidade:** Médio — funcional para salvar, inutilizável para navegar
> **Origem:** Validação Vitor — S1-C

---

## Sua identidade

Você é o Lovable, agente full-stack do CX Hub uMode. Responsável por frontend e backend.

---

## OBRIGATÓRIO

- Editar APENAS o arquivo listado no escopo
- Manter TODO o código existente que não é mencionado neste prompt
- O campo RFI deve ter dois modos: visualização (link clicável) e edição (input)
- Validação: se URL não começa com `http://` ou `https://`, adicionar `https://` antes de salvar

## PROIBIDO

- Alterar o CreateDemandDialog (lá o campo RFI é input de criação, está correto)
- Criar arquivos novos
- Alterar lógica de mutations
- Reverter código de outros componentes

---

## Problema

O campo `rfi_url` no DemandDetailSheet é renderizado APENAS como `<Input>` (texto simples). O usuário não consegue clicar para abrir o link em nova aba.

**Código atual** (`DemandDetailSheet.tsx`, linhas ~219-231):
```tsx
<div className="space-y-1">
  <Label className="text-xs text-muted-foreground">RFI</Label>
  <Input
    value={rfiUrl}
    onChange={(e) => setRfiUrl(e.target.value)}
    onBlur={() => {
      if (rfiUrl !== (demand.rfi_url ?? "")) saveField("rfi_url", rfiUrl, "RFI");
    }}
    className="h-8"
    type="url"
    placeholder="https://..."
  />
</div>
```

---

## Fix

Substituir o bloco do campo RFI por um componente com dois modos:

### 1. Adicionar state para controlar modo edição

```tsx
// Adicionar junto aos outros useState (linha ~101):
const [editingRfi, setEditingRfi] = useState(false);
```

### 2. Adicionar função de normalização de URL

```tsx
// Adicionar junto ao saveField callback:
const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
};
```

### 3. Substituir o bloco RFI no JSX

```tsx
<div className="space-y-1">
  <Label className="text-xs text-muted-foreground">RFI</Label>
  {editingRfi ? (
    <Input
      value={rfiUrl}
      onChange={(e) => setRfiUrl(e.target.value)}
      onBlur={() => {
        const normalized = normalizeUrl(rfiUrl);
        setRfiUrl(normalized);
        if (normalized !== (demand.rfi_url ?? "")) {
          saveField("rfi_url", normalized, "RFI");
        }
        setEditingRfi(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setRfiUrl(demand.rfi_url ?? "");
          setEditingRfi(false);
        }
      }}
      className="h-8"
      type="url"
      placeholder="https://..."
      autoFocus
    />
  ) : (
    <div className="flex items-center gap-1.5 min-h-[2rem]">
      {rfiUrl ? (
        <a
          href={rfiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary underline truncate hover:opacity-80 transition-opacity flex-1"
        >
          {rfiUrl}
        </a>
      ) : (
        <span className="text-sm text-muted-foreground flex-1">Nenhum RFI vinculado</span>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={() => setEditingRfi(true)}
      >
        <Edit className="h-3 w-3" />
      </Button>
    </div>
  )}
</div>
```

**Nota:** O icon `Edit` já está importado na linha 24 do arquivo atual.

---

## Escopo de arquivos

| Arquivo | Ação |
|---|---|
| `src/components/demands/DemandDetailSheet.tsx` | Substituir campo RFI por modo view/edit com link clicável |

---

## Verificação

1. Abrir demand COM rfi_url preenchido → deve mostrar link clicável (azul, sublinhado)
2. Clicar no link → deve abrir em nova aba (`target="_blank"`)
3. Clicar no botão de editar (ícone lápis) → deve trocar para Input com autoFocus
4. Editar a URL e dar blur → deve salvar, normalizar URL, e voltar ao modo visualização
5. Digitar URL sem `https://` (ex: `docs.google.com/123`) → deve auto-adicionar `https://`
6. Pressionar Enter no input → deve salvar (equivalente a blur)
7. Pressionar Escape no input → deve cancelar edição e restaurar valor anterior
8. Abrir demand SEM rfi_url → deve mostrar "Nenhum RFI vinculado" + botão de editar
9. Clicar editar com campo vazio → preencher URL → blur → deve salvar e mostrar como link
10. Verificar que o CreateDemandDialog NÃO foi alterado
