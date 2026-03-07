

## Personalizar E-mails de Auth — Logo uMode + Português

### Contexto

Os templates de e-mail de autenticação (confirmação de conta, reset de senha, magic link, etc.) ainda não foram scaffoldados neste projeto. Precisamos criá-los com:
- Logo uMode (`umode-logo-full.png`) no topo de cada e-mail
- Todo o copy em português brasileiro
- Cores do design system roxo (primary `hsl(263, 70%, 58%)`, foreground `hsl(240, 10%, 10%)`)
- Tipografia Plus Jakarta Sans com fallback Arial

### Pré-requisito

O projeto já tem domínio de e-mail configurado (`notify.umode.tech` conforme memória). O scaffold pode ser feito diretamente.

### Passos

1. **Scaffold dos templates** — Chamar `scaffold_auth_email_templates` para criar a estrutura em `supabase/functions/_shared/email-templates/` e `supabase/functions/auth-email-hook/`

2. **Upload da logo** — Criar bucket `email-assets` no storage e fazer upload de `src/assets/umode-logo-full.png` para uso público nos e-mails

3. **Customizar todos os 6 templates** (signup, recovery, magic-link, invite, email-change, reauthentication):
   - Adicionar `<Img>` com logo uMode no topo
   - Traduzir todo o copy para português:
     - signup: "Confirme seu e-mail", "Clique no botão abaixo para ativar sua conta"
     - recovery: "Redefinir senha", "Clique no botão abaixo para criar uma nova senha"
     - magic-link: "Link de acesso", "Clique no botão abaixo para entrar"
     - invite: "Você foi convidado", "Clique para aceitar o convite"
     - email-change: "Confirmar alteração de e-mail"
     - reauthentication: "Código de verificação"
   - Aplicar cores do design system:
     - Botão: `backgroundColor: hsl(263, 70%, 58%)`, `color: #ffffff`, `borderRadius: 1rem`
     - Títulos: `color: hsl(240, 10%, 10%)`
     - Texto: `color: hsl(240, 5%, 46%)`
   - Background do body: `#ffffff` (obrigatório)
   - Font: `'Plus Jakarta Sans', Arial, sans-serif`

4. **Deploy** — `deploy_edge_functions(["auth-email-hook"])`

### Resultado

Todos os e-mails de autenticação serão enviados com a identidade visual uMode e em português brasileiro.

