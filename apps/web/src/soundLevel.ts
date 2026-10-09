import { setting, useSetting } from './settings'
import type { SoundLevel } from './sounds'
import { loadChatSound, loadSoundLevel, saveChatSound, saveSoundLevel } from './storage'

// The button sits in the table, which remounts with each deal, and the sounds play from above
// it, so the level is a page-wide setting.
const soundLevel = setting<SoundLevel>(loadSoundLevel, saveSoundLevel)
const chatSound = setting<boolean>(loadChatSound, saveChatSound)

/** How much you hear, kept in the browser. */
export const useSoundLevel = () => useSetting(soundLevel)

/** Whether a new chat line clinks, kept in the browser. The Off step silences it too. */
export const useChatSound = () => useSetting(chatSound)
