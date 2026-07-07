// Web-only i18n keys (not present in the original program's language files).
// Kept separate from locales/*.json to preserve provenance: the JSONs mirror
// the original program's language files verbatim, while these keys are ours.
// {path} is replaced at runtime with the translated menu path
// (Menu_Tools → Menu_Tools_TrimPoints → Menu_Tools_Trim1).
import type { LangCode } from './index'

export const EXTRA_KEYS: Record<LangCode, Record<string, string>> = {
  ENG: {
    Msg_NotCalibrated:
      'No spectrum calibration found. Wavelengths are unreliable until calibrated — use a fluorescent lamp and {path} to calibrate.',
    Msg_CalibrateNow: 'Calibrate now (436/546)',
    Msg_Ignore: 'Ignore',
    Menu_Help_GitHubReadme: 'README on GitHub',
  },
  CHI: {
    Msg_NotCalibrated: '检测到尚未进行光谱校准。未校准的光谱波长不可信,建议使用荧光灯光源执行 {path} 完成校准。',
    Msg_CalibrateNow: '立即校准 (436/546)',
    Msg_Ignore: '忽略',
    Menu_Help_GitHubReadme: 'GitHub 上的 README',
  },
  CHT: {
    Msg_NotCalibrated: '偵測到尚未進行光譜校準。未校準的光譜波長不可信,建議使用螢光燈光源執行 {path} 完成校準。',
    Msg_CalibrateNow: '立即校準 (436/546)',
    Msg_Ignore: '忽略',
    Menu_Help_GitHubReadme: 'GitHub 上的 README',
  },
  ITA: {
    Msg_NotCalibrated:
      "Nessuna calibrazione dello spettro trovata. Le lunghezze d'onda non sono affidabili finché non si calibra — usa una lampada fluorescente ed esegui {path} per calibrare.",
    Msg_CalibrateNow: 'Calibra ora (436/546)',
    Msg_Ignore: 'Ignora',
    Menu_Help_GitHubReadme: 'README su GitHub',
  },
  FRA: {
    Msg_NotCalibrated:
      "Aucune calibration du spectre détectée. Les longueurs d'onde ne sont pas fiables tant que l'appareil n'est pas calibré — utilisez une lampe fluorescente et exécutez {path} pour calibrer.",
    Msg_CalibrateNow: 'Calibrer maintenant (436/546)',
    Msg_Ignore: 'Ignorer',
    Menu_Help_GitHubReadme: 'README sur GitHub',
  },
  POR: {
    Msg_NotCalibrated:
      'Nenhuma calibração do espectro encontrada. Os comprimentos de onda não são confiáveis até a calibração — use uma lâmpada fluorescente e execute {path} para calibrar.',
    Msg_CalibrateNow: 'Calibrar agora (436/546)',
    Msg_Ignore: 'Ignorar',
    Menu_Help_GitHubReadme: 'README no GitHub',
  },
}
