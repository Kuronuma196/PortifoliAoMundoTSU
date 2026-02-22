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

## Imagens

- `assets/images/logo-tsu.svg` — logo inicial TSU.
- `assets/images/hero-universe.svg` — hero da home.
- `assets/images/character-aegis.svg`, `character-lyra.svg`, `character-nox.svg` — artes de exemplo dos personagens.

## Execução local

```bash
python3 -m http.server 4173
```

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
