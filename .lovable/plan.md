

## Adição ao plano: Extração de contactName

Incorporar ao plano aprovado a seguinte lógica para `contactName`:

```typescript
function extractContactName(senderRaw: string | null): string {
  if (!senderRaw) return 'Desconhecido';
  if (!senderRaw.includes('@')) return senderRaw; // já é nome completo
  // email: extrair parte antes do @, split por '.', capitalizar
  return senderRaw.split('@')[0]
    .split('.')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
```

Casos cobertos:
- `"vinicius.dias@bynv.com.br"` → `"Vinicius Dias"`
- `"Vinicius Dias"` → `"Vinicius Dias"` (sem transformação)
- `null` → `"Desconhecido"`

Nenhuma outra mudança no plano. Essa função será usada dentro do `useMemo` de agrupamento ao determinar o `contactName` de cada conversa.

