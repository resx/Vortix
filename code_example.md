import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, Terminal, Database, Package, Zap,
  Search, Crosshair, FolderPlus, Link as LinkIcon, 
  ChevronRight, ChevronDown, MoreVertical, Pin, Minus, Square, X,
  Moon, User, Crown, Home, RefreshCw, Cast, Eye, EyeOff, List,
  ArrowUpRight, Hexagon, AlignJustify,
  FileX, Edit2, Copy, Scissors, Clipboard, FileDown, FileUp,
  Monitor, Network, Usb, Plus, Key, Activity, CopyPlus,
  Columns, ExternalLink, FilePlus, ChevronUp
} from 'lucide-react';

// Custom SVG Icons
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
  { id: 't7', name: 'Oracle Cloud SG', type: 'asset', latency: '-', host: '192.168.1.1', user: 'ubuntu', created: '2025-10-10 12:00', expire: '-', remark: '测试环境', folderName: '龟壳' }
];

// --- TERMINAL COMPONENT ---
const TerminalSimulation = ({ asset, onExit, setConnected }) => {
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState(1);
  const [isReady, setIsReady] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setConnected();
      setIsReady(true);
      setLogs([
        { type: 'system', text: `Welcome to HexHub Terminal Simulation...` },
        { type: 'system', text: `Connecting to ${asset.host} port 22...` },
        { type: 'success', text: `Connection established.` },
      ]);
    }, 1200);
    return () => clearTimeout(timer);
  }, [asset, setConnected]);

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
          newLogs.push({ type: 'system', text: `Connection to ${asset.host} closed.` });
          setIsReady(false);
          setTimeout(() => onExit(), 500);
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

  const [tabs, setTabs] = useState([{ id: 'list', type: 'list', title: '列表' }]);
  const [activeTabId, setActiveTabId] = useState('list');

  const activeTab = tabs.find(t => t.id === activeTabId);
  const newMenuRef = useRef(null);
  const listDropdownRef = useRef(null);

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

  const closeTab = (e, tabId) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) setActiveTabId(newTabs.length > 0 ? newTabs[newTabs.length - 1].id : 'list');
  };

  // --- REUSABLE COMPONENTS ---
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

  // --- RENDERERS ---
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
    <div className="flex-1 flex flex-col bg-white rounded-xl border border-[#E5E6EB] shadow-sm min-w-0 relative" onContextMenu={(e) => e.preventDefault()}>
      
      {/* Tab Area (Top edge rounded to match container) */}
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
                onClick={(e) => closeTab(e, tab.id)}
              >
                <X className="w-3.5 h-3.5" />
              </div>
              <Terminal className="w-[14px] h-[14px] text-[#4E5969] shrink-0" />
              <span className={`text-[13px] truncate flex-1 ${isActive ? 'font-medium text-[#1F2329]' : 'text-[#4E5969]'}`}>
                {tab.asset.name}
              </span>
              
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1F2329] z-10"></div>}
              {tab.status === 'connecting' && (
                <div className="absolute bottom-0 left-0 h-[2px] bg-[#4080FF] z-20 animate-[loading_1.5s_ease-out_forwards]"></div>
              )}
            </div>
          );
        })}
      </div>

      {activeTabId === 'list' ? (
        isAssetHidden ? renderHiddenShortcuts() : (
          <>
            {/* Toolbar */}
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

            {/* Main Table (Bottom edge rounded to match container) */}
            <div 
              className="flex-1 overflow-auto custom-scrollbar bg-white rounded-b-xl"
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
          onExit={() => closeTab({ stopPropagation: () => {} }, activeTabId)}
          setConnected={() => setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, status: 'connected' } : t))}
        />
      )}
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
          {shortcut && <span className={`text-[11px] font-sans tracking-wide ${disabled ? 'text-[#C9CDD4]' : 'text-[#86909C] group-hover/item:text-blue-100'}`}>{shortcut}</span>}
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
        className="fixed bg-white/75 backdrop-blur-2xl border border-white/60 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] py-2 min-w-[220px] z-[100]"
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
      `}} />

      <header className="h-[48px] bg-[#F2F3F5] flex items-center justify-between px-0 shrink-0 select-none z-10 relative">
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

        <div className="flex items-center gap-5 pr-5">
          <div className="flex items-center gap-1 bg-[#FDF6EC] text-[#E6A23C] border border-[#F3D19E] px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer hover:bg-[#F5E8C8] transition-colors shadow-sm">
            <Crown className="w-3.5 h-3.5" /> Pro
          </div>

          <div className="flex items-center gap-3.5 text-[#4E5969]">
            <button className="hover:text-[#1F2329] transition-colors"><Moon className="w-[15px] h-[15px]" /></button>
            <button className="hover:text-[#1F2329] transition-colors"><User className="w-[15px] h-[15px]" /></button>
            <button className="hover:text-[#1F2329] transition-colors"><MoreVertical className="w-[15px] h-[15px]" /></button>
          </div>

          <div className="flex items-center gap-4.5 text-[#4E5969] ml-2 border-l border-[#E5E6EB] pl-5">
            <button className="hover:text-[#1F2329] transition-colors"><Pin className="w-[15px] h-[15px]" /></button>
            <button className="hover:text-[#1F2329] transition-colors"><Minus className="w-[15px] h-[15px]" /></button>
            <button className="hover:text-[#1F2329] transition-colors"><Square className="w-3.5 h-3.5" /></button>
            <button className="hover:text-[#1F2329] transition-colors"><X className="w-[15px] h-[15px]" /></button>
          </div>
        </div>
      </header>

      {/* Main Split Island Workspace */}
      <div className="flex-1 flex px-3 pb-3 gap-3 overflow-hidden">
        
        {/* Island 1: Activity Bar (Blended) + Sidebar (White Card) */}
        <div className="flex h-full shrink-0">
          {renderActivityBar()}
          {renderSidebar()}
        </div>

        {/* Island 2: Main Content (White Card) */}
        {renderMainContent()}

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

      {renderContextMenu()}
    </div>
  );
}