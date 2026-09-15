# Ideal Prime — Refatoração da Home Premium

Data: 14/09/2026

## Escopo aplicado

Refatoração cirúrgica da página pública principal, preservando rotas, catálogo, regras de produto, preços, estoque, autenticação, portal empresarial e backend existentes.

### Arquivos funcionais alterados

- `client/src/pages/Marketplace.tsx`
- `client/index.html`
- `client/public/robots.txt` (novo)
- `client/public/sitemap.xml` (novo)

### Material de referência/documentação

- `docs/ideal-prime/referencia-homepage-premium.png`
- `docs/ideal-prime/PROMPT_HOME_PREMIUM.md`

## Principais melhorias

- hero único, sem repetição dos slogans anteriores;
- H1: `Produtos que movimentam o seu negócio.`;
- navegação pública simplificada;
- destaque comercial para catálogo, cotações, comparativo de valores/condições e pedidos;
- composição visual do hero utiliza produtos reais retornados pelo catálogo e `ProductVisual`, incluindo fallbacks existentes;
- remoção dos contadores pequenos do hero;
- remoção dos dois cards redundantes de Área da Empresa/Acesso da Equipe do topo da home;
- nova faixa de benefícios empresariais;
- catálogo com hierarquia visual mais clara e cards responsivos;
- linguagem `Preço sob consulta` e disponibilidade preservadas;
- nova jornada B2B em três etapas;
- CTA `Solicitar um produto` em vez de linguagem B2C de lista de desejos na página pública;
- footer mais completo sem inventar telefone, endereço ou e-mail;
- SEO técnico reforçado com canonical, Open Graph, Twitter Card, JSON-LD, robots e sitemap;
- metadados dinâmicos diferentes para home e `/vitrine`;
- H1 único e estrutura semântica de headings.

## SEO oficial configurado

Domínio canônico: `https://idealprimecomercio.com/`

Title principal: `Ideal Prime | Produtos, Cotações e Pedidos para Empresas`

## Validações realizadas neste ambiente

- diff limitado aos arquivos listados acima;
- `git diff --check` sem erro de whitespace nos arquivos principais;
- `sitemap.xml` validado como XML bem formado;
- verificação estática de H1 único e presença das mensagens críticas;
- parse TypeScript/JSX sem erro sintático identificado.

## Limitação do ambiente local

Não foi possível executar `pnpm install`, `pnpm check`, `pnpm test` e `pnpm build` neste ambiente porque o acesso ao registry npm estava indisponível (`EAI_AGAIN registry.npmjs.org`) e o ZIP não continha `node_modules`.

Antes de commit/redeploy, execute no ambiente com dependências/rede:

```bash
pnpm install --frozen-lockfile
pnpm release:verify
```

Depois valide a home em 390px, 768px e 1440px e faça o redeploy normal no Coolify.
