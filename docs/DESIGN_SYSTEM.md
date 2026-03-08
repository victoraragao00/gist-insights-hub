# Design System — CX Hub uMode

> Fonte unica de verdade para cores, motion, componentes e regras visuais.
> Toda decisao visual do Cursor DEVE seguir este documento.
> Referenciado em `.cursor/rules`. Atualizado pelo Claude Code.

---

## 1. Paleta Semantica

### 1.1 Tom de interacao (classificacao IA)

| Tom       | Tailwind (light)  | Tailwind (dark)       | Uso                     |
|-----------|-------------------|-----------------------|-------------------------|
| ok        | `text-emerald-600 bg-emerald-50`  | `text-emerald-400 bg-emerald-950` | Saudavel, sem acao      |
| atencao   | `text-yellow-600 bg-yellow-50`    | `text-yellow-400 bg-yellow-950`   | Requer atencao          |
| alerta    | `text-orange-600 bg-orange-50`    | `text-orange-400 bg-orange-950`   | Acao necessaria         |
| critico   | `text-red-600 bg-red-50`          | `text-red-400 bg-red-950`         | Acao urgente            |

### 1.2 Tier do cliente (client_priority_config.tier)

| Tier       | Badge variant          | Cor                        |
|------------|------------------------|----------------------------|
| azzas      | `bg-primary text-primary-foreground`     | Purple (brand)  |
| enterprise | `bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300` | Blue |
| medium     | `bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300` | Slate |
| small      | `bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400`    | Gray  |

### 1.3 Score visual (priority_scores.score — cap visual em 100)

| Faixa   | Cor barra/numero               | Significado    |
|---------|--------------------------------|----------------|
| 0-29    | `text-emerald-600 bg-emerald-500` | Baixa prioridade  |
| 30-59   | `text-yellow-600 bg-yellow-500`   | Media prioridade   |
| 60-79   | `text-orange-600 bg-orange-500`   | Alta prioridade    |
| 80-100  | `text-red-600 bg-red-500`         | Critica            |

Score no banco pode ultrapassar 100. **Cap visual de 100 e responsabilidade do frontend:**
```typescript
const displayScore = Math.min(score, 100);
const scorePct = Math.min((score / 100) * 100, 100);
```

### 1.4 Severity de pattern (priority_scores.patterns[].severity)

| Severity | Badge                            |
|----------|----------------------------------|
| high     | `bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300`       |
| medium   | `bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300` |
| low      | `bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300` |

### 1.5 Saude do cliente (client_stats_30d.health_pct)

health_pct = % de mensagens com tom `ok`. **Alto = saudavel = verde.**

| Faixa    | Cor                | Significado |
|----------|--------------------|-------------|
| >= 80%   | `bg-emerald-500`   | Saudavel    |
| 60-79%   | `bg-yellow-500`    | Atencao     |
| 40-59%   | `bg-orange-500`    | Alerta      |
| < 40%    | `bg-red-500`       | Critico     |

---

## 2. Motion Patterns

### 2.1 Animacoes custom (registradas no tailwind.config.ts)

| Classe            | Uso                                          | Duracao |
|-------------------|----------------------------------------------|---------|
| `animate-pulse-subtle` | Cards com score critico (80+), loading states | 2s      |
| `animate-fade-in-up`   | Entrada de cards/rows no Dashboard           | 0.4s    |
| `animate-shimmer`      | Skeleton loading (alternativa ao pulse)      | 1.5s    |
| `animate-progress-fill`| Barra de score preenchendo                   | 0.6s    |
| `animate-score-pop`    | Numero do score aparecendo                   | 0.3s    |

### 2.2 tailwindcss-animate (ja instalado — usar livremente)

**Entradas compostas:**
```
animate-in fade-in-0 zoom-in-95 duration-300
animate-in slide-in-from-bottom-4 fade-in-0 duration-200
animate-in fade-in-0 slide-in-from-left-4 duration-300
```

**Modificadores:**
- `duration-{75|100|150|200|300|500|700|1000}`
- `delay-{75|100|150|200|300|500|700|1000}`
- `ease-in`, `ease-out`, `ease-in-out`
- `fill-forwards` (manter estado final)

**Stagger em listas** (via style inline para delay incremental):
```tsx
{items.map((item, i) => (
  <div
    key={item.id}
    className="animate-in fade-in-0 slide-in-from-bottom-2 fill-forwards duration-300"
    style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}
  />
))}
```

### 2.3 CSS nativo via Tailwind (sem plugin)

| Pattern             | Classes                          | Uso                    |
|---------------------|----------------------------------|------------------------|
| Hover card          | `transition-shadow duration-200 hover:shadow-md` | Cards clicaveis |
| Hover scale         | `transition-transform duration-150 hover:scale-[1.02]` | Elementos interativos |
| Active press        | `active:scale-95 transition-transform` | Botoes        |
| Color transition    | `transition-colors duration-200` | Links, badges          |
| Loading spin        | `animate-spin`                   | Icone de loading       |
| Attention pulse     | `animate-pulse`                  | Indicadores            |

### 2.4 Regras de motion

- **Sutil > chamativo.** Animacoes devem guiar atencao, nao distrair.
- **Duracao maxima:** 500ms para transicoes de UI, 1s para indicadores.
- **Stagger maximo:** 50ms entre items, cap em 10 items (evitar efeito cascata longo).
- **Respeitar prefers-reduced-motion:** usar `motion-safe:` prefix quando possivel.
- **Nunca animar layout shifts** — animacoes de entrada devem ter `fill-forwards` e tamanho fixo.

---

## 3. Regras de Decisao de Componentes

### 3.1 Overlays

| Quando usar      | Componente | Criterio                               |
|------------------|------------|----------------------------------------|
| Confirmacao sim/nao | AlertDialog | Acao destrutiva, requer decisao binaria |
| Formulario/conteudo | Dialog     | Conteudo rico, nao depende de contexto  |
| Detalhe contextual  | Sheet      | Manter contexto da pagina visivel       |

**Nunca usar Drawer** (redundante com Sheet neste projeto).

### 3.2 Feedback

| Quando usar         | Componente | Criterio                          |
|---------------------|------------|-----------------------------------|
| Acao concluida      | toast (sonner) | Temporario, nao bloqueia       |
| Erro recuperavel    | toast.error    | Temporario, com acao de retry  |
| Estado persistente  | Alert          | Inline na pagina, nao descarta |
| Vazio/sem dados     | Icone + texto  | Centralizado, amigavel         |

### 3.3 Listas

| Cenario          | Componente                | Criterio                    |
|------------------|---------------------------|-----------------------------|
| < 10 items       | Cards em grid             | Visual rico, escanavel      |
| 10-50 items      | Table com scroll          | Compacto, ordenavel         |
| > 50 items       | Table + Pagination (m12)  | Performance, paginacao real |
| Detalhes expand  | Accordion/Collapsible     | Dentro de card ou row       |

---

## 4. Tipografia

- **Font:** Plus Jakarta Sans (400, 500, 600, 700)
- **Titulos de pagina:** `text-2xl font-bold`
- **Subtitulos/descricoes:** `text-sm text-muted-foreground`
- **Labels:** `text-sm font-medium`
- **Valores numericos grandes:** `text-3xl font-bold tabular-nums`
- **Badges:** `text-xs font-medium`
- **tabular-nums** em qualquer numero que muda (scores, contadores) — evita layout shift

---

## 5. Espacamento e Layout

- **Gap padrao:** `gap-4` (cards), `gap-6` (secoes)
- **Padding de pagina:** `p-6` (desktop), `p-4` (mobile)
- **Grid responsivo:** `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Max width:** container `2xl:max-w-[1400px]` (ja configurado)
- **Border radius:** `rounded-lg` (cards), `rounded-md` (inputs), `rounded-sm` (badges)

---

## 6. Dark Mode

Todas as cores semanticas (secoes 1.1 a 1.5) incluem variantes dark.
Usar sempre os pares light/dark listados. Nunca usar cor solo sem variante dark.

Para cores do tema (primary, secondary, etc), usar os tokens CSS:
```
bg-primary text-primary-foreground    // automaticamente adapta
bg-card text-card-foreground          // automaticamente adapta
bg-muted text-muted-foreground        // automaticamente adapta
```
