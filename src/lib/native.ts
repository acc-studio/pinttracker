import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Share } from '@capacitor/share'

export const isNative = Capacitor.isNativePlatform()

export function tap(strong = false) {
  if (isNative) {
    Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {})
  } else {
    navigator.vibrate?.(strong ? 25 : 10)
  }
}

/** Save a text file: browser download on web, share sheet on Android. */
export async function saveFile(name: string, content: string, mime: string) {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: name, url: uri })
    return
  }
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
