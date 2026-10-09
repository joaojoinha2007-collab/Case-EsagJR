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
| `assets/` | Logos (ESAG Júnior colorida e branca; WEEK Haircare recortada da imagem fornecida) |

Os módulos `data.js`, `calc.js` e `format.js` funcionam tanto no navegador quanto no Node, então o que é testado é exatamente o código que a página executa.

## Decisões sobre os dados

- **O PDF é a única fonte de números.** Os valores de referência do documento ficam em `REFERENCE` e nunca entram no cálculo; servem só para a conferência.
- **Precisão total no cálculo, arredondamento só na exibição.** Por isso alguns valores diferem em décimos do PDF, que arredonda valores intermediários (ex.: 2,01 mi viagens → 6,0 mi lavagens no SAM de Viagem). Nenhum resultado foi forçado; todas as diferenças aparecem no painel “Verificação de consistência” e na seção de notas.
- **Resultado da conferência:** os 72 valores publicados (36 por modelo) foram reproduzidos; nenhuma divergência acima de 1,5%. As maiores diferenças são de arredondamento: SAM Viagem B2C (+0,77%), SOM Viagem B2C em lavagens (−1,0%), B2B pessoas no TAM (−0,32%) e kits de hotéis no SOM (+0,35%). Os totais batem: B2C 1.896,3 / 185,5 / 97,2 mi; B2B 551,4 (PDF 551,5) / 155,9 (PDF 155,8) / 5,61 mi.
- **SOM sem taxa de captura**, como no documento. A plataforma não o apresenta como previsão de vendas.
- **CAGR:** o documento não traz série histórica nem taxa calculada. A seção explica o conceito e oferece uma calculadora com entradas hipotéticas; nenhuma taxa foi inventada.
- **Contagens de hotéis** (1.893 no SAM, 41 em Campinas) são contagens do Cadastur e não variam no simulador; as academias do SAM/SOM são estimadas pelos fatores (13.767 × 31% ≈ 4.268; × 3,6% ≈ 154), como no PDF.
- **Pontos de atenção registrados** (sem alterar os valores): sobreposição de pessoas no B2C; 1 kit por quarto ocupado como estimativa própria; ocupação de Campinas (56,87%) abaixo da média do Sudeste usada no SOM; uso de proxies (peso populacional, classes A/B como perfil premium); B2C e B2B não são somáveis.
