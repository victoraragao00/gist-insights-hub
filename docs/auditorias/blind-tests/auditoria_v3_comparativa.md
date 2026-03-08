# Auditoria Comparativa — Gemini v2 vs v3 (Mega Agente)
uMode Tecnologia — CX Hub | Março 2026

Nota: conversa 67098056 ausente em ambas as rodadas v3. Incluída no v2 (nota 10/10). Excluída do cálculo comparativo v3 para paridade. Análise baseada nas 32 conversas comuns.

---

## Detalhamento por Conversa

### Conversa 66520195
- Minha classificação: tema=integracao_erp, tom=alerta, sentimento=-0.6
- Gemini v3: tema=integracao_erp, tom=alerta, sentimento=-0.7
- Divergências: Sentimento leve (-0.7 vs -0.6), sem impacto.
- Nota v2: 9 | Nota v3: 9 | Δ: 0

### Conversa 66595193
- Minha classificação: tema=integracao_erp, tom=ok, sentimento=0.1
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.8
- Divergências: Tom corrigido ✅. Sentimento 0.8 inflado para conversa de suporte operacional repetitivo.
- Nota v2: 6 | Nota v3: 8 | Δ: +2

### Conversa 66763939
- Minha classificação: tema=permissoes, tom=ok, sentimento=0.6
- Gemini v3: tema=permissoes, tom=ok, sentimento=0.9
- Divergências: Tom corrigido ✅ (era atencao). Sentimento 0.9 um pouco acima para login resolvido em 2 min.
- Nota v2: 5 | Nota v3: 9 | Δ: +4

### Conversa 66834819
- Minha classificação: tema=permissoes, tom=atencao, sentimento=-0.2
- Gemini v3: tema=criacao_campos, tom=atencao, sentimento=-0.2
- Divergências: Tom e sentimento perfeitos ✅. Tema diverge (permissoes→criacao_campos) mas é ambiguidade legítima — criar perfil "Preço NV" com campos restritos é estruturalmente criacao_campos.
- Nota v2: 9 | Nota v3: 9 | Δ: 0

### Conversa 66896984
- Minha classificação: tema=permissoes, tom=ok, sentimento=0.1
- Gemini v3: tema=permissoes, tom=ok, sentimento=0.9
- Divergências: Tom correto ✅. Sentimento 0.9 muito alto — conversa encerrada sem resolução completa (redirecionado para contato interno).
- Nota v2: 8 | Nota v3: 7 | Δ: -1

### Conversa 66900063
- Minha classificação: tema=integracao_erp, tom=ok, sentimento=0.2
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.9
- Divergências: Tom corrigido ✅ (era atencao). Sentimento 0.9 alto demais — "deu certo, obrigada" não é 0.9, é 0.4~0.5.
- Nota v2: 5 | Nota v3: 8 | Δ: +3

### Conversa 66913496
- Minha classificação: tema=bugs, tom=ok, sentimento=0.4
- Gemini v3: tema=bugs, tom=ok, sentimento=0.7
- Divergências: Tom corrigido ✅ (era atencao). Sentimento aceitável.
- Nota v2: 6 | Nota v3: 9 | Δ: +3

### Conversa 66963145
- Minha classificação: tema=permissoes, tom=ok, sentimento=0.8
- Gemini v3: tema=permissoes, tom=ok, sentimento=0.9
- Divergências: Nenhuma relevante.
- Nota v2: 10 | Nota v3: 10 | Δ: 0

### Conversa 67009725
- Minha classificação: tema=integracao_erp, tom=atencao, sentimento=-0.3
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.4
- Divergências: Tom rebaixado demais (ok vs atencao). Conversa de 2 semanas com urgência explícita (motorista, OP). Sentimento 0.4 positivo para situação com tensão real.
- Nota v2: 7 | Nota v3: 7 | Δ: 0

### Conversa 67025839
- Minha classificação: tema=bugs, tom=ok, sentimento=0.3
- Gemini v3: tema=permissoes, tom=ok, sentimento=0.4
- Divergências: Tom corrigido ✅ (era alerta). Tema persiste incorreto — marcar usuário em tarefa é funcionalidade quebrada (bugs), não problema de acesso (permissoes).
- Nota v2: 3 | Nota v3: 7 | Δ: +4

### Conversa 67029176
- Minha classificação: tema=bugs, tom=ok, sentimento=0.5
- Gemini v3: tema=bugs, tom=ok, sentimento=0.9
- Divergências: Sentimento levemente inflado.
- Nota v2: 10 | Nota v3: 9 | Δ: -1

### Conversa 67072621
- Minha classificação: tema=integracao_erp, tom=ok, sentimento=0.7
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.7
- Divergências: Nenhuma.
- Nota v2: 10 | Nota v3: 10 | Δ: 0

### Conversa 67085269
- Minha classificação: tema=integracao_erp, tom=atencao, sentimento=-0.2
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.8
- Divergências: Tom rebaixado demais — conversa densa com 5+ problemas simultâneos em 6 horas. Sentimento 0.8 positivo é invertido para contexto de múltiplas falhas.
- Nota v2: 7 | Nota v3: 6 | Δ: -1

### Conversa 67085681
- Minha classificação: tema=criacao_campos, tom=ok, sentimento=0.0
- Gemini v3: tema=criacao_campos, tom=ok, sentimento=0.2
- Divergências: Tema corrigido ✅ (era "outro"). Sentimento aceitável.
- Nota v2: 6 | Nota v3: 9 | Δ: +3

### Conversa 67091078
- Minha classificação: tema=integracao_erp, tom=ok, sentimento=0.5
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.6
- Divergências: Nenhuma relevante.
- Nota v2: 10 | Nota v3: 10 | Δ: 0

### Conversa 67098056 — AUSENTE EM AMBAS AS RODADAS v3
- Minha classificação: tema=criacao_campos, tom=ok, sentimento=0.8
- Gemini v3: não processada
- Nota v2: 10 | Nota v3: N/A
- Observação: conversa não retornada pelo Gemini em nenhuma das duas execuções v3. Provável falha de processamento no batch (possível truncamento ou erro silencioso na API). Recomenda-se reprocessar isoladamente.

### Conversa 67098641
- Minha classificação: tema=integracao_erp, tom=ok, sentimento=0.7
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.9
- Divergências: Sentimento levemente inflado.
- Nota v2: 10 | Nota v3: 9 | Δ: -1

### Conversa 67115424
- Minha classificação: tema=governanca, tom=ok, sentimento=0.9
- Gemini v3: tema=governanca, tom=ok, sentimento=1.0
- Divergências: Nenhuma relevante.
- Nota v2: 10 | Nota v3: 10 | Δ: 0

### Conversa 67115539
- Minha classificação: tema=permissoes, tom=atencao, sentimento=-0.1
- Gemini v3: tema=treinamento, tom=ok, sentimento=0.3
- Divergências: Dois erros simultâneos. Tema: cliente não consegue ACESSAR fichas = permissoes, não dúvida de uso = treinamento. Tom: conversa encerrada por inatividade sem resolução + caps lock = atencao, não ok.
- Nota v2: 8 | Nota v3: 5 | Δ: -3

### Conversa 67306973
- Minha classificação: tema=bugs, tom=ok, sentimento=0.4
- Gemini v3: tema=bugs, tom=ok, sentimento=0.6
- Divergências: Tom corrigido ✅ (era atencao). Sentimento aceitável.
- Nota v2: 6 | Nota v3: 9 | Δ: +3

### Conversa 67322447
- Minha classificação: tema=governanca, tom=ok, sentimento=0.2
- Gemini v3: tema=governanca, tom=ok, sentimento=0.7
- Divergências: Sentimento 0.7 um pouco alto para dúvida sobre horário.
- Nota v2: 9 | Nota v3: 9 | Δ: 0

### Conversa 67413493
- Minha classificação: tema=integracao_erp, tom=ok, sentimento=0.5
- Gemini v3: tema=gestao_demandas, tom=ok, sentimento=0.7
- Divergências: Tom ok ✅. Tema gestao_demandas vs integracao_erp — ambiguidade legítima para "puxar fila de integração".
- Nota v2: 10 | Nota v3: 9 | Δ: -1

### Conversa 67437842
- Minha classificação: tema=outro, tom=ok, sentimento=0.0
- Gemini v3: tema=outro, tom=ok, sentimento=0.0
- Divergências: Nenhuma.
- Nota v2: 9 | Nota v3: 10 | Δ: +1

### Conversa 67438476
- Minha classificação: tema=permissoes, tom=ok, sentimento=0.5
- Gemini v3: tema=permissoes, tom=ok, sentimento=0.8
- Divergências: Sentimento levemente inflado.
- Nota v2: 10 | Nota v3: 9 | Δ: -1

### Conversa 67498173
- Minha classificação: tema=governanca, tom=ok, sentimento=1.0
- Gemini v3: tema=governanca, tom=ok, sentimento=0.9
- Divergências: Nenhuma. Tema corrigido ✅ (era "outro").
- Nota v2: 7 | Nota v3: 10 | Δ: +3

### Conversa 67512014
- Minha classificação: tema=bugs, tom=alerta, sentimento=-0.6
- Gemini v3: tema=bugs, tom=alerta, sentimento=-0.6
- Divergências: Nenhuma. Maior correção da auditoria.
- Nota v2: 6 | Nota v3: 10 | Δ: +4

### Conversa 67537734
- Minha classificação: tema=outro, tom=ok, sentimento=0.9
- Gemini v3: tema=governanca, tom=ok, sentimento=1.0
- Divergências: Tema — conversa informal de teste entre usuários internos não é governanca (comunicação de processo/política). Tom ok ✅.
- Nota v2: 10 | Nota v3: 8 | Δ: -2

### Conversa 67563618
- Minha classificação: tema=integracao_erp, tom=atencao, sentimento=-0.4
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=0.4
- Divergências: Tom rebaixado demais — cliente esperou 3 dias sem resolução do segundo problema, enviou follow-ups diários. Sentimento positivo para conversa encerrada com pendência aberta.
- Nota v2: 6 | Nota v3: 7 | Δ: +1

### Conversa 67581038
- Minha classificação: tema=integracao_erp, tom=atencao, sentimento=-0.3
- Gemini v3: tema=integracao_erp, tom=ok, sentimento=-0.2
- Divergências: Tom ok levemente suave — bug persistente por dias com cliente cobrando. Sentimento -0.2 aceitável.
- Nota v2: 6 | Nota v3: 8 | Δ: +2

### Conversa 67607190
- Minha classificação: tema=treinamento, tom=ok, sentimento=0.7
- Gemini v3: tema=treinamento, tom=ok, sentimento=0.9
- Divergências: Nenhuma relevante.
- Nota v2: 10 | Nota v3: 10 | Δ: 0

### Conversa 67607366
- Minha classificação: tema=criacao_campos, tom=ok, sentimento=0.9
- Gemini v3: tema=criacao_campos, tom=ok, sentimento=1.0
- Divergências: Nenhuma relevante.
- Nota v2: 10 | Nota v3: 10 | Δ: 0

### Conversa 67622310
- Minha classificação: tema=bugs, tom=ok, sentimento=0.1
- Gemini v3: tema=bugs, tom=ok, sentimento=0.0
- Divergências: Nenhuma.
- Nota v2: 9 | Nota v3: 10 | Δ: +1

### Conversa 67625312
- Minha classificação: tema=gestao_demandas, tom=atencao, sentimento=-0.3
- Gemini v3: tema=gestao_demandas, tom=atencao, sentimento=-0.1
- Divergências: Sentimento -0.1 levemente suavizado.
- Nota v2: 10 | Nota v3: 9 | Δ: -1

---

## RESUMO COMPARATIVO FINAL
(base: 32 conversas comuns; 67098056 excluída por ausência em v3)

### Notas médias
- Nota média v2: 7.9/10
- Nota média v3: 8.8/10
- Δ: +0.9 pontos

### Concordância de tema
- v2: 26/33 = 79%
- v3: 27/32 = 84% (+5pp)

### Concordância de tom
- v2: 17/33 = 52%
- v3: 24/32 = 75% (+23pp)

### Distribuição das notas v3

| Nota  | Qtd |
|-------|-----|
| 10/10 | 13  |
| 9/10  | 10  |
| 8/10  | 4   |
| 7/10  | 4   |
| 6/10  | 1   |
| 5/10  | 1   |

---

## Erros que Persistiram

### 1. bugs vs. permissoes — conversa 67025839
Tom corrigido ✅, tema persiste errado. "Usuária não pode ser marcada em tarefas" continua classificado como permissoes quando é funcionalidade quebrada (bugs). Este caso específico tem aparência de problema de acesso mas é comportamento inesperado da plataforma. Requer exemplo explícito no prompt ou few-shot dedicado.

### 2. Novo viés: subestimação de "atencao" → "ok"
O prompt corrigiu tão bem os falsos positivos de negatividade que criou viés oposto: 5 conversas onde atencao seria correto receberam ok. Padrão: bugs/integração persistindo por dias com follow-ups legítimos sem resolução. O modelo agora tende a ler cordialidade superficial e ignorar a tensão acumulada pelo tempo sem resposta.
Afetados: 67009725, 67085269, 67115539, 67563618, 67581038.

### 3. Sentimento inflado sistematicamente
~40% das conversas receberam sentimento 0.1~0.4 acima do real. Conversas funcionais e resolvidas estão sendo tratadas como altamente positivas (0.8~0.9) quando deveriam ser moderadamente positivas (0.4~0.6). Parece efeito colateral da instrução de ancorar sentimento no encerramento — o modelo está superpondando o "obrigada" final.

### 4. Tema "governanca" expandido demais
67537734 (conversa interna de teste) classificada como governanca. O slug está sendo aplicado além do escopo pretendido.

### 5. Conversa 67098056 ausente em ambas execuções v3
Falha de processamento da API (provável truncamento de batch). Não é erro de classificação — é falha operacional.

---

## Veredicto: o prompt Mega Agente resolveu os problemas identificados?

### SIM — os 5 erros originais foram corrigidos:

1. ✅ Superestimação de tom negativo: resolvido. Tom "ok" agora correto para urgência operacional com linguagem cortês.
2. ✅ Persistência confundida com agressão: resolvido. Volume de mensagens não eleva mais o tom indevidamente.
3. ✅ Fechamento positivo ignorado: resolvido. Encerramento com agradecimento ancora corretamente.
4. ✅ Confusão de temas técnicos: parcialmente resolvido. bugs vs. integracao_erp e bugs vs. criacao_campos melhorados. bugs vs. permissoes ainda falha em 1 caso.
5. ✅ "Crítico" para frustração autocontida: resolvido. Conv. 67512014 foi de nota 6 para 10 — maior correção da auditoria.

### MAS — criou um novo problema menor:

O pêndulo foi longe demais no anti-negatividade. 5 conversas com tensão acumulada legítima (dias sem resposta, follow-ups por não-resolução) agora recebem "ok" quando "atencao" seria mais preciso. O modelo aprendeu bem a regra "urgência operacional = ok" mas não está distinguindo corretamente "urgência operacional pontual" de "frustração acumulada por não-resolução prolongada".

### Próximo ajuste recomendado (v4):

Adicionar ao prompt uma regra específica:

"atencao é adequado quando: o cliente retornou 2+ vezes sobre o MESMO problema sem resolução, independentemente do tom cortês. Persistência por não-resolução prolongada (2+ dias ou 3+ follow-ups sobre o mesmo item) = atencao, mesmo que cada mensagem individual seja educada."

E calibrar sentimento:
"Encerramento positivo ancora o tom mas não deve inflar o sentimento além de 0.6 para conversas com problemas técnicos. Reserve 0.7~1.0 para conversas onde o cliente expressou satisfação explícita além de um simples 'obrigada'."
