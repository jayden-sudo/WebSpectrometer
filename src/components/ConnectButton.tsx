// Connect/Disconnect toggle button (shared by VideoInputPanel and SerialPortPanel)
// Connected persistence is written by the engine on connect success/disconnect; do not touch settings here
import { useAppState } from '../app/store'
import { useT } from '../i18n'
import { disconnectCamera } from '../app/engine'
import { ToggleButton } from './ToggleButton'

export function ConnectButton({ connect }: { connect: () => Promise<void> }) {
  const { runtime } = useAppState()
  const t = useT()
  return (
    <ToggleButton
      active={runtime.connected}
      onClick={() => {
        if (runtime.connected) void disconnectCamera()
        else void connect().catch((err) => alert(String(err)))
      }}
    >
      {runtime.connected ? t('Msg_Disconnect') : t('Msg_Connect')}
    </ToggleButton>
  )
}
