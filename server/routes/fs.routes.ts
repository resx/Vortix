/* ── 文件系统路由 ── */

import { Router, raw as expressRaw } from 'express'
import { readdirSync, statSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'

const router = Router()

// 列出指定路径下的子目录
router.get('/fs/list-dirs', (req, res) => {
  const rawPath = (req.query.path as string) || ''
  const home = homedir()
  const basePath = rawPath ? resolve(rawPath) : home

  // 路径遍历防护：只允许访问用户主目录及其子目录
  if (!basePath.startsWith(home)) {
    res.status(403).json({ success: false, error: '禁止访问用户主目录之外的路径' })
    return
  }

  try {
    const entries = readdirSync(basePath, { withFileTypes: true })
    const dirs = entries
      .filter(e => {
        if (!e.isDirectory()) return false
        if (e.name.startsWith('.') || e.name.startsWith('$')) return false
        try { statSync(join(basePath, e.name)); return true } catch { return false }
      })
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

    res.json({ success: true, data: { path: basePath, dirs } })
  } catch (err) {
    res.json({ success: false, error: `无法读取目录: ${(err as Error).message}` })
  }
})

// 调用系统原生文件夹选择对话框（现代 Vista+ 样式）
router.post('/fs/pick-dir', (req, res) => {
  const { initialDir } = req.body as { initialDir?: string }

  // PowerShell 安全转义：单引号包裹，内部 ' → ''
  const initDirCs = initialDir ? initialDir.replace(/'/g, "''") : ''
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class FolderPicker {
  [DllImport("shell32.dll",CharSet=CharSet.Unicode,PreserveSig=false)]
  static extern void SHCreateItemFromParsingName(string n,IntPtr p,ref Guid r,out IntPtr v);
  public static string Pick(string init){
    var d=(IFileOpenDialog)new _FD();
    uint opts;d.GetOptions(out opts);
    d.SetOptions(opts|0x20);
    d.SetTitle("选择工作目录");
    if(!string.IsNullOrEmpty(init)){try{
      Guid g=new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
      IntPtr si;SHCreateItemFromParsingName(init,IntPtr.Zero,ref g,out si);
      d.SetFolder(si);Marshal.Release(si);
    }catch{}}
    if(d.Show(IntPtr.Zero)!=0)return"";
    IntPtr ri;d.GetResult(out ri);
    var item=(IShellItem)Marshal.GetObjectForIUnknown(ri);
    string path;item.GetDisplayName(0x80058000u,out path);
    Marshal.Release(ri);return path;
  }
  [ComImport,Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]class _FD{}
  [ComImport,Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IFileOpenDialog{
    [PreserveSig]int Show(IntPtr w);void SetFileTypes(uint c,IntPtr f);
    void SetFileTypeIndex(uint i);void GetFileTypeIndex(out uint i);
    void Advise(IntPtr e,out uint k);void Unadvise(uint k);
    void SetOptions(uint o);void GetOptions(out uint o);
    void SetDefaultFolder(IntPtr i);void SetFolder(IntPtr i);
    void GetFolder(out IntPtr i);void GetCurrentSelection(out IntPtr i);
    void SetFileName([MarshalAs(UnmanagedType.LPWStr)]string n);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)]out string n);
    void SetTitle([MarshalAs(UnmanagedType.LPWStr)]string t);
    void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)]string t);
    void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)]string t);
    void GetResult(out IntPtr i);void AddPlace(IntPtr i,int p);
    void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)]string e);
    void Close(int r);void SetClientGuid(ref Guid g);void ClearClientData();
    void SetFilter(IntPtr f);void GetResults(out IntPtr e);void GetSelectedItems(out IntPtr e);
  }
  [ComImport,Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItem{
    void BindToHandler(IntPtr p,ref Guid b,ref Guid r,out IntPtr v);
    void GetParent(out IntPtr i);
    void GetDisplayName(uint s,[MarshalAs(UnmanagedType.LPWStr)]out string n);
    void GetAttributes(uint m,out uint a);void Compare(IntPtr i,uint h,out int o);
  }
}
'@
Write-Output ([FolderPicker]::Pick('${initDirCs}'))
`.trim()

  execFile('powershell', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { timeout: 60000 }, (err, stdout) => {
    if (err) {
      res.json({ success: false, error: err.message })
      return
    }
    const selected = stdout.trim()
    res.json({ success: true, data: { path: selected || null } })
  })
})

// 调用系统原生文件选择对话框（选择私钥等文件，返回路径+内容）
router.post('/fs/pick-file', (req, res) => {
  const { title, filters } = req.body as { title?: string; filters?: string }

  // PowerShell 安全转义：单引号包裹，内部 ' → ''
  const titleCs = (title || '选择文件').replace(/'/g, "''")
  // filters 格式: "私钥文件|*.pem;*.key;*.ppk;*.id_rsa|所有文件|*.*"
  const filterCs = (filters || '所有文件|*.*').replace(/'/g, "''")

  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Title = '${titleCs}'
$d.Filter = '${filterCs}'
$d.Multiselect = $false
if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName } else { Write-Output '' }
`.trim()

  execFile('powershell', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { timeout: 60000 }, (err, stdout) => {
    if (err) {
      res.json({ success: false, error: err.message })
      return
    }
    const filePath = stdout.trim()
    if (!filePath) {
      res.json({ success: true, data: { path: null, content: null } })
      return
    }
    try {
      const content = readFileSync(filePath, 'utf8')
      res.json({ success: true, data: { path: filePath, content } })
    } catch (e) {
      res.json({ success: false, error: `无法读取文件: ${(e as Error).message}` })
    }
  })
})

// 保存下载文件到本地磁盘（默认 ~/Downloads/vortix-download/）
router.post('/fs/save-download', expressRaw({ limit: '500mb', type: '*/*' }), (req, res) => {
  const fileName = req.headers['x-file-name'] as string
  const targetDir = (req.headers['x-target-dir'] as string) || ''

  if (!fileName) {
    res.status(400).json({ success: false, error: '缺少文件名' })
    return
  }

  const defaultDir = join(homedir(), 'Downloads', 'vortix-download')
  const saveDir = targetDir ? resolve(targetDir) : defaultDir

  try {
    mkdirSync(saveDir, { recursive: true })
    const filePath = join(saveDir, fileName)
    writeFileSync(filePath, Buffer.from(req.body as ArrayBuffer))
    res.json({ success: true, data: { path: filePath } })
  } catch (err) {
    res.json({ success: false, error: `保存失败: ${(err as Error).message}` })
  }
})

// 用系统默认程序打开本地文件（无关联程序时弹出系统选择菜单）
router.post('/fs/open-local', (req, res) => {
  const { path: filePath } = req.body as { path: string }
  if (!filePath) {
    res.status(400).json({ success: false, error: '缺少文件路径' })
    return
  }

  // Windows: rundll32 url.dll,FileProtocolHandler "path"
  // 比 cmd /c start 更可靠：无关联程序时弹出"选择打开方式"而非报错
  execFile('rundll32', ['url.dll,FileProtocolHandler', filePath], { timeout: 10000 }, (err) => {
    // rundll32 几乎不会返回错误，即使文件无关联也会弹出选择对话框
    if (err) {
      // 回退到 cmd /c start（兼容性保底）
      execFile('cmd', ['/c', 'start', '', filePath], { timeout: 10000 }, () => {
        // 无论成功失败都返回成功，系统会自行处理打开方式选择
        res.json({ success: true, data: null })
      })
      return
    }
    res.json({ success: true, data: null })
  })
})

// 调用系统原生保存文件对话框（返回用户选择的保存路径）
router.post('/fs/pick-save-path', (req, res) => {
  const { fileName, filters } = req.body as { fileName?: string; filters?: string }

  const fileNameCs = (fileName || '').replace(/'/g, "''")
  const filterCs = (filters || '所有文件|*.*').replace(/'/g, "''")

  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.SaveFileDialog
$d.Title = '保存文件'
$d.Filter = '${filterCs}'
$d.FileName = '${fileNameCs}'
$d.OverwritePrompt = $true
if ($d.ShowDialog() -eq 'OK') { Write-Output $d.FileName } else { Write-Output '' }
`.trim()

  execFile('powershell', ['-NoProfile', '-NonInteractive', '-STA', '-Command', script], { timeout: 60000 }, (err, stdout) => {
    if (err) {
      res.json({ success: false, error: err.message })
      return
    }
    const selected = stdout.trim()
    res.json({ success: true, data: { path: selected || null } })
  })
})

export default router
