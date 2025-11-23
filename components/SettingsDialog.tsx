
import React, { useState, useEffect } from 'react';
import { DEFAULT_SERVER_URL } from '../utils/plantuml';

// Safely import electron types or object
// Since nodeIntegration is enabled, we can use window.require
const electron = (window as any).require ? (window as any).require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSave: (url: string) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, currentUrl, onSave }) => {
  const [mode, setMode] = useState<'remote' | 'local'>(
    currentUrl.includes('localhost') ? 'local' : 'remote'
  );
  
  // Remote URL State
  const [remoteUrl, setRemoteUrl] = useState(DEFAULT_SERVER_URL);
  
  // Local Server State
  const [localPort, setLocalPort] = useState('8080');
  const [serverStatus, setServerStatus] = useState<{success?: boolean; error?: string} | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (isOpen) {
        const isLocal = currentUrl.includes('localhost');
        setMode(isLocal ? 'local' : 'remote');
        if (!isLocal) {
            setRemoteUrl(currentUrl);
        } else {
            // Try to extract port from current URL
            const match = currentUrl.match(/:(\d+)/);
            if (match) setLocalPort(match[1]);
        }
    }
  }, [currentUrl, isOpen]);

  // IPC Listeners
  useEffect(() => {
    if (!ipcRenderer) return;

    const handleStatus = (event: any, status: { success: boolean, port?: number, error?: string }) => {
        setIsStarting(false);
        if (status.success) {
            setServerStatus({ success: true });
            // Auto save and close on success
            onSave(`http://localhost:${status.port}`);
            setTimeout(() => onClose(), 800); 
        } else {
            setServerStatus({ success: false, error: status.error });
        }
    };

    ipcRenderer.on('local-server-status', handleStatus);
    return () => {
        ipcRenderer.removeAllListeners('local-server-status');
    };
  }, [onSave, onClose]);

  const handleSaveRemote = () => {
    // If switching to remote, stop local server to save resources
    if (ipcRenderer) ipcRenderer.send('stop-local-server');
    
    let trimmed = remoteUrl.trim();
    if (!trimmed) trimmed = DEFAULT_SERVER_URL;
    onSave(trimmed);
    onClose();
  };

  const handleStartLocal = () => {
    if (!ipcRenderer) {
        setServerStatus({ success: false, error: "无法连接到 Electron 主进程" });
        return;
    }
    
    const port = parseInt(localPort, 10);
    if (isNaN(port) || port < 1024 || port > 65535) {
        setServerStatus({ success: false, error: "请输入有效的端口号 (1024-65535)" });
        return;
    }

    setIsStarting(true);
    setServerStatus(null);
    ipcRenderer.send('start-local-server', port);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col animate-in fade-in zoom-in duration-200">
        
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">服务器设置</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Mode Switcher */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
                onClick={() => setMode('remote')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'remote' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
            >
                云端 / 远程
            </button>
            <button
                onClick={() => setMode('local')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${mode === 'local' ? 'bg-brand-900/30 text-brand-400 border border-brand-500/30 shadow' : 'text-slate-500 hover:text-slate-300'}`}
            >
                本地 (内置)
            </button>
          </div>

          {mode === 'remote' ? (
              <div className="space-y-3">
                 <label className="block text-sm font-medium text-slate-300">
                    PlantUML 服务器地址
                 </label>
                 <input
                    type="text"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-brand-500 focus:border-brand-500 outline-none font-mono"
                    placeholder="https://www.plantuml.com/plantuml"
                />
                <p className="text-xs text-slate-500">使用官方或自建的远程 HTTP 服务。</p>
              </div>
          ) : (
              <div className="space-y-4">
                 <div className="bg-slate-800/50 p-3 rounded border border-slate-700/50">
                    <p className="text-xs text-slate-300 mb-2">
                        使用此功能需要：
                    </p>
                    <ul className="list-disc list-inside text-xs text-slate-400 space-y-1">
                        <li>已安装 <strong>Java</strong> (JRE/JDK)。</li>
                        <li>已将 <strong>plantuml.jar</strong> 放在应用根目录下。</li>
                    </ul>
                 </div>

                 <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                        本地端口
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={localPort}
                            onChange={(e) => setLocalPort(e.target.value)}
                            className="w-24 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-brand-500 font-mono outline-none"
                        />
                        <button
                            onClick={handleStartLocal}
                            disabled={isStarting}
                            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium rounded px-4 py-2 transition-all ${
                                serverStatus?.success 
                                ? 'bg-green-600 text-white cursor-default'
                                : 'bg-brand-600 hover:bg-brand-500 text-white'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isStarting && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {serverStatus?.success ? '启动成功' : (isStarting ? '启动中...' : '启动服务 & 保存')}
                        </button>
                    </div>
                 </div>

                 {serverStatus?.error && (
                    <div className="p-3 bg-red-900/20 border border-red-900/50 rounded text-xs text-red-300 whitespace-pre-wrap">
                        {serverStatus.error}
                    </div>
                 )}
              </div>
          )}
        </div>

        {mode === 'remote' && (
             <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3 rounded-b-xl">
                <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">取消</button>
                <button onClick={handleSaveRemote} className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded">保存</button>
            </div>
        )}
      </div>
    </div>
  );
};

export default SettingsDialog;
