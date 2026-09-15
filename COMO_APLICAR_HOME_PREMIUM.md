# Como aplicar no repositório Ideal Prime

Este pacote contém somente os arquivos alterados da refatoração da homepage e não substitui o repositório inteiro.

1. Faça backup/commit do estado atual.
2. Copie as pastas deste pacote sobre a raiz do repositório, preservando os mesmos caminhos.
3. Confira o diff.
4. Execute:

```bash
pnpm install --frozen-lockfile
pnpm release:verify
```

5. Valide visualmente a home em desktop/tablet/mobile.
6. Faça commit/push e redeploy normalmente.

Arquivos funcionais:
- client/src/pages/Marketplace.tsx
- client/index.html
- client/public/robots.txt
- client/public/sitemap.xml

Documentação/referência:
- docs/ideal-prime/PROMPT_HOME_PREMIUM.md
- docs/ideal-prime/referencia-homepage-premium.png
- RELATORIO_HOME_PREMIUM_2026_09_14.md
