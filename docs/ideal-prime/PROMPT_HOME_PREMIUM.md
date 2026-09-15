# Ideal Prime — execução da nova homepage premium

Assuma a continuidade técnica do repositório `vml-arquivos/idealprime`. Esta é uma tarefa de **execução**, não de diagnóstico. Trabalhe sempre sobre o HEAD mais recente da `main`, preserve todas as funções existentes e aplique o menor diff seguro possível.

## Objetivo

Refatorar a página pública principal da Ideal Prime para reproduzir com alta fidelidade a referência visual `docs/ideal-prime/referencia-homepage-premium.png`, mantendo a identidade verde/off-white, tipografia editorial, visual clean, responsividade e integração real com o catálogo existente.

A homepage deve deixar de repetir slogans abstratos e comunicar com clareza o que a Ideal Prime oferece às empresas: produtos, catálogo, cotações, comparação de valores/condições, pedidos e acompanhamento em um fluxo simples.

## Mensagem principal

Eyebrow: `IDEAL PRIME · COMÉRCIO E DISTRIBUIÇÃO`

H1: `Produtos que movimentam o seu negócio.`

Texto: `Higiene, limpeza, descartáveis, utilidades e outras soluções para empresas que querem comprar melhor, repor com agilidade e manter a operação em movimento.`

CTAs:
- `Explorar catálogo`
- `Comprar como empresa`

Não utilizar novamente os slogans antigos `Escolhas que elevam o seu negócio`, `A sua próxima escolha começa aqui` ou `Produtos para vender, escolhas para permanecer`.

## Header

Simplificar para:
- Catálogo
- Para empresas
- Sobre
- Solicitar produto
- Entrar
- Área da empresa

O acesso interno da equipe não deve competir visualmente com a jornada comercial; `Entrar` pode direcionar ao login existente.

## Hero

À direita, criar uma composição premium usando produtos reais do catálogo atual, sem imagens fictícias obrigatórias. Usar os primeiros/destaques existentes com `ProductVisual` e fallbacks já implementados.

Mostrar benefícios comerciais em chips compactos:
- Catálogo empresarial
- Cotações sem complicação
- Comparativo de valores
- Pedidos em poucos passos

A comunicação sobre comparação deve ser objetiva: organizar e visualizar preços/condições para facilitar decisão, sem inventar integrações externas inexistentes.

## Benefícios

Criar faixa clean com quatro benefícios:
- Mix para empresas
- Reposição simplificada
- Atendimento comercial
- Compra com previsibilidade

## Catálogo

H2: `Um catálogo pensado para o dia a dia das empresas.`

Manter dados reais, filtros, busca, produtos publicados, preços e disponibilidade atuais. Não duplicar catálogo ou criar dados mockados.

Cards devem ter:
- imagem/fallback real;
- categoria;
- marca quando existir;
- nome;
- descrição curta;
- preço ou `Preço sob consulta`;
- disponibilidade;
- CTA `Ver produto`.

## Jornada B2B

Criar seção:

`Comprar para sua empresa ficou mais simples.`

Explicar que a empresa pode centralizar necessidades, organizar cotações, comparar valores e condições, acompanhar histórico e transformar cotações aprovadas em pedidos sem retrabalho.

Etapas:
1. Cadastre sua empresa
2. Consulte o catálogo
3. Cote e faça pedidos

CTA: `Criar acesso empresarial`

Preservar rotas e funcionalidades existentes do Business Portal.

## Solicitação de produto

Substituir a linguagem B2C `lista de desejos` na home por:

H2: `Não encontrou o produto que precisa?`

CTA: `Solicitar um produto`

A rota existente pode continuar sendo `/desejos` por compatibilidade interna.

## Footer

Footer premium em verde escuro com:
- marca;
- mensagem curta;
- navegação;
- acessos;
- frase institucional.

Não inventar telefone, endereço ou e-mail que não existam na configuração real.

## SEO obrigatório

Garantir:
- title principal: `Ideal Prime | Produtos, Cotações e Pedidos para Empresas`;
- meta description comercial;
- canonical `https://idealprimecomercio.com/`;
- Open Graph;
- Twitter Card;
- JSON-LD de Organization + WebSite;
- `robots.txt`;
- `sitemap.xml`;
- H1 único;
- H2s semânticos;
- textos naturais com termos relevantes: comércio e distribuição, produtos para empresas, higiene, limpeza, descartáveis, EPI, utilidades, cotações e pedidos;
- alt text em imagens de produto.

## Responsividade

Validar no mínimo:
- 390px mobile;
- 768px tablet;
- 1440px desktop.

Sem overflow horizontal, textos cortados, botões invisíveis, cards quebrados ou menu sobreposto.

## Regras críticas

- ZERO REGRESSÃO.
- Não alterar regras de estoque, preço, FIFO, B2B, cadastro ou autenticação apenas por causa do visual.
- Não inventar dados comerciais.
- Não remover rotas existentes.
- Não trocar imagens de produtos reais por mocks permanentes.
- Reutilizar componentes existentes sempre que possível.
- Não reintroduzir nomenclatura PermuPay na interface pública.

## Validação e entrega

Após implementar:
1. `pnpm migrate:verify`
2. `pnpm seed:catalog:validate`
3. `pnpm check`
4. `pnpm test`
5. `pnpm build`
6. validar visualmente desktop/mobile;
7. corrigir qualquer erro real;
8. commit objetivo;
9. push para `main` apenas após testes;
10. redeploy no Coolify;
11. validar `/healthz` e a URL pública `https://idealprimecomercio.com/`;
12. confirmar que catálogo, login, cadastro empresarial e portal continuam funcionais.

Não declare conclusão sem commit, push, deploy e validação real quando houver acesso a esses recursos.
