# Web Spectrometer

[English](../README.md) | [简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [Italiano](README.it.md) | [Français](README.fr.md) | **Português**

Um aplicativo de espectrômetro DIY que roda no navegador, com interface e funcionalidades inspiradas no [Theremino Spectrometer](https://www.theremino.com/en/downloads/automation#spectrometer).

![Espectro de emissão de lâmpada fluorescente](images/screenshot1.png)

*Espectro de emissão de uma lâmpada fluorescente: após calibrar o eixo de comprimentos de onda com as linhas de mercúrio de 436/546 nm, os picos são rotulados automaticamente; a janela Info à direita mostra os parâmetros em tempo real*

![Espectro contínuo de LED branco](images/screenshot2.png)

*Espectro contínuo de um LED branco (interface em chinês): o pico de excitação azul em 450 nm e a banda larga do fósforo são claramente visíveis; no topo, a faixa de imagem bruta do sensor*

## Motivação

Espectrômetros profissionais são caros, por isso muitos entusiastas DIY constroem o seu próprio com uma câmera CCD e uma grade de difração. O software companheiro mais aclamado é o Theremino Spectrometer — mas ele só roda no Windows. Este projeto traz as mesmas capacidades para o navegador: abra uma página web, conecte uma câmera e use no Linux, macOS ou Windows, para que mais pessoas possam se divertir com a espectrometria DIY.

## Para que serve

Converte em tempo real a imagem espectral capturada por uma webcam (ou por um sensor linear TCD1304/TCD1254 via porta serial) em uma curva espectral, útil para:

- Análise de fontes de luz: medição das linhas de emissão de lâmpadas fluorescentes, LEDs, lasers, etc.
- Calibração de comprimento de onda: calibração multiponto (Trim points) usando as linhas de mercúrio de 436/546 nm de uma lâmpada fluorescente
- Registro de dados: salvar espectros em CSV/TXT (arquivos compatíveis com o Theremino Spectrometer para Windows), salvamento automático temporizado/repetido, exportação de imagens

Principais funcionalidades: pipeline de filtragem em tempo real (média, velocidade de subida/descida, média espacial, referência/fundo), detecção de picos e vales com rótulos, coloração por comprimento de onda, escala logarítmica, correção de irradiância e interface em 6 idiomas. Requer apenas a versão mais recente do Chrome.

## Início rápido

```bash
npm install
npm run dev      # desenvolvimento local
npm run build    # saída de build em dist/
```

Implantação: importe o repositório no Vercel para hospedagem sem configuração (o acesso à câmera exige HTTPS, fornecido por padrão pelo Vercel).

Primeiro uso: após conectar a câmera, siga o aviso para calibrar com uma lâmpada fluorescente (Ferramentas → Trim points → Fluorescent 436 546, depois arraste os rótulos 436/546 no topo até as linhas de mercúrio).

## Licença

GNU GPL v3. Este projeto não é o Theremino Spectrometer e não é afiliado ao Theremino System; é uma implementação web independente cuja interface e funcionalidades se inspiram nesse software.

## Agradecimentos

Agradecimentos especiais a [www.theremino.com](https://www.theremino.com) e a [Stefano Marchetti](https://www.maestrodartemestiere.it/it/libro-d-oro/2020/stefano-marchetti) — o projeto Theremino publica generosamente todo o seu código-fonte e documentação sob uma política de "No Copyright". Sem o seu trabalho extraordinário em instrumentos científicos de código aberto, este projeto não existiria.
