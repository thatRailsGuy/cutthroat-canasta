import { useEffect } from 'react'

const APP = 'Cutthroat Canasta'

/** Sets the browser tab's title, such as "Rules · Cutthroat Canasta". Null leaves just the name. */
export function useTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${APP}` : APP
  }, [title])
}
