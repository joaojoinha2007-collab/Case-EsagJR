# Dimensionamento de Mercado · WEEK Haircare × ESAG Júnior

Plataforma web interativa que transforma o documento **“Guia TAM, SAM, SOM, market share e CAGR — WEEK Haircare”** em uma experiência de inteligência de mercado: visão executiva, conceitos, painel com gráficos, metodologia passo a passo, filtros, premissas com fontes e confiança, simulador, calculadora de CAGR e notas metodológicas.

## Como executar

**Jeito mais fácil:** baixe `week-haircare-mercado.html` (na raiz do repositório) e dê duplo clique. É um arquivo único com tudo embutido — pode ser enviado por e-mail ou WhatsApp. Para regenerá-lo após editar o código: `python3 week-mercado/build.py`.

Versão modular (para desenvolvimento), sem build nem dependências:

```
week-mercado/index.html   → abrir no navegador (duplo clique)
```

Ou com um servidor local (recomendado para apresentação):

```bash
cd week-mercado
python3 -m http.server 8080      # depois acesse http://localhost:8080
```

Testes das fórmulas (Node 18+, sem pacotes externos):

```bash
cd week-mercado
node --test tests/calc.test.js   # ou: npm test
```

**Conexão com a internet:** apenas a fonte Montserrat vem do Google Fonts. Sem internet, a página usa a fonte do sistema; dados, cálculos, gráficos e logos são todos locais. Os links de fontes da tabela de premissas são os hiperlinks que constam no PDF.

## Estrutura

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura semântica das seções |
| `css/styles.css` | Identidade visual (azul ESAG, verde-água WEEK), layout responsivo |
| `js/data.js` | Base analítica: premissas do cenário-base, resultados de referência do PDF, tabela de premissas, fontes, critérios de confiança, notas |
| `js/calc.js` | Motor de cálculo (TAM/SAM/SOM B2C e B2B, sensibilidade, conferência com o PDF, verificações, CAGR, validação de entradas) |
| `js/format.js` | Formatação brasileira (Intl.NumberFormat) |
| `js/charts.js` | Gráficos em HTML/SVG sem bibliotecas (barras, 100% empilhado, funil, linha) + tooltips acessíveis |
| `js/app.js` | Interface: estado, renderização e interações |
| `tests/calc.test.js` | 23 testes das fórmulas, cenários simulados, entradas inválidas, CAGR e formatação |
| `assets/` | Logos: ESAG Júnior (colorida e branca); WEEK Haircare sem o círculo (letras extraídas da imagem original, em verde-água e em branco) e a versão circular original (ícone da aba) |
| `build.py` | Gera o arquivo único `week-haircare-mercado.html` |

Os módulos `data.js`, `calc.js` e `format.js` funcionam tanto no navegador quanto no Node, então o que é testado é exatamente o código que a página executa.

## Decisões sobre os dados

- **O PDF é a única fonte de números.** Os valores de referência do documento ficam em `REFERENCE` e nunca entram no cálculo; servem só para a conferência.
- **Precisão total no cálculo, arredondamento só na exibição.** Por isso alguns valores diferem em décimos do PDF, que arredonda valores intermediários (ex.: 2,01 mi viagens → 6,0 mi lavagens no SAM de Viagem). Nenhum resultado foi forçado; todas as diferenças aparecem no painel “Verificação de consistência” e na seção de notas.
- **Resultado da conferência:** os 72 valores publicados (36 por modelo) foram reproduzidos; nenhuma divergência acima de 1,5%. As maiores diferenças são de arredondamento: SOM Viagem B2C em lavagens (−0,41%), SOM B2C em pessoas (−0,35%), B2B pessoas no TAM (−0,32%) e kits de hotéis no SOM (+0,35%). Os totais batem: B2C 1.845,9 (PDF R$ 1,85 bi) / 180,6 (PDF 180,7) / 94,6 mi; B2B 551,4 (PDF 551,5) / 155,9 (PDF 155,8) / 5,61 mi.
- **SOM sem taxa de captura**, como no documento. A plataforma não o apresenta como previsão de vendas.
- **Atualização do documento (versão de 24 páginas):** viagens com pernoite passaram de 20,6 mi para 15,8 mi (4,7 mi eram bate-volta), o que leva o B2C a TAM R$ 1,85 bi, SAM R$ 180,7 mi e SOM R$ 94,6 mi; o B2B não mudou. Entraram as seções de market share (`MARKET_SHARE`) e CAGR (`CAGR`) em `data.js`; `calc.marketShare()` e `calc.cagrRows()` recalculam o peso do nicho e as 9 taxas e conferem com o PDF.
- **Contagens de hotéis** (1.893 no SAM, 41 em Campinas) são contagens do Cadastur e não variam no simulador; as academias do SAM/SOM são estimadas pelos fatores (13.767 × 31% ≈ 4.268; × 3,6% ≈ 154), como no PDF.
- **Pontos de atenção registrados** (sem alterar os valores): sobreposição de pessoas no B2C; 1 kit por quarto ocupado como estimativa própria; ocupação de Campinas (56,87%) abaixo da média do Sudeste usada no SOM; uso de proxies (peso populacional, classes A/B como perfil premium); B2C e B2B não são somáveis.

## Robustez e desempenho (auditoria de outubro/2026)

- **Links internos** são tratados por JavaScript (rolagem com compensação do cabeçalho fixo). Antes, em pré-visualizações e iframes, um clique no menu trocava a página por uma tela em branco.
- **Detalhamento** (“Como chegamos a esse número?”) funciona também em navegadores sem `<dialog>` (iPads antigos), com fundo escurecido e fechamento por Esc, botão ou toque fora.
- **Estado único + renderização agendada**: as premissas, os filtros e a seleção vivem em um só objeto; cada mudança redesenha só as partes afetadas, uma vez por quadro, e as seções fora da tela são atualizadas quando se aproximam. Ao arrastar um controle do simulador, só o quadro de resultados é atualizado (estrutura fixa, apenas números); o restante da página é atualizado ao soltar.
- **Explorador de mercado** (seção “Conceitos”): funil e círculos proporcionais clicáveis, filtros de segmento e medida ligados ao painel, à metodologia e ao simulador, comparação B2C × B2B lado a lado e roteiro guiado.

Testes de interface executados com Playwright/Chromium (desktop, iPad, iPhone, iframe com sandbox e navegador sem `<dialog>`); os scripts ficam fora do repositório.
