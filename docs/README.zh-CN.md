# Web Spectrometer

[English](../README.md) | **简体中文** | [繁體中文](README.zh-TW.md) | [Italiano](README.it.md) | [Français](README.fr.md) | [Português](README.pt.md)

一款运行在浏览器中的 DIY 光谱仪软件,UI 与功能参考 [Theremino Spectrometer](https://www.theremino.com/en/downloads/automation#spectrometer) 设计。

![荧光灯发射光谱](images/screenshot1.png)

*荧光灯发射光谱:波长轴经 436/546nm 汞线校准后,谱线峰位自动标注;右侧为 Info 实时参数窗口*

![白光 LED 连续光谱](images/screenshot2.png)

*白光 LED 连续光谱(中文界面):450nm 蓝光激发峰与荧光粉宽谱清晰可辨,顶部为传感器原始影像*

## 初衷

专业光谱分析仪器价格昂贵,许多 DIY 爱好者用 CCD 摄像头加光栅自制光谱仪,配套软件中公认最好用的是 Theremino Spectrometer——但它只能在 Windows 上运行。本项目将同样的功能带进浏览器:打开网页、连上摄像头,即可在 Linux、macOS、Windows 任意平台上使用,让更多人体验 DIY 光谱仪的乐趣。

## 用途

把 WebCam(或经串口连接的 TCD1304/TCD1254 线性传感器)采集的光谱影像实时转换为光谱曲线,可用于:

- 光源分析:荧光灯、LED、激光等的发射谱线测量
- 光谱校准:多点校准(Trim points),用荧光灯 436/546nm 汞线标定波长轴
- 数据记录:光谱数据保存为 CSV/TXT(与 Windows 版 Theremino Spectrometer 文件互通)、定时/重复自动保存、图片导出

主要功能:实时滤波管线(平均、上升/下降速度、空间平均、参考/背景)、峰谷检测标注、波长着色、对数坐标、辐照系数修正、六种界面语言。仅需最新版 Chrome。

## 快速开始

```bash
npm install
npm run dev      # 本地开发
npm run build    # 构建产物在 dist/
```

线上部署:导入 Vercel 即可零配置上线(摄像头需要 HTTPS,Vercel 默认提供)。

首次使用:连接摄像头后按提示用荧光灯完成校准(工具 → 校准点 → 荧光 436 546,然后拖动顶部 436/546 标签对准汞谱线)。

## 授权

GNU GPL v3。本项目不是 Theremino Spectrometer,与 Theremino System 无隶属关系;它是一款界面与功能参考该软件的独立 Web 实现。

## 致谢

特别感谢 [www.theremino.com](https://www.theremino.com) 与 [Stefano Marchetti](https://www.maestrodartemestiere.it/it/libro-d-oro/2020/stefano-marchetti)——Theremino 项目以"No Copyright"方式无私公开了全部源码与文档,没有他们在开源科学仪器上的卓越工作,就不会有这个项目。
