/* ── SFTP 上传辅助（UI 选择器） ── */

/** 弹出文件选择器 */
export function pickFiles(multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = multiple
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : [])
    }
    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (!input.files?.length) resolve([])
      }, 300)
    }, { once: true })
    input.click()
  })
}

/** 弹出文件夹选择器 */
export function pickFolder(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.setAttribute('webkitdirectory', '')
    input.onchange = () => {
      resolve(input.files ? Array.from(input.files) : [])
    }
    window.addEventListener('focus', () => {
      setTimeout(() => {
        if (!input.files?.length) resolve([])
      }, 300)
    }, { once: true })
    input.click()
  })
}
