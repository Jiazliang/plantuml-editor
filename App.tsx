
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { encodePlantUML, INITIAL_CODE, checkSyntaxError, DEFAULT_SERVER_URL } from './utils/plantuml';
import CodeEditor from './components/CodeEditor';
import Preview from './components/Preview';
import SettingsDialog from './components/SettingsDialog';

// IPC Boilerplate for Electron
const electron = (window as any).require ? (window as any).require('electron') : null;
const ipcRenderer = electron ? electron.ipcRenderer : null;

// Debounce helper to avoid flashing on every keystroke
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
};

const App: React.FC = () => {
  // History Management
  const [history, setHistory] = useState<string[]>([INITIAL_CODE]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const lastEditTimeRef = useRef<number>(0);
  
  const code = history[historyIndex];

  const [syntaxErrorLine, setSyntaxErrorLine] = useState<number | null>(null);

  // Server URL Management
  const [serverUrl, setServerUrl] = useState<string>(() => {
      return localStorage.getItem('plantuml_server_url') || DEFAULT_SERVER_URL;
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Resizable Split Pane State
  const [leftWidth, setLeftWidth] = useState(32); // Percentage - Optimized for compact toolbar
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedCode = useDebounce(code, 500);

  // Update code with history management (coalescing rapid edits)
  const updateCode = useCallback((newCode: string, forceNew: boolean = false) => {
    const now = Date.now();
    const timeDiff = now - lastEditTimeRef.current;
    const isRecent = timeDiff < 1000;
    const isTip = historyIndex === history.length - 1;

    if (!forceNew && isTip && isRecent && historyIndex > 0) {
      // Replace current history entry (coalesce typing)
      setHistory(prev => {
        const newHist = [...prev];
        newHist[historyIndex] = newCode;
        return newHist;
      });
    } else {
      // Add new history entry
      setHistory(prev => {
        const newHist = prev.slice(0, historyIndex + 1);
        newHist.push(newCode);
        return newHist;
      });
      setHistoryIndex(prev => prev + 1);
    }
    lastEditTimeRef.current = now;
  }, [history, historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      lastEditTimeRef.current = 0; // Reset coalesce timer
    }
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      lastEditTimeRef.current = 0; // Reset coalesce timer
    }
  }, [historyIndex, history.length]);

  // Persist serverUrl
  useEffect(() => {
      localStorage.setItem('plantuml_server_url', serverUrl);
  }, [serverUrl]);

  // =========================================================
  // Local Server Lifecycle Management
  // =========================================================

  // 1. Auto-start local server on app launch if previously selected
  useEffect(() => {
    if (ipcRenderer && serverUrl.includes('localhost')) {
        const match = serverUrl.match(/:(\d+)/);
        if (match) {
            const port = parseInt(match[1], 10);
            console.log("[App] Auto-starting local server on port", port);
            ipcRenderer.send('start-local-server', port);
        }
    }
  }, []); // Empty dependency: Run once on mount

  // 2. Ensure local server is stopped when switching to remote
  useEffect(() => {
      if (ipcRenderer && !serverUrl.includes('localhost')) {
          console.log("[App] Switched to remote, stopping local server");
          ipcRenderer.send('stop-local-server');
      }
  }, [serverUrl]);

  // =========================================================

  // Resizer Handlers
  const startResizing = useCallback(() => {
    setIsDragging(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsDragging(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidth =
          ((mouseMoveEvent.clientX - containerRect.left) / containerRect.width) * 100;
        
        // Limit min/max width
        if (newLeftWidth > 20 && newLeftWidth < 80) {
          setLeftWidth(newLeftWidth);
        }
      }
    },
    [isDragging]
  );

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Synchronously calculate URL to avoid "Loading=false but URL=old" gap
  const generatedUrl = useMemo(() => {
    if (!debouncedCode.trim()) return '';
    return encodePlantUML(debouncedCode, serverUrl);
  }, [debouncedCode, serverUrl]);

  // Effect to check syntax error (Side Effect)
  useEffect(() => {
    if (!generatedUrl) {
      setSyntaxErrorLine(null);
      return;
    }

    // Flag to prevent race conditions if multiple validations are in flight
    let isCancelled = false;

    // Check for syntax errors from the generated SVG content
    const validateSyntax = async () => {
      const syntaxError = await checkSyntaxError(generatedUrl);
      
      if (!isCancelled) {
        if (syntaxError) {
          setSyntaxErrorLine(syntaxError.line);
        } else {
          setSyntaxErrorLine(null);
        }
      }
    };

    validateSyntax();

    return () => {
      isCancelled = true;
    };
  }, [generatedUrl]);

  return (
    <div className="flex flex-col h-screen text-slate-200 select-none" style={{ cursor: isDragging ? 'col-resize' : 'default' }}>
      {/* Header */}
      <header className="flex-none h-14 bg-slate-900 border-b border-slate-800 flex items-center px-6 justify-between z-20 shadow-md select-none">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-brand-500/20">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <h1 className="font-bold text-lg tracking-tight text-white">
            PlantUML <span className="text-brand-500">Editor</span>
          </h1>
        </div>
        <div className="flex items-center space-x-4 text-sm">
          <a href="https://plantuml.com/" target="_blank" rel="noreferrer" className="text-slate-400 hover:text-brand-400 transition-colors hidden sm:inline">文档</a>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-full hover:bg-slate-800"
            title="设置服务器地址"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.042 7.042 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="h-4 w-px bg-slate-700"></div>
          <span className="text-slate-500">v2.0.0</span>
        </div>
      </header>

      {/* Main Content with Resizable Split Pane */}
      <div className="flex-1 flex overflow-hidden" ref={containerRef}>
        {/* Left Pane: Editor */}
        <div 
            className="flex flex-col z-10 shadow-xl bg-slate-900"
            style={{ width: `${leftWidth}%` }}
        >
          <div className="flex-1 overflow-hidden relative">
             {/* Overlay while dragging to prevent iframe/textarea interference */}
            {isDragging && <div className="absolute inset-0 z-50 bg-transparent"></div>}
            
            <CodeEditor 
              code={code} 
              onChange={(val) => updateCode(val, false)} 
              errorLine={syntaxErrorLine}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={historyIndex > 0}
              canRedo={historyIndex < history.length - 1}
            />
          </div>
        </div>

        {/* Resizer Handle */}
        <div
            className="w-1 bg-slate-800 hover:bg-brand-500 cursor-col-resize z-30 transition-colors flex items-center justify-center group"
            onMouseDown={startResizing}
        >
             {/* Little grabber visual */}
             <div className="h-8 w-0.5 bg-slate-600 group-hover:bg-white rounded"></div>
        </div>

        {/* Right Pane: Preview */}
        <div 
            className="bg-slate-950 flex flex-col" 
            style={{ width: `${100 - leftWidth}%` }}
        >
           <div className="flex-1 relative overflow-hidden">
             {/* Overlay while dragging */}
             {isDragging && <div className="absolute inset-0 z-50 bg-transparent"></div>}
             
             <Preview imageUrl={generatedUrl} isLoading={code !== debouncedCode} />
           </div>
        </div>
      </div>

      <SettingsDialog 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUrl={serverUrl}
        onSave={setServerUrl}
      />
    </div>
  );
};

export default App;
