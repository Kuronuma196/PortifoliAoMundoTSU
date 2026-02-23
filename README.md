# PortifoliAoMundoTSU

Site oficial do projeto geral **Tear's Studios Universe** (estrutura multipágina).

## Páginas

- `index.html` — home com visão geral e atalhos.
- `personagens.html` — personagens Aegis, Lyra e Nox.
- `projetos.html` — roadmap do projeto.
- `cronologia.html` — eras e marcos narrativos.
- `galeria.html` — galeria de artes e identidade visual.
- `sobre.html` — missão, visão e objetivos.
- `contato.html` — canais de envio de materiais.
- `acesso.html` — login com Google e seleção de tipo de usuário.
- `noticias.html` — compartilhamento de notícias e atualizações oficiais.
- `analises.html` — painel inicial de métricas locais de uso do portal.
- `painel.html` — consolidação operacional local (solicitações, contatos e sugestões).
- `criacao.html` — página pública para integração com APIs de geração (imagem, vídeo, áudio e texto).
- `floryn.html` — atendimento virtual com a IA Floryn e notificações.
- `cms.html` — CMS/admin interno para criação editorial e monitoramento da comunidade.

## Imagens

- `assets/images/logo-tsu.svg` — logo inicial TSU.
- `assets/images/hero-universe.svg` — hero da home.
- `assets/images/character-aegis.svg`, `character-lyra.svg`, `character-nox.svg` — artes de exemplo dos personagens.

## Execução local

```bash
node server.js
```

(Alternativa estática para visual: `python3 -m http.server 4173`).

Acesse `http://localhost:4173`.


## Login Google (Firebase)

- `auth.js` implementa autenticação via Google usando Firebase Authentication.
- Para funcionar em produção, configure `window.TSU_FIREBASE_CONFIG` antes de carregar `auth.js` com os dados do seu projeto Firebase.
- Lista inicial de e-mails de Funcionário autorizados: `kuronumadeal@gmail.com` (pode ser expandida no arquivo `auth.js`).


## Notícias e análise de dados

- `script.js` registra eventos locais de navegação (page_view, cliques e compartilhamento) em `localStorage`.
- `analytics.js` consolida os eventos e exibe métricas na página `analises.html`.
- `site.js` concentra funcionalidades de UX das páginas (filtros, abas de galeria, formulário de contato e sugestões de notícias).
- `painel.js` consolida os dados locais operacionais e permite exportar base JSON.
- A página `noticias.html` inclui ação de compartilhamento via Web Share API com fallback para cópia de link.


## Criação pública e atendimento virtual

- `criacao.js` integra endpoints configuráveis para geração de imagem, vídeo, áudio e texto.
- `floryn.js` oferece chat local da atendente IA Floryn e notificações para público logado e não logado.


## Navegação dinâmica (UI/UX)

- `nav-dynamic.js` adiciona launcher global de páginas com busca e atalho `Ctrl/Cmd + K`.
- Botão flutuante “Explorar páginas” disponível em todas as páginas para acesso rápido.


## Fase 7 — Hardening final e estabilidade de design global

- `server.js` fornece API HTTP + servidor estático com persistência em `data/db.json`.
- Endpoints ativos: `/api/health`, `/api/contact`, `/api/news-suggestions`, `/api/role-requests`, `/api/analytics/events`, `/api/dashboard`, `/api/auth/employee-whitelist`, `/api/notifications`, `/api/cms/articles`, `/api/cms/overview`, `/api/creation/generate`, `/api/analytics/summary`, `/api/security/status`.
- `cms.html` + `cms.js` implementam painel de criação de artigos internos com indicadores operacionais.
- `criacao.html` + `criacao.js` implementam fluxo unificado para geração de texto, imagem, vídeo e áudio com histórico recente.
- `server.js` adiciona endpoint `/api/creation/generate` e telemetria de `creationJobs` no dashboard.
- `painel.js` e `index.html` exibem métricas operacionais ampliadas para CMS e criação.
- `styles.css` recebeu organização visual inspirada em portais modernos mantendo identidade TSU (navegação em chips, hierarquia e consistência de seções).

- `analytics.js` + `analises.html` agora consomem resumo analítico real por página/tipo/tendência com `/api/analytics/summary`, `/api/security/status`.
- `script.js` reorganiza automaticamente a navegação em duas linhas por prioridade, corrigindo o acesso às páginas e evitando menu quebrado no topo.
- `styles.css` recebeu ajustes de IA de layout para navegação multipágina (rows primária/secundária e consistência visual do header).

- `server.js` aplica hardening base (headers de segurança, limite de payload, sanitização de entradas e rate limit em POST).
- `script.js` + `styles.css` estabilizam a navegação em duas camadas para acesso rápido a todas as páginas sem quebra visual.
- `analises.html` + `analytics.js` seguem como centro de observabilidade com resumo real e histórico recente.


## Estratégia de menu (escala de páginas)

- Navegação em duas camadas: linha primária para páginas de uso frequente e linha secundária em “Mais” para áreas complementares.
- Em mobile, o menu abre completo com prioridade de leitura da esquerda para direita.
- Essa estratégia reduz poluição visual, melhora foco de navegação e mantém todas as páginas acessíveis.

## Nota sobre dados

- Evitamos URLs fictícias para mídia em produção local; respostas sem provedor integrado retornam `pending_provider_integration` para não simular dados irreais.


## Próximas fases (ciclo pós-Fase 7)

- **Fase 8 — Arquitetura de navegação e IA de layout**: unificar menu por configuração central e reduzir manutenção manual entre páginas.
- **Fase 9 — Conteúdo e dados reais**: integração com provedores reais de mídia (imagem/vídeo/áudio) e auditoria de fontes de dados.
- **Fase 10 — Qualidade contínua**: testes E2E/regressão visual, monitoramento de erros e baseline de performance.

### Execução iniciada: Fase 8

- `script.js` agora gera o menu global a partir de uma única configuração (`NAV_LINKS`) e organiza o acesso com camada principal + `Mais` para seções secundárias.
- Resultado: consistência de navegação em todas as páginas sem necessidade de editar manualmente cada HTML ao adicionar/remover rotas.
