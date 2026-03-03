import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, Terminal, Database, Package, Zap,
  Search, Crosshair, FolderPlus, Link as LinkIcon, 
  ChevronRight, ChevronDown, MoreVertical, Pin, Minus, Square, X,
  Moon, User, Crown, Home, RefreshCw, Cast, Eye, EyeOff, List,
  ArrowUpRight, Hexagon, AlignJustify,
  FileX, Edit2, Copy, Scissors, Clipboard, FileDown, FileUp,
  Monitor, Network, Usb, Plus, Key, Activity, CopyPlus,
  Columns, ExternalLink, FilePlus, ChevronUp, ChevronLeft,
  SquareTerminal, Link2Off, Clock, File, Cpu, HardDrive, PlayCircle, StopCircle, ArrowUp, ArrowDown,
  Sun, History, Languages, CircleHelp, Settings, RotateCw, LogOut, Gift, Headset, Check, SquareMinus,
  CloudFog, Copy as CopyIcon, FolderArchive
} from 'lucide-react';

// --- Custom SVG Icons ---
const FolderEyeIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
    <path d="M9 13.5c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5-1.5 2.5-3 2.5-3-1-3-2.5Z"></path>
    <circle cx="12" cy="13.5" r="1"></circle>
  </svg>
);

const PingIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 20h8" />
    <path d="M12 20v-5" />
    <circle cx="12" cy="11" r="2" fill="currentColor" />
    <path d="M8.5 14.5a5 5 0 0 1 0-7" />
    <path d="M15.5 14.5a5 5 0 0 0 0-7" />
    <path d="M5.5 17.5a9 9 0 0 1 0-13" />
    <path d="M18.5 17.5a9 9 0 0 0 0-13" />
  </svg>
);

const PingOffIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 20h8" />
    <path d="M12 20v-5" />
    <circle cx="12" cy="11" r="2" fill="currentColor" />
    <path d="M8.5 14.5a5 5 0 0 1 0-7" />
    <path d="M15.5 14.5a5 5 0 0 0 0-7" />
    <path d="M5.5 17.5a9 9 0 0 1 0-13" />
    <path d="M18.5 17.5a9 9 0 0 0 0-13" />
    <line x1="3" y1="3" x2="21" y2="21" />
  </svg>
);

const ThemeSystemIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
    <path d="M19 3v4"></path>
    <path d="M21 5h-4"></path>
  </svg>
);

// New Icon: Transfer (Dashed circle with down arrow)
const TransferIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 0 0 0 20" strokeDasharray="4 4" />
    <path d="M12 2a10 10 0 0 1 0 20" />
    <path d="M12 8v8M8 12l4 4 4-4" />
  </svg>
);

// New Icon: Broadcast (Concentric arcs with dot)
const BroadcastIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <path d="M8 8a6 6 0 0 1 8 0" />
    <path d="M8 16a6 6 0 0 0 8 0" />
    <path d="M5 5a10 10 0 0 1 14 0" />
    <path d="M5 19a10 10 0 0 0 14 0" />
  </svg>
);

// New Icon: History (Cloud containing a clock)
const CloudClockIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    <circle cx="15" cy="14" r="3" fill="#fff" stroke="currentColor" />
    <path d="M15 12.5v1.5l1 1" stroke="currentColor" />
  </svg>
);

// --- MOCK DATA ---
const ASSETS_DATA = [
  { id: '1', name: 'Docker', type: 'folder', isOpen: true, children: [] },
  { id: '2', name: '业务', type: 'folder', isOpen: false, children: [] },
  { id: '3', name: '科学', type: 'folder', isOpen: false, children: [] },
  { id: '4', name: '远控', type: 'folder', isOpen: false, children: [] },
  { id: '5', name: '龟壳', type: 'folder', isOpen: false, children: [] },
];

const SHORTCUTS_DATA = [
  { id: 'c1', name: '开发运营', type: 'folder', isOpen: true, children: [] },
  { id: 'c2', name: '系统管理员', type: 'folder', isOpen: false, children: [] },
  { id: 'c3', name: '网络工程师', type: 'folder', isOpen: true, children: [
    { id: 's1', name: 'dd脚本' },
    { id: 's2', name: 'DMIT调优' },
    { id: 's3', name: 'docker compose 更新' },
    { id: 's4', name: 'mc连接存储桶服务' },
  ]},
];

const TABLE_DATA = [
  { id: 't1', name: 'Docker', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-12-16 23:57', expire: '-', remark: '-' },
  { id: 't2', name: '业务', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:31', expire: '-', remark: '-' },
  { id: 't3', name: '科学', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:31', expire: '-', remark: '-' },
  { id: 't4', name: '远控', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:31', expire: '-', remark: '-' },
  { id: 't5', name: '龟壳', type: 'folder', latency: '-', host: '-', user: '-', created: '2025-09-30 19:45', expire: '-', remark: '-' },
  { id: 't6', name: 'Bandwagon Megabox', type: 'asset', latency: '-', host: '10.0.1.15', user: 'root', created: '2025-12-16 23:57', expire: '-', remark: '生产环境', folderName: '科学' },
  { id: 't7', name: 'Oracle Cloud SG', type: 'asset', latency: '-', host: '192.168.1.1', user: 'ubuntu', created: '2025-10-10 12:00', expire: '-', remark: '测试环境', folderName: '龟壳' },
  { id: 't8', name: 'Berohost', type: 'asset', latency: '-', host: '192.168.1.2', user: 'root', created: '2025-10-10 12:00', expire: '-', remark: '业务', folderName: '业务' }
];

const MOCK_SFTP_FILES = [
  { name: '..', isDir: true, date: '-', size: '-' },
  { name: '.cache', isDir: true, date: '2025-05-13 01:46', size: '4K' },
  { name: '.ssh', isDir: true, date: '2026-02-10 05:13', size: '4K' },
  { name: '.wget-hsts', isDir: false, typeIcon: '?', date: '2026-02-10 05:15', size: '18B' },
  { name: '.profile', isDir: false, typeIcon: 'T', date: '2019-07-09 03:05', size: '161B' },
  { name: '.history', isDir: false, typeIcon: '?', date: '2025-05-13 01:46', size: '0B' },
  { name: '.bashrc', isDir: false, typeIcon: 'T', date: '2021-04-10 13:00', size: '57K' },
  { name: '.bash_history', isDir: false, typeIcon: '?', date: '2026-02-10 05:16', size: '20K' },
];

const RECENT_PROJECTS = [
  { name: 'Huawei', icon: Terminal },
  { name: 'Bandwagon Megabox', icon: Terminal },
  { name: 'OVH KS-LE-B Ultra', icon: Terminal },
  { name: 'HostDZire', icon: Terminal },
  { name: 'RFC JP CO adv', icon: Terminal },
  { name: 'local', icon: Terminal },
  { name: 'local', icon: Terminal },
  { name: 'RFC Jinx', icon: Terminal },
  { name: 'RFC JP T1', icon: Terminal },
  { name: 'RFC JP CO', icon: Terminal },
  { name: 'RFC JP2', icon: Terminal },
];

const MOCK_HISTORY_CMDS = [
  { cmd: 'nvim docker-compose.yml', date: '2026-02-27 21:39' },
  { cmd: 'mkdir dock', date: '2026-02-27 21:41' },
  { cmd: 'cd docker/', date: '2026-02-27 21:42' },
  { cmd: 'curl -sL https://raw.githubu..', date: '2026-02-27 21:43' },
  { cmd: 'cd', date: '2026-02-27 21:45' },
  { cmd: 'docker compose up', date: '2026-02-27 21:45' },
  { cmd: 'cd docker/debian@ovh-leb:~/.d..', date: '2026-02-27 21:45' },
  { cmd: 'rm -rf watchtower-entrypoint..', date: '2026-02-27 21:45' },
  { cmd: 'cl', date: '2026-02-27 21:45' },
  { cmd: 'curl -fsSL https://raw.githu..', date: '2026-02-27 21:46' },
  { cmd: 'cat watchtower.Dockerfile', date: '2026-02-27 21:46' },
  { cmd: 'cd ..', date: '2026-02-27 21:46' },
  { cmd: 'docker compose up -d', date: '2026-02-27 21:46' },
  { cmd: 'cd typecho/', date: '2026-02-27 22:38' },
];

// --- COMPONENTS ---

const Toggle = ({ checked, onChange }) => (
  <div 
    onClick={onChange} 
    className={`w-[36px] h-[20px] rounded-full relative cursor-pointer transition-colors duration-200 shrink-0 ${checked ? 'bg-[#4080FF]' : 'bg-[#E5E6EB]'}`}
  >
    <div className={`absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
  </div>
);

const SettingsDropdown = ({ value, options, width = 'w-auto', isFontSelector = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div 
        className="flex items-center gap-1 cursor-pointer text-[#4E5969] hover:text-[#1F2329] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[13px]">{value}</span>
        <ChevronDown size={14} />
      </div>

      {open && (
        <div className={`absolute right-0 top-full mt-1 bg-white border border-[#E5E6EB] rounded-lg shadow-[0_4px_20px_rgba(0,0,0,0.12)] z-[1050] overflow-hidden flex flex-col ${width}`}>
          {isFontSelector && (
            <div className="px-2 py-2 flex items-center justify-between border-b border-[#E5E6EB]/50 bg-[#F7F8FA]">
              <div className="relative flex-1 mr-2">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#86909C]" />
                <input type="text" className="w-full bg-white border border-[#E5E6EB] rounded px-2 pl-7 py-1 text-[12px] text-[#1F2329] outline-none" />
              </div>
              <div className="flex items-center gap-1 text-[12px] text-[#4E5969] cursor-pointer shrink-0">
                <SquareMinus size={14} /> 全选
              </div>
            </div>
          )}

          <div className="max-h-[240px] overflow-y-auto py-1 custom-scrollbar">
            {options.map((opt, idx) => (
              <div 
                key={idx} 
                className={`px-3 py-1.5 text-[13px] flex items-center justify-between cursor-pointer transition-colors ${opt.active ? 'bg-[#E8F0FE] text-[#4080FF]' : 'hover:bg-[#F2F3F5] text-[#1F2329]'}`}
                onClick={() => setOpen(false)}
              >
                <div className="flex items-center gap-2">
                  {isFontSelector && (
                    <div className={`w-[14px] h-[14px] rounded-[3px] border flex items-center justify-center ${opt.checked ? 'bg-[#4080FF] border-[#4080FF]' : 'border-[#C9CDD4]'}`}>
                      {opt.checked && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                  )}
                  <span className={isFontSelector ? "font-mono" : ""}>{opt.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- SETTINGS MODAL ---
const SettingsModal = ({ onClose }) => {
  const [showRightInfo, setShowRightInfo] = useState(true);
  
  return (
    <div className="fixed inset-0 z-[1000] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-[fade-in_0.2s_ease-out]">
      <div className="w-[960px] max-w-[95vw] h-[680px] max-h-[95vh] bg-[#F2F3F5] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[scale-in_0.2s_ease-out]">
        <div className="h-[52px] flex items-center justify-between px-5 shrink-0 select-none bg-[#F2F3F5]">
          <span className="text-[#1F2329] font-medium text-[15px]">设置</span>
          <button 
            className="text-[#86909C] hover:text-[#1F2329] hover:bg-[#E5E6EB] p-1.5 rounded-lg transition-colors" 
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[180px] flex flex-col py-2 overflow-y-auto custom-scrollbar shrink-0 select-none bg-[#F2F3F5]">
            <div className="text-[12px] text-[#86909C] px-5 py-1.5 mb-1 mt-1 font-medium">通用</div>
            <div className="text-[13px] text-[#1F2329] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] font-medium px-4 py-2 cursor-pointer rounded-lg mx-3 mb-0.5">基础</div>
            <div className="text-[13px] text-[#4E5969] hover:bg-[#E5E6EB]/50 px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5">SSH/SFTP</div>
            <div className="text-[13px] text-[#4E5969] hover:bg-[#E5E6EB]/50 px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5">数据库</div>
            
            <div className="text-[13px] text-[#4E5969] px-4 py-2 mt-2 cursor-pointer hover:bg-[#E5E6EB]/50 transition-colors rounded-lg mx-3 mb-0.5">账号</div>
            
            <div className="text-[12px] text-[#86909C] px-5 py-1.5 mb-1 mt-3 font-medium">快捷键</div>
            <div className="text-[13px] text-[#4E5969] hover:bg-[#E5E6EB]/50 px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5">基础</div>
            <div className="text-[13px] text-[#4E5969] hover:bg-[#E5E6EB]/50 px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5">SSH/SFTP</div>
            <div className="text-[13px] text-[#4E5969] hover:bg-[#E5E6EB]/50 px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5">数据库</div>
            <div className="text-[13px] text-[#4E5969] hover:bg-[#E5E6EB]/50 px-4 py-2 cursor-pointer transition-colors rounded-lg mx-3 mb-0.5">Docker</div>

            <div className="text-[13px] text-[#4E5969] px-4 py-2 mt-2 cursor-pointer hover:bg-[#E5E6EB]/50 transition-colors rounded-lg mx-3 mb-0.5">储存仓库</div>
            <div className="text-[13px] text-[#4E5969] px-4 py-2 mt-1 cursor-pointer hover:bg-[#E5E6EB]/50 transition-colors rounded-lg mx-3 mb-0.5">推介有奖</div>
          </div>

          <div className="flex-1 bg-white rounded-tl-2xl shadow-[-4px_0_12px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden relative">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-24">
              <div className="text-[16px] font-medium text-[#1F2329] mb-8">基本</div>
              <div className="grid grid-cols-2 gap-x-16 gap-y-7">
                <div className="flex flex-col gap-7">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">主题</span>
                    <SettingsDropdown value="Light" width="w-[120px]" options={[ { label: 'auto', active: false }, { label: 'light', active: true }, { label: 'dark', active: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">鼠标中键关闭选项卡</span>
                    <Toggle checked={true} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">UI 字体</span>
                    <SettingsDropdown value="JetBrainsMono, NotoSansSC" width="w-[260px]" isFontSelector={true} options={[ { label: '(内置)JetBrainsMono', checked: true }, { label: '(内置)思源黑体', checked: true }, { label: '(内置)系统字体', checked: false }, { label: 'Arial', checked: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">编辑器换行符</span>
                    <SettingsDropdown value="(兼容) \r\n" width="w-[150px]" options={[ { label: '(兼容) \\r\\n', active: true }, { label: '(Windows) \\n', active: false }, { label: '(Linux) \\r', active: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">是否开启动动画</span>
                    <Toggle checked={false} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1 w-3/4">
                      <span className="text-[13px] text-[#1F2329]">显示右侧实时信息</span>
                      <span className="text-[12px] text-[#86909C]">关闭后将隐藏服务器实时指标</span>
                    </div>
                    <Toggle checked={showRightInfo} onChange={() => setShowRightInfo(!showRightInfo)} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">Tab 栏关闭按钮位置</span>
                    <div className="flex items-center gap-3 text-[13px] text-[#4E5969]">靠左 <Toggle checked={true} onChange={()=>{}} /></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">连体字效果</span>
                    <Toggle checked={true} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">鼠标滚轮缩放</span>
                    <Toggle checked={true} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1 w-[85%]">
                      <span className="text-[13px] text-[#1F2329]">标签关闭确认</span>
                      <span className="text-[12px] text-[#86909C]">关闭后 SSH、终端等标签关闭时不显示确认提示弹窗</span>
                    </div>
                    <Toggle checked={true} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1 w-[85%]">
                      <span className="text-[13px] text-[#1F2329]">标签闪烁提醒</span>
                      <span className="text-[12px] text-[#86909C]">非当前标签页有新活动时，将触发闪烁提醒</span>
                    </div>
                    <Toggle checked={true} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1 w-[85%]">
                      <span className="text-[13px] text-[#1F2329]">多行显示标签卡</span>
                      <span className="text-[12px] text-[#86909C]">标签卡过多时以多行方式显示，而不是横向滚动</span>
                    </div>
                    <Toggle checked={false} onChange={()=>{}} />
                  </div>
                </div>

                <div className="flex flex-col gap-7">
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">语言</span>
                    <SettingsDropdown value="简体中文" width="w-[120px]" options={[ { label: '简体中文', active: true }, { label: 'English', active: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1 w-3/4">
                      <span className="text-[13px] text-[#1F2329]">更新通道</span>
                      <span className="text-[12px] text-[#86909C]">修改后需重启生效，通道之间资产不共享</span>
                    </div>
                    <SettingsDropdown value="实验性通道" width="w-[140px]" options={[ { label: '稳定通道', active: false }, { label: '实验性通道', active: true } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">编辑器字体</span>
                    <SettingsDropdown value="MonoLisa Variable" width="w-[240px]" isFontSelector={true} options={[ { label: 'MonoLisa Variable', checked: true }, { label: '(内置)系统字体', checked: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">缩放比例</span>
                    <SettingsDropdown value="100%" width="w-[100px]" options={[ { label: '90%', active: false }, { label: '100%', active: true }, { label: '110%', active: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">编辑器字号</span>
                    <SettingsDropdown value="14px" width="w-[100px]" options={[ { label: '12px', active: false }, { label: '14px', active: true }, { label: '16px', active: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">编辑器自动换行</span>
                    <Toggle checked={false} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">编辑器 Tab 键模式</span>
                    <SettingsDropdown value="制表符\t" width="w-[120px]" options={[ { label: '制表符\\t', active: true }, { label: '两个空格', active: false }, { label: '四个空格', active: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">启动锁屏</span>
                    <div className="flex items-center gap-3 text-[12px] text-[#86909C]">启动时询问密码，登录账号后启用 <Toggle checked={false} onChange={()=>{}} /></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-[#1F2329]">自动锁屏时间</span>
                    <SettingsDropdown value="关闭" width="w-[100px]" options={[ { label: '关闭', active: true }, { label: '5分钟', active: false }, { label: '15分钟', active: false } ]} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] text-[#1F2329]">锁屏密码</span>
                      <span className="text-[12px] text-[#86909C]">(登录账号后，可启用锁屏) <Eye size={14} className="inline ml-1 text-[#1F2329]"/></span>
                    </div>
                    <input disabled type="password" placeholder="" className="w-[160px] h-[28px] border border-[#E5E6EB] bg-[#F7F8FA] rounded" />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] text-[#1F2329]">会话标签记忆</span>
                      <span className="text-[12px] text-[#86909C]">(启用后，启动会自动还原上次打开的标签)</span>
                    </div>
                    <Toggle checked={false} onChange={()=>{}} />
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] text-[#1F2329]">显示会员标志</span>
                      <span className="text-[12px] text-[#86909C]">(关闭后，付费用户将不会在顶部显示会员图标)</span>
                    </div>
                    <Toggle checked={true} onChange={()=>{}} />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 h-[64px] bg-white/90 backdrop-blur-md border-t border-[#E5E6EB] flex items-center justify-end px-8 gap-4 rounded-br-2xl z-10">
               <span className="text-[#86909C] text-[12px] mr-2">修改设置后如未生效，请重启页面或重启应用</span>
               <button className="px-5 py-2 bg-[#F2F3F5] text-[#4E5969] rounded-lg text-[13px] hover:bg-[#E5E6EB] transition-colors font-medium">恢复默认</button>
               <button className="px-5 py-2 text-[#B5C7FF] rounded-lg text-[13px] font-medium pointer-events-none">应用 (Ctrl+S)</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- SERVER PANEL DRAWER COMPONENT ---
const ServerPanelDrawer = ({ asset, onClose }) => {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E6EB] shrink-0">
        <span className="text-[#1F2329] font-medium text-[14px]">服务器面板</span>
        <button onClick={onClose} className="text-[#86909C] hover:text-[#1F2329] hover:bg-[#F2F3F5] p-1.5 rounded transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        <div className="bg-white rounded-lg p-3 border border-[#E5E6EB] grid grid-cols-2 gap-y-3 gap-x-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[#86909C] text-[12px]"><User size={12}/> 用户</div>
            <div className="text-[#1F2329] text-[13px] font-mono pl-4">{asset.user}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[#86909C] text-[12px]"><Clock size={12}/> 运行时间</div>
            <div className="text-[#1F2329] text-[13px] font-mono pl-4">59d 9h 40m</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[#86909C] text-[12px]"><Monitor size={12}/> Host</div>
            <div className="text-[#1F2329] text-[13px] font-mono pl-4">{asset.host}</div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-[#86909C] text-[12px]"><Terminal size={12}/> 系统</div>
            <div className="text-[#1F2329] text-[13px] font-mono pl-4">debian gnu/linu...</div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-[#E5E6EB] space-y-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="flex flex-col">
              <span className="text-[#1F2329] text-[13px] font-mono">4.1%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">平均CPU占用</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#1F2329] text-[13px] font-mono">1.9%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">内核态</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#1F2329] text-[13px] font-mono">1.1%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">用户态</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[#1F2329] text-[13px] font-mono">0.0%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">IO等待</span>
            </div>
            <div className="flex flex-col mt-1">
              <span className="text-[#1F2329] text-[13px] font-mono">16.2%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">总共CPU占用</span>
            </div>
            <div className="flex flex-col mt-1">
              <span className="text-[#1F2329] text-[13px] font-mono">7.7%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">内核态</span>
            </div>
            <div className="flex flex-col mt-1">
              <span className="text-[#1F2329] text-[13px] font-mono">4.6%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">用户态</span>
            </div>
            <div className="flex flex-col mt-1">
              <span className="text-[#1F2329] text-[13px] font-mono">0.0%</span>
              <span className="text-[#86909C] text-[11px] scale-90 origin-top">IO等待</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="flex flex-col items-center">
               <span className="text-[#86909C] text-[11px] mb-1">物理内存</span>
               <div className="w-full bg-[#E8F0FE] rounded-sm h-[14px] relative overflow-hidden flex items-center justify-center">
                 <div className="absolute left-0 top-0 bottom-0 bg-[#4080FF] w-[11%]"></div>
                 <span className="relative text-white text-[10px] font-mono z-10 mix-blend-difference drop-shadow-md">614.6MB/5.8GB</span>
               </div>
             </div>
             <div className="flex flex-col items-center">
               <span className="text-[#86909C] text-[11px] mb-1">Swap内存</span>
               <div className="w-full bg-[#82C8C1]/30 rounded-sm h-[14px] relative flex items-center justify-center overflow-hidden">
                 <div className="absolute left-0 top-0 bottom-0 bg-[#82C8C1] w-[0%]"></div>
                 <span className="text-white mix-blend-difference text-[10px] font-mono z-10">0B/0B</span>
               </div>
             </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-[#E5E6EB]">
           <div className="grid grid-cols-4 gap-2 text-center mb-3">
              <div className="flex flex-col">
                <span className="text-[#86909C] text-[11px]">总上行</span>
                <span className="text-[#4E5969] text-[12px] font-mono">6.5GB</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#86909C] text-[11px]">总下行</span>
                <span className="text-[#4E5969] text-[12px] font-mono">8.9GB</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#86909C] text-[11px]">实时上行</span>
                <span className="text-[#FADC19] text-[12px] font-mono font-medium">5.1KB/s</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[#86909C] text-[11px]">实时下行</span>
                <span className="text-[#00B42A] text-[12px] font-mono font-medium">3.1KB/s</span>
              </div>
           </div>
           
           <div className="flex justify-center gap-3 text-[10px] text-[#86909C] mb-2">
             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#4080FF]"></div>CPU</span>
             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#82C8C1]"></div>内存</span>
             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#FADC19]"></div>上行</span>
             <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm bg-[#00B42A]"></div>下行</span>
           </div>

           <div className="h-[60px] w-full border-b border-l border-[#E5E6EB] relative overflow-hidden">
              <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-full absolute inset-0">
                <polyline points="0,35 20,15 35,10 50,12 80,10 100,18" fill="none" stroke="#FADC19" strokeWidth="1"/>
                <polyline points="0,38 20,20 35,8 50,8 80,10 100,15" fill="none" stroke="#00B42A" strokeWidth="1"/>
                <polyline points="0,39 100,39" fill="none" stroke="#4080FF" strokeWidth="0.5"/>
                <polyline points="0,39.5 100,39.5" fill="none" stroke="#82C8C1" strokeWidth="0.5"/>
              </svg>
           </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-[#E5E6EB] space-y-1.5">
           <div className="flex items-center text-[12px] font-mono text-[#4E5969]">
             <span className="w-8">CPU1</span>
             <span className="flex-1 tracking-[0.2em] text-[#E5E6EB] overflow-hidden whitespace-nowrap mx-2">
               [<span className="text-[#C9CDD4]">|||||</span><span className="text-transparent">|||||||||||||||||||||</span>]
             </span>
             <span className="w-8 text-right">3.7%</span>
           </div>
           <div className="flex items-center text-[12px] font-mono text-[#4E5969]">
             <span className="w-8">CPU2</span>
             <span className="flex-1 tracking-[0.2em] text-[#E5E6EB] overflow-hidden whitespace-nowrap mx-2">
               [<span className="text-[#F53F3F]">|</span><span className="text-[#C9CDD4]">|||</span><span className="text-transparent">|||||||||||||||||||||</span>]
             </span>
             <span className="w-8 text-right">4.0%</span>
           </div>
        </div>
      </div>
    </>
  );
};

// --- TERMINAL COMPONENT ---
const TerminalSimulation = ({ asset, handleCloseTab }) => {
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      setLogs([
        { type: 'system', text: `Welcome to HexHub Terminal Simulation...` },
        { type: 'system', text: `Connecting to ${asset.host} port 22...` },
        { type: 'success', text: `Connection established.` },
      ]);
    }, 1000);
    return () => clearTimeout(timer);
  }, [asset]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isReady) {
      const cmd = input.trim();
      const newLogs = [...logs, { type: 'command', text: cmd, user: asset.user, host: asset.name, path: '~' }];

      if (cmd === 'exit') {
        if (depth > 1) {
          setDepth(depth - 1);
          newLogs.push({ type: 'system', text: 'logout' });
        } else {
          newLogs.push({ type: 'system', text: 'logout' });
          newLogs.push({ type: 'system', text: `Connection to ${asset.host} closed.` });
          setIsReady(false);
          setTimeout(() => handleCloseTab(), 600);
        }
      } else if (['su', 'bash', 'zsh', 'sh'].includes(cmd)) {
        setDepth(depth + 1);
      } else if (cmd !== '') {
        newLogs.push({ type: 'output', text: `bash: ${cmd}: command not found` });
      }

      setLogs(newLogs);
      setInput('');
    }
  };

  return (
    <div className="flex-1 bg-[#1E1E1E] text-[#D4D4D4] font-mono text-[13px] p-4 flex flex-col gap-1 overflow-auto focus:outline-none rounded-b-xl" onClick={() => document.getElementById('term-input')?.focus()}>
      {!isReady && logs.length === 0 && <div className="text-[#858585]">Initializing SSH channel...</div>}
      {logs.map((log, idx) => (
        <div key={idx}>
          {log.type === 'system' && <div className="text-[#858585]">{log.text}</div>}
          {log.type === 'success' && <div className="text-[#67C23A] mb-2">{log.text}</div>}
          {log.type === 'output' && <div className="text-[#D4D4D4]">{log.text}</div>}
          {log.type === 'command' && (
            <div className="flex items-center">
              <span className="text-[#67C23A]">{log.user}@{log.host}</span>
              <span className="text-[#D4D4D4] mx-1">:</span>
              <span className="text-[#409EFF]">{log.path}</span>
              <span className="text-[#D4D4D4] ml-1 mr-2">$</span>
              <span>{log.text}</span>
            </div>
          )}
        </div>
      ))}
      {isReady && (
        <div className="flex items-center mt-1">
          <span className="text-[#67C23A]">{asset.user}@{asset.name}</span>
          <span className="text-[#D4D4D4] mx-1">:</span>
          <span className="text-[#409EFF]">~</span>
          <span className="text-[#D4D4D4] ml-1 mr-2">$</span>
          <input id="term-input" autoFocus type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} className="flex-1 bg-transparent outline-none text-[#D4D4D4] caret-[#D4D4D4]" autoComplete="off" spellCheck="false" />
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
};


// --- MAIN APP ---
export default function App() {
  const [activeFilter, setActiveFilter] = useState('all'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hideEmptyFolders, setHideEmptyFolders] = useState(false);
  const [assets, setAssets] = useState(ASSETS_DATA);
  const [shortcuts, setShortcuts] = useState(SHORTCUTS_DATA);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, type: null, data: null });
  
  const [currentFolder, setCurrentFolder] = useState(null);
  const [isAnonymized, setIsAnonymized] = useState(false);
  const [isAssetHidden, setIsAssetHidden] = useState(false);
  const [showDirModal, setShowDirModal] = useState(false);
  const [dirName, setDirName] = useState('');
  const [pings, setPings] = useState({});
  const [showPing, setShowPing] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [activeNewSubmenu, setActiveNewSubmenu] = useState(null);
  const [isListDropdownOpen, setIsListDropdownOpen] = useState(false);

  // Layout & Global State
  const [tabs, setTabs] = useState([{ id: 'list', type: 'list', title: '列表' }]);
  const [activeTabId, setActiveTabId] = useState('list');
  const [sftpExpanded, setSftpExpanded] = useState(false);
  const [serverPanelOpen, setServerPanelOpen] = useState(false);
  
  // Header States
  const [themeMode, setThemeMode] = useState(0); 
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [activeMainMenuSub, setActiveMainMenuSub] = useState(null);
  const [isPinned, setIsPinned] = useState(false);
  
  const [showSettings, setShowSettings] = useState(false);
  
  // Header Dropdowns State
  const [activeHeaderPopover, setActiveHeaderPopover] = useState(null); // 'transfer', 'broadcast', 'history', null

  const activeTab = tabs.find(t => t.id === activeTabId);
  const newMenuRef = useRef(null);
  const listDropdownRef = useRef(null);
  const userMenuRef = useRef(null);
  const mainMenuRef = useRef(null);
  const headerToolsRef = useRef(null);

  useEffect(() => {
    if (activeTab && activeTab.type === 'asset' && activeTab.status === 'connecting') {
      const timer = setTimeout(() => {
        setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, status: 'connected' } : t));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTabId, tabs, activeTab]);

  useEffect(() => {
    setSftpExpanded(false);
    setServerPanelOpen(false);
    setActiveHeaderPopover(null);
  }, [activeTabId]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      setContextMenu(prev => ({ ...prev, visible: false }));
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) {
        setNewMenuOpen(false);
        setActiveNewSubmenu(null);
      }
      if (listDropdownRef.current && !listDropdownRef.current.contains(e.target)) {
        setIsListDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (mainMenuRef.current && !mainMenuRef.current.contains(e.target)) {
        setShowMainMenu(false);
        setActiveMainMenuSub(null);
      }
      if (headerToolsRef.current && !headerToolsRef.current.contains(e.target)) {
        setActiveHeaderPopover(null);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const toggleFolder = (data, setData, id) => {
    setData(data.map(item => item.id === id ? { ...item, isOpen: !item.isOpen } : item));
  };

  const handleContextMenu = (e, type, data = null) => {
    e.preventDefault();
    e.stopPropagation();
    let posX = e.clientX;
    let posY = e.clientY;
    if (window.innerHeight - posY < 450) posY = Math.max(0, window.innerHeight - 450);
    setContextMenu({ visible: true, x: posX, y: posY, type, data });
  };

  const handlePing = () => {
    const newPings = { ...pings };
    TABLE_DATA.forEach(row => {
      if (row.type === 'asset') newPings[row.id] = Math.floor(Math.random() * 80 + 10) + 'ms';
    });
    setPings(newPings);
  };

  const handleTogglePing = () => {
    setShowPing(!showPing);
    if (!showPing) handlePing();
  };

  const maskText = (text) => {
    if (!isAnonymized || !text || text === '-') return text;
    if (text.length <= 2) return text[0] + '*';
    return text[0] + '*'.repeat(text.length - 2) + text[text.length - 1];
  };

  const openAssetTab = (asset) => {
    if (!tabs.find(t => t.id === asset.id)) {
      setTabs([...tabs, { id: asset.id, type: 'asset', asset, status: 'connecting' }]);
    }
    setActiveTabId(asset.id);
  };

  const closeTab = (tabId) => {
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : 'list');
  };

  const cycleTheme = () => {
    setThemeMode((prev) => (prev + 1) % 3);
  };

  const getThemeConfig = () => {
    switch(themeMode) {
      case 0: return { Icon: ThemeSystemIcon, tooltip: '当前主题:跟随系统，切换后:暗色' };
      case 1: return { Icon: Moon, tooltip: '当前主题:暗色，切换后:亮色' };
      case 2: return { Icon: Sun, tooltip: '当前主题:亮色，切换后:跟随系统' };
      default: return { Icon: ThemeSystemIcon, tooltip: '' };
    }
  };

  const ThemeIcon = getThemeConfig().Icon;

  const TooltipButton = ({ icon: Icon, isActive, tooltipText, onClick, className = '' }) => (
    <div className="group relative w-full flex justify-center">
      <button 
        onClick={onClick}
        className={`p-[6px] rounded-lg transition-colors w-[32px] h-[32px] flex items-center justify-center ${isActive ? 'bg-[#E5E6EB] text-[#1F2329]' : 'text-[#86909C] hover:bg-[#E5E6EB]/60 hover:text-[#1F2329]'} ${className}`}
      >
        <Icon className="w-[18px] h-[18px]" />
      </button>
      <div className="absolute left-[40px] top-1/2 -translate-y-1/2 hidden group-hover:flex items-center z-[150]">
        <div className="w-0 h-0 border-y-[4px] border-y-transparent border-r-[4px] border-r-[#2D2D2D]"></div>
        <div className="bg-[#2D2D2D] text-white text-[12px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl font-medium tracking-wide">
          {tooltipText}
        </div>
      </div>
    </div>
  );

  const HeaderTopButton = ({ icon: Icon, onClick, tooltip, isActive = false }) => (
    <div className="group/topbtn relative flex items-center justify-center">
      <button 
        onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
        className={`transition-colors p-1 rounded ${isActive ? 'text-[#4080FF] bg-[#E8F0FE]' : 'text-[#4E5969] hover:text-[#1F2329] hover:bg-[#E5E6EB]/50'}`}
      >
        <Icon className="w-[15px] h-[15px]" />
      </button>
      {tooltip && (
        <div className="absolute top-full mt-[8px] hidden group-hover/topbtn:flex items-center flex-col z-[200]">
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-[#2D2D2D]"></div>
          <div className="bg-[#2D2D2D] text-white text-[12px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl font-medium tracking-wide leading-none">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );

  const TopMenuItem = ({ icon: Icon, label, shortcut, hasSubmenu, submenuKey, onClick, children }) => (
    <div 
      className="relative flex items-center justify-between px-3 h-[32px] mx-1.5 my-[2px] rounded-lg text-[13px] text-[#1F2329] hover:bg-[#4080FF] hover:text-white cursor-pointer group/topmenu select-none transition-colors duration-150"
      onMouseEnter={() => hasSubmenu && setActiveMainMenuSub(submenuKey)}
      onMouseLeave={() => hasSubmenu && setActiveMainMenuSub(null)}
      onClick={onClick}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-[14px] h-[14px] text-[#4E5969] group-hover/topmenu:text-white transition-colors" />}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-3">
        {shortcut && <span className="text-[11px] font-sans tracking-wide text-[#86909C] group-hover/topmenu:text-blue-100">{shortcut}</span>}
        {hasSubmenu && <ChevronRight className="w-[14px] h-[14px] text-[#86909C] group-hover/topmenu:text-white transition-colors" />}
      </div>
      
      {hasSubmenu && activeMainMenuSub === submenuKey && (
        <div className="absolute top-0 right-full pr-1 z-[205]">
          <div className="bg-white/85 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-1.5 min-w-[180px]">
             {children}
          </div>
        </div>
      )}
    </div>
  );

  const TopMenuDivider = () => <div className="h-px bg-[#E5E6EB]/60 mx-2 my-1.5"></div>;

  const SidebarHeaderButton = ({ icon: Icon, tooltipText, disabled = false, onClick, className = '' }) => (
    <div className="group/btn relative flex justify-center">
      <button 
        onClick={!disabled ? onClick : undefined}
        className={`p-[5px] rounded-md flex items-center justify-center transition-colors
          ${disabled ? 'text-[#C9CDD4] cursor-not-allowed' : 'text-[#86909C] hover:text-[#1F2329] hover:bg-[#F2F3F5]'} ${className}`}
      >
        <Icon className="w-[14px] h-[14px]" />
      </button>
      {!disabled && (
        <div className="absolute top-full mt-[6px] hidden group-hover/btn:flex items-center flex-col z-[100]">
          <div className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-[#2D2D2D]"></div>
          <div className="bg-[#2D2D2D] text-white text-[12px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl font-medium tracking-wide leading-none">
            {tooltipText}
          </div>
        </div>
      )}
    </div>
  );

  const ToolbarActionBtn = ({ icon: Icon, onClick, tooltip }) => (
    <div className="group/tb relative flex items-center justify-center">
      <button 
        onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
        className="p-1.5 rounded-md text-[#4E5969] hover:bg-[#F2F3F5] hover:text-[#1F2329] transition-colors"
      >
        <Icon className="w-[15px] h-[15px]" />
      </button>
      <div className="absolute top-full mt-[6px] hidden group-hover/tb:flex items-center flex-col z-[100]">
        <div className="w-0 h-0 border-x-[5px] border-x-transparent border-b-[5px] border-b-[#2D2D2D]"></div>
        <div className="bg-[#2D2D2D] text-white text-[12px] px-2.5 py-1.5 rounded-md whitespace-nowrap shadow-xl font-medium tracking-wide leading-none">
          {tooltip}
        </div>
      </div>
    </div>
  );

  const DropdownMenuItem = ({ icon: Icon, label, hasSubmenu, submenuKey }) => (
    <div 
      className={`relative flex items-center justify-between px-3 h-[34px] mx-1.5 my-[2px] rounded-lg text-[13px] text-[#1F2329] hover:bg-[#4080FF] hover:text-white cursor-pointer group select-none transition-colors duration-150`}
      onMouseEnter={() => hasSubmenu && setActiveNewSubmenu(submenuKey)}
      onMouseLeave={() => hasSubmenu && setActiveNewSubmenu(null)}
    >
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-[14px] h-[14px] text-[#4E5969] group-hover:text-white transition-colors" />}
        <span>{label}</span>
      </div>
      {hasSubmenu && <ChevronRight className="w-[14px] h-[14px] text-[#86909C] group-hover:text-white transition-colors" />}
      
      {hasSubmenu && activeNewSubmenu === submenuKey && (
        <div className="absolute top-0 left-full pl-1 z-[101]">
          <div className="bg-white/75 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-1.5 min-w-[160px]">
             {submenuKey === 'remote' && (
               <>
                 <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#4080FF] hover:text-white text-[#1F2329] text-[13px] flex items-center gap-2.5 transition-colors group/sub"><Terminal className="w-[14px] h-[14px] text-[#4E5969] group-hover/sub:text-white"/> SSH</div>
                 <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#4080FF] hover:text-white text-[#1F2329] text-[13px] flex items-center gap-2.5 transition-colors group/sub"><Network className="w-[14px] h-[14px] text-[#4E5969] group-hover/sub:text-white"/> SSH隧道</div>
                 <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#4080FF] hover:text-white text-[#1F2329] text-[13px] flex items-center gap-2.5 transition-colors group/sub"><Monitor className="w-[14px] h-[14px] text-[#4E5969] group-hover/sub:text-white"/> RDP</div>
               </>
             )}
             {submenuKey === 'db' && (
               <>
                 <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#4080FF] hover:text-white text-[#1F2329] text-[13px] flex items-center gap-2.5 transition-colors group/sub"><Database className="w-[14px] h-[14px] text-[#4E5969] group-hover/sub:text-white"/> MySQL</div>
                 <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#4080FF] hover:text-white text-[#1F2329] text-[13px] flex items-center gap-2.5 transition-colors group/sub"><Database className="w-[14px] h-[14px] text-[#4E5969] group-hover/sub:text-white"/> Redis</div>
               </>
             )}
          </div>
        </div>
      )}
    </div>
  );

  const StatPill = ({ label, value, colorClass }) => (
    <div className="flex flex-col items-center w-full mb-3 cursor-default">
      <span className="text-[#86909C] text-[10px] mb-1 transform scale-[0.85]">{label}</span>
      <div className={`px-1 rounded w-[36px] h-[20px] flex items-center justify-center text-white text-[10px] font-mono tracking-tighter shadow-sm ${colorClass}`}>
        {value}
      </div>
    </div>
  );

  const renderActivityBar = () => (
    <div className="w-[50px] bg-transparent flex flex-col items-center py-2 shrink-0 select-none z-20">
      <div className="w-full px-1.5 mb-2">
        <TooltipButton icon={Folder} isActive={isSidebarOpen} onClick={() => setIsSidebarOpen(!isSidebarOpen)} tooltipText="显示/隐藏侧边栏" />
      </div>
      <div className="w-[24px] h-px bg-[#E5E6EB] mb-2"></div>
      <div className="flex flex-col gap-1.5 w-full px-1.5">
        <TooltipButton icon={List} isActive={activeFilter === 'all'} onClick={() => setActiveFilter('all')} tooltipText="显示全部" />
        <TooltipButton icon={Terminal} isActive={activeFilter === 'ssh'} onClick={() => setActiveFilter('ssh')} tooltipText="显示终端/SSH资产" />
        <TooltipButton icon={Database} isActive={activeFilter === 'db'} onClick={() => setActiveFilter('db')} tooltipText="显示数据库资产" />
        <TooltipButton icon={Package} isActive={activeFilter === 'docker'} onClick={() => setActiveFilter('docker')} tooltipText="显示docker资产" />
      </div>
      <div className="mt-auto mb-1 w-full px-1.5">
        <TooltipButton icon={Zap} isActive={activeFilter === 'shortcuts'} onClick={() => setActiveFilter('shortcuts')} tooltipText="显示快捷命令" />
      </div>
    </div>
  );

  const renderSidebar = () => {
    const isShortcuts = activeFilter === 'shortcuts';
    const isAll = activeFilter === 'all';
    const title = isShortcuts ? '快捷命令' : '资产列表';
    const data = isShortcuts ? shortcuts : assets;
    const setData = isShortcuts ? setShortcuts : setAssets;
    const disableHideEmptyFolders = isAll || isShortcuts;

    return (
      <div 
        className={`bg-white rounded-xl border border-[#E5E6EB] shadow-sm flex flex-col shrink-0 select-none transition-all duration-300`}
        style={{ width: isSidebarOpen ? '200px' : '0px' }}
      >
        <div className="w-[200px] flex flex-col h-full rounded-xl overflow-hidden">
          <div className="h-[40px] flex items-center justify-between px-3.5 border-b border-[#E5E6EB] shrink-0 bg-white rounded-t-xl">
            <span className="text-[13px] font-medium text-[#1F2329] tracking-wide">{title}</span>
            <div className="flex items-center gap-0.5 text-[#86909C]">
              <SidebarHeaderButton icon={Search} tooltipText="搜索" />
              <SidebarHeaderButton icon={Crosshair} tooltipText="定位到选中项" />
              <SidebarHeaderButton icon={CopyPlus} tooltipText="点击全部展开" />
              <SidebarHeaderButton 
                icon={FolderEyeIcon} 
                tooltipText="点击隐藏空文件夹" 
                disabled={disableHideEmptyFolders}
                onClick={() => setHideEmptyFolders(!hideEmptyFolders)}
                className={hideEmptyFolders && !disableHideEmptyFolders ? 'bg-[#E5E6EB] text-[#1F2329]' : ''}
              />
              <SidebarHeaderButton icon={LinkIcon} tooltipText={isShortcuts ? "创建快捷命令" : "新建连接"} />
            </div>
          </div>

          <div 
            className="flex-1 bg-white overflow-y-auto py-2 px-1.5 custom-scrollbar relative rounded-b-xl"
            onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-blank-shortcut' : 'sidebar-blank-asset')}
          >
            {data.map(item => (
              <div key={item.id} className="flex flex-col">
                <div 
                  className="flex items-center px-1.5 py-1.5 rounded-md hover:bg-[#F2F3F5] cursor-pointer transition-colors"
                  onClick={() => toggleFolder(data, setData, item.id)}
                  onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', item)}
                >
                  <span className="w-[18px] flex justify-center text-[#86909C]">
                    {item.isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </span>
                  <span className="w-[22px] flex justify-center mr-1.5">
                    <Folder className="w-[15px] h-[15px] text-[#FADC19] fill-[#FADC19]" />
                  </span>
                  <span className="text-[13px] text-[#4E5969] truncate flex-1">{item.name}</span>
                </div>

                {item.isOpen && item.children && item.children.map(child => (
                  <div 
                    key={child.id} 
                    className="flex items-center px-1.5 py-1.5 pl-[28px] rounded-md hover:bg-[#F2F3F5] cursor-pointer transition-colors"
                    onContextMenu={(e) => handleContextMenu(e, isShortcuts ? 'sidebar-shortcut' : 'sidebar-asset', child)}
                  >
                    <span className="w-[22px] flex justify-center mr-1.5">
                      <div className="bg-[#E5E6EB]/50 p-0.5 rounded text-[#86909C]">
                        <ArrowUpRight className="w-3 h-3" />
                      </div>
                    </span>
                    <span className="text-[13px] text-[#4E5969] truncate flex-1">{child.name}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderHiddenShortcuts = () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-b-xl">
      <div className="flex flex-col items-end gap-5 text-[13px] text-[#4E5969]">
        <div className="flex items-center gap-6 w-[260px] justify-between">
          <span>全局搜索</span>
          <div className="flex gap-1.5">
            <kbd className="bg-white border border-[#C9CDD4] rounded px-1.5 py-0.5 text-[11px] font-sans text-[#1F2329] shadow-sm">Ctrl</kbd>
            <kbd className="bg-white border border-[#C9CDD4] rounded px-1.5 py-0.5 text-[11px] font-sans text-[#1F2329] shadow-sm">Shift</kbd>
            <kbd className="bg-white border border-[#C9CDD4] rounded px-1.5 py-0.5 text-[11px] font-sans text-[#1F2329] shadow-sm">F</kbd>
          </div>
        </div>
        <div className="flex items-center gap-6 w-[260px] justify-between">
          <span>最近历史标签</span>
          <div className="flex gap-1.5">
            <kbd className="bg-white border border-[#C9CDD4] rounded px-1.5 py-0.5 text-[11px] font-sans text-[#1F2329] shadow-sm">Ctrl</kbd>
            <kbd className="bg-white border border-[#C9CDD4] rounded px-1.5 py-0.5 text-[11px] font-sans text-[#1F2329] shadow-sm">E</kbd>
          </div>
        </div>
      </div>
      <button 
        className="mt-12 flex items-center gap-2 px-5 py-2 border border-[#C9CDD4] rounded-lg bg-white text-[#4E5969] text-[13px] hover:bg-[#F2F3F5] hover:text-[#1F2329] transition-colors shadow-sm font-medium"
        onClick={() => { setIsAssetHidden(false); setCurrentFolder(null); }}
      >
        <ChevronUp className="w-4 h-4" /> 显示资产列表
      </button>
    </div>
  );

  const renderMainContent = () => (
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-[#E5E6EB] shadow-sm min-w-0 relative z-10" onContextMenu={(e) => e.preventDefault()}>
      
      {/* Tab Area */}
      <div className="h-[38px] bg-[#F7F8FA] rounded-t-xl border-b border-[#E5E6EB] flex items-end px-0 shrink-0 overflow-x-auto custom-scrollbar">
        {tabs.map(tab => {
          const isActive = activeTabId === tab.id;
          
          if (tab.type === 'list') {
            return (
              <div key="list-tab" className="relative shrink-0 h-full" ref={listDropdownRef}>
                <div 
                  className={`h-full flex items-center gap-1.5 px-4 cursor-pointer relative transition-colors ${isActive ? 'bg-white rounded-tl-xl' : 'bg-transparent hover:bg-[#E5E6EB]/50 rounded-tl-xl'}`}
                  onClick={() => setActiveTabId('list')}
                >
                  <AlignJustify className="w-[14px] h-[14px] text-[#86909C]" />
                  <span className={`text-[13px] ${isActive ? 'font-medium text-[#1F2329]' : 'text-[#4E5969]'}`}>列表</span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#86909C] ml-0.5" onClick={(e) => { e.stopPropagation(); setIsListDropdownOpen(!isListDropdownOpen); }} />
                  {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1F2329] z-10"></div>}
                  {!isActive && <div className="absolute right-0 top-[10px] bottom-[10px] w-px bg-[#E5E6EB]"></div>}
                </div>
                {isListDropdownOpen && (
                   <div className="absolute top-full left-0 mt-[1px] bg-white/80 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] w-[240px] z-[100] flex flex-col py-1.5">
                      <div className="px-3 py-1.5 text-[12px] text-[#86909C] font-medium">最近列表</div>
                      <div className="px-1.5 pt-1">
                        <div 
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-[#4080FF] hover:text-white rounded-lg cursor-pointer text-[#1F2329] transition-colors group" 
                          onClick={() => {setIsListDropdownOpen(false); setCurrentFolder(null); setActiveTabId('list');}}
                        >
                          <Home className="w-[14px] h-[14px] text-[#4E5969] group-hover:text-white" />
                          <span className="text-[13px]">首页</span>
                        </div>
                      </div>
                   </div>
                )}
              </div>
            );
          }

          // Asset Tab
          return (
            <div 
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`h-full flex items-center gap-2 px-3 cursor-pointer relative shrink-0 group transition-colors min-w-[140px] max-w-[200px] border-r border-[#E5E6EB] ${isActive ? 'bg-white' : 'bg-transparent hover:bg-[#E5E6EB]/50'}`}
            >
              <div 
                className="w-[22px] h-[22px] flex items-center justify-center rounded-md hover:bg-[#E5E6EB] text-[#86909C] shrink-0 transition-colors"
                onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              >
                <X className="w-3.5 h-3.5" />
              </div>
              <Terminal className="w-[14px] h-[14px] text-[#4E5969] shrink-0" />
              <span className={`text-[13px] truncate flex-1 ${isActive ? 'font-medium text-[#1F2329]' : 'text-[#4E5969]'}`}>
                {tab.asset.name}
              </span>
              
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1F2329] z-10"></div>}
              {tab.status === 'connecting' && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-[#4080FF] z-20 animate-[loading_1.0s_ease-out_forwards]"></div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex-1 flex min-h-0 relative bg-white rounded-b-xl">
        
        {/* Left Side: List or Terminal */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          {activeTabId === 'list' ? (
            isAssetHidden ? renderHiddenShortcuts() : (
              <>
                <div className="h-[44px] border-b border-[#E5E6EB] flex items-center justify-between px-4 shrink-0 bg-white">
                  <div className="flex items-center gap-2.5">
                    <AlignJustify className="w-[15px] h-[15px] text-[#86909C]" />
                    <span className="text-[13px] font-medium text-[#1F2329] tracking-wide">资产列表</span>
                    <span className="text-[12px] text-[#86909C] ml-3">已选择 0 个连接</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative mr-3 hidden md:block">
                      <input 
                        type="text" 
                        placeholder="名称,IP,User (Ctrl+Shift+F)" 
                        className="w-[160px] lg:w-[220px] border border-[#E5E6EB] rounded-lg px-3 py-1.5 text-[12px] text-[#1F2329] placeholder-[#86909C] outline-none focus:border-[#4080FF] transition-colors shadow-sm"
                      />
                    </div>
                    
                    <ToolbarActionBtn icon={Home} tooltip="回到首页" onClick={() => setCurrentFolder(null)} />
                    <ToolbarActionBtn icon={RefreshCw} tooltip="刷新" onClick={handlePing} />
                    <ToolbarActionBtn icon={showPing ? PingIcon : PingOffIcon} tooltip={showPing ? "隐藏ping" : "显示ping"} onClick={handleTogglePing} />
                    
                    <div className="relative" ref={newMenuRef}>
                      <ToolbarActionBtn icon={LinkIcon} tooltip="新建" onClick={() => setNewMenuOpen(!newMenuOpen)} />
                      {newMenuOpen && (
                        <div className="absolute top-full right-0 mt-2 bg-white/75 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-1.5 min-w-[150px] z-[101]">
                          <DropdownMenuItem icon={FolderPlus} label="目录" />
                          <DropdownMenuItem icon={Terminal} label="本地终端" />
                          <DropdownMenuItem icon={Package} label="Docker" />
                          <DropdownMenuItem icon={Monitor} label="远程连接" hasSubmenu submenuKey="remote" />
                          <DropdownMenuItem icon={Database} label="数据库" hasSubmenu submenuKey="db" />
                        </div>
                      )}
                    </div>

                    <ToolbarActionBtn icon={FolderPlus} tooltip="新建目录" onClick={() => setShowDirModal(true)} />
                    <ToolbarActionBtn icon={isAnonymized ? EyeOff : Eye} tooltip={isAnonymized ? "脱敏:已启用" : "脱敏:已关闭"} onClick={() => setIsAnonymized(!isAnonymized)} />
                    <ToolbarActionBtn icon={ChevronDown} tooltip="隐藏资产列表" onClick={() => setIsAssetHidden(true)} />
                  </div>
                </div>

                <div 
                  className="flex-1 overflow-auto custom-scrollbar bg-white rounded-bl-xl"
                  onContextMenu={(e) => handleContextMenu(e, 'table-context', { targetContext: 'blank' })}
                >
                  <table className="min-w-full text-left border-collapse whitespace-nowrap select-none">
                    <thead className="sticky top-0 bg-[#F7F8FA] z-10 border-b border-[#E5E6EB]">
                      <tr>
                        <th className="px-5 py-2.5 text-[12px] font-medium text-[#4E5969] w-[20%]">名称</th>
                        <th className="px-4 py-2.5 text-[12px] font-medium text-[#4E5969] w-[10%]">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-[#1F2329]">延迟 <ChevronDown className="w-3 h-3 opacity-50"/></div>
                        </th>
                        <th className="px-4 py-2.5 text-[12px] font-medium text-[#4E5969] w-[15%]">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-[#1F2329]">Host <ChevronDown className="w-3 h-3 opacity-50"/></div>
                        </th>
                        <th className="px-4 py-2.5 text-[12px] font-medium text-[#4E5969] w-[15%]">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-[#1F2329]">User <ChevronDown className="w-3 h-3 opacity-50"/></div>
                        </th>
                        <th className="px-4 py-2.5 text-[12px] font-medium text-[#4E5969] w-[15%]">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-[#1F2329]">创建时间 <ChevronDown className="w-3 h-3 opacity-50"/></div>
                        </th>
                        <th className="px-4 py-2.5 text-[12px] font-medium text-[#4E5969] w-[15%]">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-[#1F2329]">到期时间 <ChevronDown className="w-3 h-3 opacity-50"/></div>
                        </th>
                        <th className="px-4 py-2.5 text-[12px] font-medium text-[#4E5969] w-[10%]">
                          <div className="flex items-center gap-1 cursor-pointer hover:text-[#1F2329]">备注 <ChevronDown className="w-3 h-3 opacity-50"/></div>
                        </th>
                      </tr>
                    </thead>
                    {currentFolder === null && (
                      <tbody>
                        {TABLE_DATA.map((row, idx) => (
                          <tr 
                            key={row.id} 
                            className={`${idx % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]'} hover:bg-[#F2F3F5] cursor-pointer transition-colors group`}
                            onDoubleClick={() => {
                              if (row.type === 'folder') setCurrentFolder(row.id);
                              else openAssetTab(row);
                            }}
                            onContextMenu={(e) => {
                              e.stopPropagation();
                              handleContextMenu(e, 'table-context', { targetContext: row.type === 'folder' ? 'folder' : 'asset', rowData: row });
                            }}
                          >
                            <td className="px-5 py-3 text-[13px] text-[#1F2329] flex items-center gap-2">
                              {row.type === 'folder' ? <Folder className="w-4 h-4 text-[#FADC19] fill-[#FADC19]" /> : <Terminal className="w-4 h-4 text-[#409EFF]" />}
                              {maskText(row.name)}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-[#4E5969]">{showPing && row.type !== 'folder' ? (pings[row.id] || row.latency) : '-'}</td>
                            <td className="px-4 py-3 text-[12px] text-[#4E5969]">{maskText(row.host)}</td>
                            <td className="px-4 py-3 text-[12px] text-[#4E5969]">{maskText(row.user)}</td>
                            <td className="px-4 py-3 text-[12px] text-[#4E5969] font-mono">{row.created}</td>
                            <td className="px-4 py-3 text-[12px] text-[#4E5969]">{row.expire}</td>
                            <td className="px-4 py-3 text-[12px] text-[#4E5969]">{row.remark}</td>
                          </tr>
                        ))}
                      </tbody>
                    )}
                  </table>
                </div>
              </>
            )
          ) : (
            <TerminalSimulation 
              asset={activeTab.asset} 
              handleCloseTab={() => closeTab(activeTabId)}
            />
          )}
        </div>
      </div>
    </div>
  );

  const renderContextMenu = () => {
    if (!contextMenu.visible) return null;

    const MenuItem = ({ icon: Icon, label, shortcut, hasSubmenu, disabled, children }) => (
      <div className={`group/item relative flex items-center justify-between px-3 h-[34px] mx-1.5 my-[2px] rounded-lg text-[13px] transition-colors select-none
        ${disabled ? 'text-[#C9CDD4] cursor-not-allowed' : 'text-[#1F2329] hover:bg-[#4080FF] hover:text-white cursor-pointer'}`}
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className={`w-[14px] h-[14px] transition-colors ${disabled ? 'text-[#C9CDD4]' : 'text-[#4E5969] group-hover/item:text-white'}`} />}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {shortcut && <span className={`text-[11px] font-sans tracking-wide ${disabled ? 'text-[#C9CDD4]' : 'text-[#86909C] group-hover/item:text-white'}`}>{shortcut}</span>}
          {hasSubmenu && <ChevronRight className={`w-[14px] h-[14px] ${disabled ? 'text-[#C9CDD4]' : 'text-[#86909C] group-hover/item:text-white'}`} />}
        </div>
        {hasSubmenu && children && !disabled && (
          <div className="absolute top-0 left-full pl-1 hidden group-hover/item:block z-[101]">
            <div className="bg-white/75 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-1.5 min-w-[170px] max-h-[380px] overflow-y-auto custom-scrollbar pointer-events-auto">
              {children}
            </div>
          </div>
        )}
      </div>
    );

    const MenuDivider = () => <div className="h-px bg-[#E5E6EB]/60 mx-2 my-1.5"></div>;

    const ActionButton = ({ icon: Icon, tooltip, disabled }) => (
      <div className="group/action relative flex items-center">
        <button className={`px-[8px] py-[6px] rounded-md transition-colors ${disabled ? 'text-[#C9CDD4] cursor-not-allowed' : 'hover:bg-[#E5E6EB] text-[#4E5969]'}`}>
          <Icon className="w-3.5 h-3.5" />
        </button>
        {!disabled && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/action:flex items-center justify-center z-[150]">
            <div className="bg-[#2D2D2D] text-white text-[12px] px-2.5 py-1.5 rounded-md shadow-xl whitespace-nowrap font-medium">
              {tooltip}
            </div>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-t-[5px] border-t-[#2D2D2D] border-x-[5px] border-x-transparent"></div>
          </div>
        )}
      </div>
    );

    let content = null;

    if (contextMenu.type === 'table-context') {
      const target = contextMenu.data?.targetContext || 'asset';
      const isBlank = target === 'blank';
      const isFolder = target === 'folder';

      content = (
        <>
          <div className="flex items-center justify-between px-4 py-[6px] mb-1.5 border-b border-[#E5E6EB]/50">
            <span className="text-[12px] text-[#86909C] font-medium tracking-wide">操作</span>
            <div className="flex items-center bg-[#F2F3F5] rounded-md border border-[#E5E6EB]/80 p-[2px]">
               <ActionButton icon={Clipboard} tooltip="粘贴(Ctrl+V)" disabled={false} />
               <div className="w-px h-3.5 bg-[#E5E6EB] mx-[2px]"></div>
               <ActionButton icon={Scissors} tooltip="剪切(Ctrl+X)" disabled={isBlank} />
               <div className="w-px h-3.5 bg-[#E5E6EB] mx-[2px]"></div>
               <ActionButton icon={Copy} tooltip="复制(Ctrl+C)" disabled={isBlank} />
            </div>
          </div>
          <MenuItem icon={LinkIcon} label="打开" shortcut="Enter" disabled={isBlank} />
          <MenuItem icon={CopyPlus} label="批量打开" disabled={isBlank} />
          <MenuItem icon={RefreshCw} label="刷新" shortcut="F5" />
          <MenuItem icon={FilePlus} label="新标签打开" shortcut="Alt+N" disabled={isBlank || isFolder} />
          <MenuItem icon={ExternalLink} label="新窗口打开" shortcut="Ctrl+Shift+N" disabled={isBlank || isFolder} />
          <MenuItem icon={Columns} label="同屏打开" disabled={isBlank || isFolder} />
          <MenuDivider />
          <MenuItem icon={Copy} label="克隆" disabled={isBlank || isFolder} />
          <MenuItem icon={FolderPlus} label="新建目录" />
          <MenuItem icon={Edit2} label="编辑" disabled={isBlank || isFolder} />
          <MenuItem icon={CopyPlus} label="批量编辑" disabled={isBlank || isFolder} />
          <MenuItem icon={FileX} label="删除" shortcut="Backspace" disabled={isBlank} />
          <MenuItem icon={Edit2} label="重命名" shortcut="F2" disabled={isBlank} />
          <MenuDivider />
          <MenuItem icon={ChevronDown} label="更多" hasSubmenu disabled={isBlank}>
             <MenuItem icon={FileDown} label="通过文本批量导入SSH" />
             <MenuItem icon={Key} label="上传 SSH公钥(ssh-copy-id)" />
             <MenuItem icon={Activity} label="Ping" disabled={isBlank || isFolder} />
             <MenuItem icon={FileDown} label="导入" />
             <MenuItem icon={FileUp} label="导出" />
          </MenuItem>
        </>
      );
    } else if (contextMenu.type === 'sidebar-asset' || contextMenu.type === 'sidebar-blank-asset') {
      content = (
        <>
          <div className="px-4 py-1.5 text-[11px] text-[#86909C] font-medium tracking-wide">操作</div>
          <MenuItem icon={FolderPlus} label="新建目录" />
          <MenuItem icon={LinkIcon} label="新建连接" hasSubmenu>
             <div className="px-4 py-2 text-[11px] text-[#86909C] font-medium border-b border-[#E5E6EB]/50 mb-1 mx-1.5">新建连接</div>
             <MenuItem icon={Terminal} label="本地终端" />
             <MenuItem icon={Terminal} label="SSH" />
             <MenuItem icon={Network} label="SSH隧道" />
             <MenuItem icon={Monitor} label="Telnet" />
             <MenuItem icon={Usb} label="串口" />
             <MenuItem icon={Monitor} label="RDP" />
             <MenuItem icon={Package} label="Docker" />
             <MenuItem icon={Database} label="Redis" />
             <MenuItem icon={Database} label="MySQL" />
             <MenuItem icon={Database} label="MariaDB" />
             <MenuItem icon={Database} label="PostgreSQL" />
             <MenuItem icon={Database} label="SqlServer" />
             <MenuItem icon={Database} label="ClickHouse" />
             <MenuItem icon={Database} label="SQLite" />
             <MenuItem icon={Database} label="Oracle" />
             <MenuItem icon={Database} label="达梦" />
          </MenuItem>
          {contextMenu.type === 'sidebar-asset' && <MenuItem icon={LinkIcon} label="批量打开" />}
          <MenuDivider />
          <MenuItem icon={FileX} label="删除" />
          <MenuItem icon={Edit2} label="重命名" />
          <MenuItem icon={Copy} label="复制" />
          <MenuItem icon={Scissors} label="剪切" />
          <MenuItem icon={Clipboard} label="粘贴" />
          <MenuItem icon={RefreshCw} label="刷新" />
          <MenuDivider />
          <MenuItem icon={FileDown} label="导入" />
          <MenuItem icon={FileUp} label="导出" />
        </>
      );
    } else if (contextMenu.type === 'sidebar-shortcut' || contextMenu.type === 'sidebar-blank-shortcut') {
      content = (
        <>
          <div className="px-4 py-1.5 text-[11px] text-[#86909C] font-medium tracking-wide">操作</div>
          <MenuItem icon={FolderPlus} label="新建分组" />
          <MenuItem icon={LinkIcon} label="新建快捷命令" />
          <MenuDivider />
          <MenuItem icon={FileX} label="删除" />
          <MenuItem icon={Edit2} label="重命名" />
          <MenuItem icon={RefreshCw} label="刷新" />
          <MenuDivider />
          <MenuItem icon={FileDown} label="导入" />
          <MenuItem icon={FileUp} label="导出" />
          <MenuItem icon={FileUp} label="导出全部" />
        </>
      );
    }

    if (!content) return null;

    return (
      <div 
        className="fixed bg-white/75 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-2 min-w-[220px] z-[999]"
        style={{ top: contextMenu.y, left: contextMenu.x }}
        onClick={(e) => e.stopPropagation()} 
      >
        {content}
      </div>
    );
  };

  return (
    <div className="h-screen w-screen bg-[#F2F3F5] font-sans flex flex-col overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E5E6EB; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #C9CDD4; }
        @keyframes loading {
          0% { width: 0%; opacity: 1; }
          90% { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 0; display: none; }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes scale-in {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-in-right {
          0% { opacity: 0; transform: translateX(20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}} />

      <header className="h-[48px] bg-[#F2F3F5] flex items-center justify-between px-0 shrink-0 select-none z-[100] relative">
        <div className="flex h-full">
          <div className="w-[262px] flex items-center px-4 shrink-0 transition-all duration-300">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={() => setActiveTabId('list')}
            >
              <Hexagon className="w-5 h-5 text-[#1F2329] fill-[#1F2329]" />
              <span className="text-[#1F2329] font-bold text-[16px] tracking-wide">HexHub</span>
            </div>
          </div>
          
          {activeTabId !== 'list' && activeTab && (
            <div className="flex items-center px-2">
              <span className="text-[#C9CDD4] font-light text-[15px] mx-2">/</span>
              <div className="flex items-center gap-2 text-[#4E5969]">
                <Folder className="w-[15px] h-[15px] text-[#86909C]" />
                <span className="text-[13px]">{activeTab.asset.folderName || 'Root'}</span>
              </div>
              <span className="text-[#C9CDD4] font-light text-[15px] mx-2">/</span>
              <div className="flex items-center gap-2 text-[#1F2329]">
                <Terminal className="w-[15px] h-[15px]" />
                <span className="text-[13px] font-medium">{activeTab.asset.name}</span>
              </div>
            </div>
          )}
        </div>

        {/* --- Top Right Toolbar --- */}
        <div className="flex items-center gap-5 pr-5">
          <div className="flex items-center gap-1 bg-[#FDF6EC] text-[#E6A23C] border border-[#F3D19E] px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer hover:bg-[#F5E8C8] transition-colors shadow-sm">
            <Crown className="w-3.5 h-3.5" /> Pro
          </div>

          <div className="flex items-center gap-3.5 text-[#4E5969]">
            
            {/* Dynamic Connection Controls (Only visible when an asset tab is active & connected) */}
            {activeTabId !== 'list' && activeTab?.status === 'connected' && (
              <div className="flex items-center gap-3.5 mr-2 animate-[fade-in_0.3s_ease-out]" ref={headerToolsRef}>
                
                {/* Transfer Dropdown Popover */}
                <div className="relative">
                  <HeaderTopButton 
                    icon={TransferIcon} 
                    tooltip="文件传输" 
                    isActive={activeHeaderPopover === 'transfer'}
                    onClick={() => setActiveHeaderPopover(prev => prev === 'transfer' ? null : 'transfer')} 
                  />
                  {activeHeaderPopover === 'transfer' && (
                    <div className="absolute right-0 top-full mt-[12px] w-[420px] bg-white/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-xl border border-[#E5E6EB] z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
                      <div className="flex flex-col border-b border-[#E5E6EB] bg-white/50">
                        <div className="flex items-center px-4 pt-3 pb-2 text-[14px] font-medium text-[#1F2329]">文件传输</div>
                        <div className="flex gap-6 px-4 text-[13px] text-[#86909C]">
                          <span className="pb-2 border-b-[3px] border-[#4080FF] text-[#4080FF] cursor-pointer font-medium">进行中</span>
                          <span className="pb-2 border-b-[3px] border-transparent hover:text-[#1F2329] cursor-pointer transition-colors">队列中</span>
                          <span className="pb-2 border-b-[3px] border-transparent hover:text-[#1F2329] cursor-pointer transition-colors">已暂停</span>
                          <span className="pb-2 border-b-[3px] border-transparent hover:text-[#1F2329] cursor-pointer transition-colors">失败</span>
                          <span className="pb-2 border-b-[3px] border-transparent hover:text-[#1F2329] cursor-pointer transition-colors">已完成</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1.5fr_1fr_1fr] px-4 py-2 bg-[#F7F8FA] border-b border-[#E5E6EB] text-[12px] text-[#86909C] font-medium">
                        <div>名称</div>
                        <div>连接</div>
                        <div className="flex justify-between">
                          <span>状态</span>
                          <span>信息</span>
                        </div>
                      </div>
                      <div className="h-[280px] flex flex-col items-center justify-center text-[#86909C] bg-white/50">
                        <CloudFog size={48} className="mb-2 opacity-30" strokeWidth={1} />
                        <span className="text-[13px]">暂无数据</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Broadcast Dropdown Popover */}
                <div className="relative">
                  <HeaderTopButton 
                    icon={BroadcastIcon} 
                    tooltip="命令输入广播" 
                    isActive={activeHeaderPopover === 'broadcast'}
                    onClick={() => setActiveHeaderPopover(prev => prev === 'broadcast' ? null : 'broadcast')} 
                  />
                  {activeHeaderPopover === 'broadcast' && (
                    <div className="absolute right-0 top-full mt-[12px] w-[360px] bg-white/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-xl border border-[#E5E6EB] z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
                      <div className="px-4 py-3 border-b border-[#E5E6EB] bg-white/50">
                        <div className="text-[14px] font-medium text-[#1F2329] mb-1">命令输入广播 (专业版)</div>
                        <div className="text-[12px] text-[#86909C]">可按住 <kbd className="bg-[#F2F3F5] border border-[#E5E6EB] px-1 rounded mx-0.5">ALT+</kbd> 鼠标中键点击 进行点选</div>
                      </div>
                      <div className="flex flex-col max-h-[240px] overflow-y-auto custom-scrollbar p-2 bg-white/50">
                        <div className="text-[11px] text-[#86909C] px-2 py-1 font-mono">Berohost</div>
                        <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#F7F8FA] rounded-md cursor-pointer bg-[#F7F8FA] border border-[#E5E6EB]/50">
                          <div className="w-[14px] h-[14px] bg-[#4080FF] rounded-[3px] flex items-center justify-center"><Check size={10} className="text-white" strokeWidth={3}/></div>
                          <span className="text-[13px] text-[#1F2329] font-mono">Berohost</span>
                        </div>
                      </div>
                      <div className="px-4 py-2 border-t border-[#E5E6EB] bg-[#F7F8FA] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="relative group/action">
                            <button className="p-1.5 text-[#FABC4D] hover:bg-[#E5E6EB] rounded transition-colors"><FileUp size={16}/></button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/action:block bg-[#2D2D2D] text-white text-[11px] px-2 py-1 rounded shadow-md whitespace-nowrap">批量上传文件</div>
                          </div>
                          <div className="relative group/action">
                            <button className="p-1.5 text-[#7BC676] hover:bg-[#E5E6EB] rounded transition-colors"><FolderArchive size={16}/></button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/action:block bg-[#2D2D2D] text-white text-[11px] px-2 py-1 rounded shadow-md whitespace-nowrap">批量上传文件夹</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <button className="text-[#F53F3F] text-[13px] font-medium hover:opacity-80 transition-opacity">全部关闭</button>
                          <button className="text-[#4080FF] text-[13px] font-medium hover:opacity-80 transition-opacity">全部启用</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* History Dropdown Popover */}
                <div className="relative">
                  <HeaderTopButton 
                    icon={CloudClockIcon} 
                    tooltip="历史命令" 
                    isActive={activeHeaderPopover === 'history'}
                    onClick={() => setActiveHeaderPopover(prev => prev === 'history' ? null : 'history')} 
                  />
                  {activeHeaderPopover === 'history' && (
                    <div className="absolute right-0 top-full mt-[12px] w-[340px] bg-white/95 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] rounded-xl border border-[#E5E6EB] z-[250] flex flex-col overflow-hidden animate-[fade-in_0.2s_ease-out]">
                      <div className="flex items-center justify-between px-3 py-3 border-b border-[#E5E6EB] bg-white/50">
                        <div className="text-[14px] font-medium text-[#1F2329] flex items-center gap-3">
                          历史命令
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#86909C]" />
                            <input type="text" placeholder="历史命令过滤" className="w-[160px] h-[26px] pl-7 pr-2 bg-[#F7F8FA] border border-[#E5E6EB] rounded text-[12px] outline-none focus:border-[#4080FF] transition-colors" />
                          </div>
                        </div>
                        <button className="text-[#F53F3F] hover:bg-[#FDECE8] px-2 py-1.5 rounded text-[12px] flex items-center gap-1 transition-colors"><X size={14}/>清除</button>
                      </div>
                      <div className="max-h-[400px] overflow-y-auto p-1 custom-scrollbar bg-white/50">
                        {MOCK_HISTORY_CMDS.map((cmd, i) => (
                          <div key={i} className="flex flex-col group hover:bg-[#F7F8FA] rounded-lg p-2.5 transition-colors cursor-pointer border border-transparent hover:border-[#E5E6EB]/50 mx-1 my-0.5">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-mono text-[13px] text-[#1F2329] break-all leading-snug">{cmd.cmd}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1 text-[#86909C] hover:text-[#4080FF] hover:bg-[#E8F0FE] rounded"><CopyIcon size={14}/></button>
                                <button className="p-1 text-[#86909C] hover:text-[#F53F3F] hover:bg-[#FDECE8] rounded"><X size={14}/></button>
                              </div>
                            </div>
                            <span className="text-[11px] text-[#86909C] mt-1.5 font-mono">{cmd.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Theme Toggle */}
            <HeaderTopButton 
              icon={ThemeIcon} 
              tooltip={getThemeConfig().tooltip} 
              onClick={cycleTheme} 
            />

            {/* User Popover */}
            <div className="relative" ref={userMenuRef}>
              <HeaderTopButton 
                icon={User} 
                tooltip={!isLoggedIn ? "登录" : null} 
                onClick={() => {
                  if (!isLoggedIn) {
                    setIsLoggedIn(true); // Mock login
                  } else {
                    setShowUserMenu(!showUserMenu);
                  }
                }} 
              />
              {showUserMenu && isLoggedIn && (
                <div className="absolute right-0 top-full mt-[12px] w-[260px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-[#E5E6EB] flex flex-col items-center overflow-hidden z-[200]">
                  <div className="bg-[#F7F8FA] w-full pt-5 pb-4 flex flex-col items-center relative border-b border-[#E5E6EB]">
                    <span className="text-[#1F2329] tracking-[0.2em] text-[13px] font-medium mb-3">archosaur</span>
                    
                    {/* Hexagon Avatar */}
                    <div className="relative flex flex-col items-center">
                      <div className="w-[60px] h-[60px] bg-gradient-to-br from-[#F5D77D] to-[#E3A824] relative flex items-center justify-center shadow-md" style={{clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'}}>
                        <div className="w-[46px] h-[46px] bg-gradient-to-br from-[#FFEBAA] to-[#D59B16] flex items-center justify-center" style={{clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'}}>
                          <Crown className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <div className="absolute -bottom-2 bg-gradient-to-r from-[#D59B16] to-[#E3A824] text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-sm">PRO</div>
                    </div>
                    
                    <button className="absolute top-3 right-3 text-[#86909C] hover:text-[#1F2329] p-1"><Edit2 size={14}/></button>

                    <div className="mt-4 text-[#86909C] text-[12px] font-mono">archosaur@krnex.com</div>
                    <div className="mt-2 text-[#1F2329] text-[14px] font-medium">专业终身版</div>
                    
                    <div className="flex gap-2 mt-4 w-full px-5">
                         <button className="flex-1 bg-[#E8F0FE] text-[#4080FF] hover:bg-[#D4E3FC] transition-colors py-1.5 rounded text-[12px] font-medium">同步</button>
                         <button className="flex-1 bg-[#F2F3F5] text-[#86909C] hover:bg-[#E5E6EB] transition-colors py-1.5 rounded text-[12px] font-medium">续费</button>
                    </div>
                  </div>

                  <div className="w-full flex flex-col py-1.5">
                      <div className="px-5 py-2.5 text-[13px] text-[#4E5969] hover:bg-[#F2F3F5] flex items-center gap-3 cursor-pointer transition-colors">
                        <Gift size={16} /> 兑换激活码
                      </div>
                      <div className="px-5 py-2.5 text-[13px] text-[#4E5969] hover:bg-[#F2F3F5] flex items-center gap-3 cursor-pointer transition-colors">
                        <Headset size={16} /> 支持
                      </div>
                      <div className="px-5 py-2.5 text-[13px] text-[#4E5969] hover:bg-[#F2F3F5] flex items-center gap-3 cursor-pointer transition-colors border-t border-[#E5E6EB]/50 mt-1" onClick={() => {setIsLoggedIn(false); setShowUserMenu(false);}}>
                        <LogOut size={16} className="ml-0.5" /> 退出登录
                      </div>
                  </div>

                  <div className="w-full text-center text-[12px] text-[#86909C] py-3 bg-[#F7F8FA] border-t border-[#E5E6EB]">
                      <span className="hover:text-[#4080FF] cursor-pointer transition-colors">用户协议</span>
                      <span className="mx-2">•</span>
                      <span className="hover:text-[#4080FF] cursor-pointer transition-colors">隐私政策</span>
                  </div>
                </div>
              )}
            </div>

            {/* Main Menu Popover */}
            <div className="relative" ref={mainMenuRef}>
              <HeaderTopButton icon={MoreVertical} tooltip="菜单" onClick={() => setShowMainMenu(!showMainMenu)} />
              {showMainMenu && (
                <div className="absolute right-0 top-full mt-[12px] bg-white/85 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-1.5 min-w-[200px] z-[200]">
                   <TopMenuItem icon={ExternalLink} label="新窗口" shortcut="Ctrl+Shift+H" />
                   <TopMenuItem icon={Copy} label="复制窗口" shortcut="Ctrl+Shift+N" />
                   <TopMenuDivider />
                   <TopMenuItem icon={History} label="最近项目" shortcut="Ctrl+E" hasSubmenu submenuKey="recent">
                      {RECENT_PROJECTS.map((proj, i) => (
                        <div key={i} className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#1F2329] text-[13px] flex items-center gap-2.5 transition-colors cursor-pointer">
                          <proj.icon className="w-[14px] h-[14px] text-[#4E5969]" /> {proj.name}
                        </div>
                      ))}
                   </TopMenuItem>
                   <TopMenuItem icon={Languages} label="语言" hasSubmenu submenuKey="language">
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg bg-[#E8F0FE] text-[#4080FF] text-[13px] flex items-center justify-between cursor-pointer">
                        <span>中文(当前)</span>
                      </div>
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#4E5969] text-[13px] flex items-center justify-between cursor-pointer transition-colors">
                        <span>English</span>
                      </div>
                   </TopMenuItem>
                   <TopMenuItem icon={CircleHelp} label="帮助" hasSubmenu submenuKey="help">
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#1F2329] text-[13px] flex items-center transition-colors cursor-pointer">提交问题</div>
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#1F2329] text-[13px] flex items-center transition-colors cursor-pointer">常见问题</div>
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#1F2329] text-[13px] flex items-center transition-colors cursor-pointer">更新日志</div>
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#1F2329] text-[13px] flex items-center transition-colors cursor-pointer">检测更新</div>
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#1F2329] text-[13px] flex items-center transition-colors cursor-pointer">清除无效数据</div>
                      <div className="px-3 h-[32px] mx-1.5 my-[2px] rounded-lg hover:bg-[#F2F3F5] text-[#1F2329] text-[13px] flex items-center transition-colors cursor-pointer border-t border-[#E5E6EB]/50 mt-1">关于</div>
                   </TopMenuItem>
                   <TopMenuItem icon={Settings} label="设置" onClick={() => setShowSettings(true)} />
                   <TopMenuItem icon={Search} label="快速搜索" shortcut="Ctrl+Shift+F" />
                   <TopMenuItem icon={RotateCw} label="重载页面" />
                   <TopMenuItem icon={LogOut} label="退出" shortcut="Alt+F4" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4.5 text-[#4E5969] ml-2 border-l border-[#E5E6EB] pl-5">
            <HeaderTopButton icon={Pin} onClick={() => setIsPinned(!isPinned)} tooltip={isPinned ? "取消置顶" : "置顶窗口"} isActive={isPinned} />
            <button className="hover:text-[#1F2329] transition-colors p-1"><Minus className="w-[15px] h-[15px]" /></button>
            <button className="hover:text-[#1F2329] transition-colors p-1"><Square className="w-3.5 h-3.5" /></button>
            <button className="hover:text-red-500 transition-colors p-1"><X className="w-[15px] h-[15px]" /></button>
          </div>
        </div>
      </header>

      {/* Main Split Island Workspace */}
      <div className="flex-1 flex px-3 pb-3 gap-3 overflow-hidden relative">
        
        {/* Island 1: Activity Bar (Blended) + Sidebar (White Card) */}
        <div className="flex h-full shrink-0 z-20 relative">
          {renderActivityBar()}
          {renderSidebar()}
        </div>

        {/* Island 2: Main Content (White Card) */}
        {renderMainContent()}

        {/* Island 3: Global Right Sidebar Area (Extends to the far right, fills remaining space) */}
        <div className={`flex h-full shrink-0 z-30 relative shadow-sm border border-[#E5E6EB] bg-white transition-all duration-300 ${sftpExpanded ? 'rounded-r-xl' : 'rounded-xl'}`}>
          
          {/* Toggle Button perfectly aligning with the left edge of Island 3 container */}
          {activeTab?.status === 'connected' && (
            <button 
              className="absolute top-1/2 -left-[24px] -translate-y-1/2 w-[24px] h-[36px] bg-white border border-[#E5E6EB] border-r-0 rounded-l-md flex items-center justify-center shadow-[-2px_0_4px_rgba(0,0,0,0.02)] text-[#86909C] hover:text-[#1F2329] z-[70] transition-colors"
              onClick={() => setSftpExpanded(!sftpExpanded)}
              title={sftpExpanded ? "折叠面板" : "展开面板"}
            >
              {sftpExpanded ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
            </button>
          )}

          {/* Expanded SFTP Panel */}
          {sftpExpanded && activeTab?.status === 'connected' && (
            <div className="w-[300px] h-full flex flex-col bg-white shrink-0 border-r border-[#E5E6EB] rounded-l-xl overflow-hidden">
              {/* SFTP Header */}
              <div className="h-[44px] px-3 flex items-center gap-2 border-b border-[#E5E6EB] shrink-0 bg-white">
                <button className="p-1 hover:bg-[#F2F3F5] rounded text-[#4E5969]"><ChevronLeft size={16}/></button>
                <button className="p-1 hover:bg-[#F2F3F5] rounded text-[#4E5969]"><RefreshCw size={14}/></button>
                <div className="flex-1 px-2 py-1 bg-[#F2F3F5] rounded text-[12px] text-[#1F2329] border border-[#E5E6EB] outline-none truncate">/root</div>
                <button className="p-1 hover:bg-[#F2F3F5] rounded text-[#4E5969]"><Search size={14}/></button>
                <button className="p-1 hover:bg-[#F2F3F5] rounded text-[#4E5969]"><Clock size={14}/></button>
                <button className="p-1 hover:bg-[#F2F3F5] rounded text-[#4E5969]"><MoreVertical size={14}/></button>
              </div>
              
              <div className="py-2 text-center text-[12px] text-[#4E5969] bg-white">
                共 5 个文件, 2 个文件夹, 9.1KB
              </div>

              {/* SFTP List */}
              <div className="flex-1 overflow-auto custom-scrollbar bg-white">
                <table className="w-full text-left text-[12px] text-[#4E5969] whitespace-nowrap">
                  <thead className="bg-[#F7F8FA] border-y border-[#E5E6EB]">
                    <tr>
                      <th className="px-3 py-1.5 font-normal w-[45%]">名称</th>
                      <th className="px-2 py-1.5 font-normal">修改时间 <ChevronDown className="inline w-3 h-3 opacity-50"/></th>
                      <th className="px-2 py-1.5 font-normal">类型 <ChevronDown className="inline w-3 h-3 opacity-50"/></th>
                      <th className="px-3 py-1.5 font-normal text-right">大小</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-[11px]">
                    {MOCK_SFTP_FILES.map((f, i) => (
                      <tr key={i} className="hover:bg-[#F2F3F5] cursor-pointer transition-colors">
                        <td className="px-3 py-1.5 flex items-center gap-1.5 text-[#1F2329]">
                          {f.isDir ? (
                            <Folder className="w-[14px] h-[14px] text-[#FADC19] fill-[#FADC19]" />
                          ) : (
                            <div className="w-[14px] h-[14px] bg-[#95B3F9] text-white rounded-[3px] flex items-center justify-center text-[9px] font-sans font-bold">
                              {f.typeIcon}
                            </div>
                          )}
                          {f.name}
                        </td>
                        <td className="px-2 py-1.5 text-[10px]">{f.date}</td>
                        <td className="px-2 py-1.5 font-sans">{f.isDir ? '文件夹' : '文件'}</td>
                        <td className="px-3 py-1.5 text-right">{f.size}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Server Panel Drawer (Slides out to the left from the monitor bar) */}
          {serverPanelOpen && activeTab?.status === 'connected' && (
             <div className="absolute top-0 bottom-0 right-[48px] w-[420px] shadow-[-12px_0_32px_rgba(0,0,0,0.08)] border-l border-[#E5E6EB] z-[60] rounded-l-xl overflow-hidden">
               <ServerPanelDrawer asset={activeTab.asset} onClose={() => setServerPanelOpen(false)} />
             </div>
          )}
          
          {/* Monitor Bar */}
          <div className={`w-[48px] bg-[#F7F8FA] flex flex-col items-center py-3 shrink-0 relative h-full ${!sftpExpanded ? 'rounded-l-xl rounded-r-xl' : 'rounded-r-xl'}`}>
            {activeTab?.status === 'connected' ? (
              <>
                <button 
                  className={`p-1.5 border rounded-lg shadow-sm mb-3 transition-colors ${serverPanelOpen ? 'bg-[#F2F3F5] border-[#E5E6EB] text-[#4080FF]' : 'bg-white border-[#E5E6EB] text-[#1F2329] hover:bg-[#F2F3F5]'}`}
                  title="打开服务器面板"
                  onClick={() => setServerPanelOpen(!serverPanelOpen)}
                >
                  <SquareTerminal size={16} />
                </button>

                <div className="w-[20px] h-px bg-[#E5E6EB] mb-3"></div>

                <StatPill label="CPU" value="2" colorClass="bg-[#8EBAF9]" />
                <StatPill label="上行" value="5.1K" colorClass="bg-[#FABC4D]" />
                <StatPill label="下行" value="9.2K" colorClass="bg-[#7BC676]" />
                <StatPill label="CPU" value="2.3%" colorClass="bg-[#7BC676]" />
                <StatPill label="内存" value="1.5G" colorClass="bg-[#8EBAF9]" />
                <StatPill label="磁盘" value="34G" colorClass="bg-[#82C8C1]" />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[#C9CDD4]" title="未连接">
                <Link2Off size={20} strokeWidth={1.5} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals & Menus */}
      {showDirModal && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-[999] flex items-center justify-center">
          <div className="bg-white/80 backdrop-blur-xl w-[320px] rounded-xl shadow-2xl border border-white/60 overflow-hidden flex flex-col">
             <div className="p-5 pb-6">
               <div className="text-[14px] text-[#1F2329] font-medium mb-4">请输入目录名称</div>
               <input 
                 type="text" autoFocus
                 className="w-full h-[38px] border border-[#4080FF] rounded-lg px-3 text-[13px] text-[#1F2329] focus:outline-none focus:ring-2 focus:ring-[#4080FF]/20 transition-shadow bg-white" 
                 value={dirName} 
                 onChange={(e) => setDirName(e.target.value)} 
               />
             </div>
             <div className="flex justify-end gap-3 px-5 py-3.5 bg-[#F7F8FA] border-t border-[#E5E6EB]">
               <button className="px-4 py-1.5 rounded-lg text-[#4E5969] text-[13px] hover:bg-[#E5E6EB] transition-colors font-medium" onClick={() => setShowDirModal(false)}>取消</button>
               <button className="px-4 py-1.5 rounded-lg bg-[#4080FF] text-white text-[13px] hover:bg-[#206DF7] transition-colors font-medium shadow-sm" onClick={() => setShowDirModal(false)}>确定</button>
             </div>
          </div>
        </div>
      )}
      
      {/* Settings Full Screen Modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {renderContextMenu()}
    </div>
  );
}