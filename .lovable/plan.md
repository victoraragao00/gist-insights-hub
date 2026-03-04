

# Wizard de Contatos Gist: Separar em 2 etapas

## Problema
Atualmente, o Step A ("Discovery") mostra tudo junto: a lista de domínios/empresas com as opções de vincular/criar/ignorar E os contatos individuais de cada grupo. Isso é confuso quando há muitos domínios com dezenas de contatos.

## Nova estrutura do wizard

### Step 1 — "Clientes" (novo)
Lista apenas os **domínios/empresas** encontrados. Para cada grupo, o usuário escolhe:
- **Vincular a cliente existente** (select de clientes)
- **Criar novo cliente** (input de nome)
- **Ignorar** (novo — não importa contatos desse domínio)

Sem tabela de contatos. Apenas mostra o domínio, nome da empresa (se houver) e quantidade de contatos como informação contextual (ex: "nkstore.com.br — 42 contatos").

Botão "Próximo" avança ao Step 2 (filtrando apenas os grupos não-ignorados).

### Step 2 — "Contatos" (novo)
Para cada grupo **não ignorado**, mostra a tabela de contatos com checkbox individual para selecionar quais contatos importar. Também mostra a seção de Teammates.

Botão "Confirmar Vínculos" avança ao Step 3 (atual "confirmation").

### Step 3 — "Confirmação" (atual)
Sem alterações significativas, apenas ajusta os contadores para refletir apenas os selecionados.

### Step 4 — "Importação" (atual, só onboarding)
Sem alterações.

## Alterações em `src/pages/ClientsPage.tsx`

1. Alterar `WizardStep` para `"clients" | "contacts" | "confirmation" | "import"`
2. Step inicial passa de `"discovery"` para `"clients"`
3. Adicionar opção `"ignore"` ao `GroupMapping.type` (tipo `"existing" | "new" | "ignore"`)
4. **Step "clients"**: renderiza cards compactos por domínio — só domínio, empresa, count, e select (vincular/criar/ignorar) + input/select conforme tipo
5. **Step "contacts"**: para cada grupo não-ignorado, mostra tabela de contatos com checkboxes. Novo state `selectedContacts: Map<number, boolean>` para controle individual. Também mostra teammates aqui.
6. Ajustar `handleConfirmMappings` para filtrar apenas contatos selecionados e grupos não-ignorados
7. Ajustar `summaryContactCount` para contar apenas selecionados

Nenhum outro arquivo será alterado.

