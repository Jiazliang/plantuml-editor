
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { TEMPLATES } from '../utils/templates';
import { PUML_THEMES, applyThemeToCode, detectTheme } from '../utils/themes';

interface CodeEditorProps {
  code: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  errorLine?: number | null;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const PLANTUML_COLORS = [
  { name: '红色 (Red)', value: '#Red' },
  { name: '绿色 (Green)', value: '#Green' },
  { name: '蓝色 (Blue)', value: '#Blue' },
  { name: '黄色 (Yellow)', value: '#Yellow' },
  { name: '橙色 (Orange)', value: '#Orange' },
  { name: '紫色 (Purple)', value: '#Purple' },
  { name: '粉色 (Pink)', value: '#Pink' },
  { name: '棕色 (Brown)', value: '#Brown' },
  { name: '灰色 (Gray)', value: '#Gray' },
  { name: '白色 (White)', value: '#White' },
  { name: '黑色 (Black)', value: '#Black' },
  { name: '淡蓝 (AliceBlue)', value: '#AliceBlue' },
  { name: '淡黄 (LightYellow)', value: '#LightYellow' },
  { name: '浅灰 (LightGray)', value: '#LightGray' },
];

// Keywords for Autocompletion
const COMPLETION_KEYWORDS = [
  // Structure
  "@startuml", "@enduml", "@startmindmap", "@endmindmap", "@startwbs", "@endwbs", "@startjson", "@endjson",
  "package", "namespace", "node", "cloud", "database", "frame", "folder", "rectangle", "storage", "card",
  
  // Elements
  "actor", "participant", "usecase", "class", "interface", "abstract", "enum", "component", 
  "entity", "boundary", "control", "collections", "queue", "topic", "agent", "person", "system", "container",
  "state", "object", "map",
  
  // Features
  "autonumber", "title", "header", "footer", "legend", "caption", 
  "skinparam", "!theme", "!include", "!define", 
  
  // Logic
  "if", "then", "else", "elseif", "endif", "while", "endwhile", "repeat", "endrepeat", "fork", "endfork",
  "start", "stop", "end", "break", "partition", "group", 
  "activate", "deactivate", "return",
  
  // Arrows
  "->", "-->",
  
  // Notes
  "note", "rnote", "hnote", "left", "right", "top", "bottom", "over", "of", "as"
];

interface SuggestionState {
  isOpen: boolean;
  position: { top: number; left: number };
  filteredList: string[];
  activeIndex: number;
  matchStart: number; // Index in code where the word starts
}

// Syntax Highlighter Logic
const highlightSyntax = (code: string) => {
  if (!code) return '';

  // 1. Escape HTML characters first
  let html = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Helper to safely replace patterns outside of HTML tags
  // This prevents keywords (like 'class') from breaking generated HTML attributes (like class="...")
  const safeReplace = (input: string, pattern: RegExp, replacement: string) => {
    const source = pattern.source;
    // Ensure global flag is set, preserve multiline if present
    const flags = (pattern.flags.includes('m') ? 'm' : '') + 'g'; 
    
    // Match HTML tags OR the pattern
    const combined = new RegExp(`(<[^>]+>)|(${source})`, flags);
    
    return input.replace(combined, (match, tag, content) => {
      if (tag) return tag; // Preserve tag unchanged
      
      // Apply replacement to the matched content
      // We create a new RegExp from the source to run the replacement logic (handling capture groups like $1)
      // We remove global flag for single replacement on the content snippet
      return content.replace(new RegExp(source, pattern.flags.replace('g', '')), replacement);
    });
  };

  // 2. Comments: ' comment or /' comment '/
  html = html.replace(/('.*)$/gm, '<span class="text-slate-500 italic">$1</span>');

  // 3. Directives: !theme, skinparam, etc.
  html = safeReplace(html, /^(\s*)(!theme|skinparam|!include|!define|!procedure|!function)(\s+)/m, '$1<span class="text-pink-400 font-bold">$2</span>$3');

  // 4. Start/End Tags
  html = safeReplace(html, /(@startuml|@enduml|@startsalt|@endsalt|@startmindmap|@endmindmap|@startwbs|@endwbs|@startgantt|@endgantt|@startjson|@endjson|@startyaml|@endyaml)/, '<span class="text-brand-400 font-bold">$1</span>');

  // 5. Strings
  html = safeReplace(html, /("[^"]*")/, '<span class="text-yellow-300">$1</span>');

  // 6. Keywords (Participants, etc.)
  const keywords = "actor|participant|usecase|class|interface|abstract|enum|component|database|entity|boundary|control|collections|queue|topic|node|cloud|frame|package|namespace|rectangle|storage|card|file|folder|artifact|agent|stack|hexagon|person|system|container|state|object|map|json|yaml";
  html = safeReplace(html, new RegExp(`\\b(${keywords})\\b`), '<span class="text-purple-400 font-semibold">$1</span>');

  // 7. Control Flow
  const controls = "if|then|else|elseif|endif|while|endwhile|fork|endfork|repeat|endrepeat|start|stop|end|break|partition|group|end|note|rnote|hnote|legend|activate|deactivate|return";
  html = safeReplace(html, new RegExp(`\\b(${controls})\\b`), '<span class="text-orange-400">$1</span>');

  // 8. Relationship 'as'
  html = safeReplace(html, /(\s+)(as)(\s+)/, '$1<span class="text-red-400 italic">$2</span>$3');

  // 9. Arrows (simplified regex for common arrows)
  html = safeReplace(html, /([-=.]+(?:>|\||\\|\/|o|x|\+)|\<[-=.]+)/, '<span class="text-blue-400 font-bold">$1</span>');

  // 10. Colors in hex
  html = safeReplace(html, /(#\w+)/, '<span class="text-emerald-300">$1</span>');

  return html;
};

const CodeEditor: React.FC<CodeEditorProps> = ({ 
  code, 
  onChange, 
  disabled, 
  errorLine,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}) => {
  const [copied, setCopied] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null); // For measuring cursor position
  const fileInputRef = useRef<HTMLInputElement>(null); // For file import
  const menuRef = useRef<HTMLDivElement>(null); // For dropdown menu

  // Autocomplete State
  const [suggestions, setSuggestions] = useState<SuggestionState>({
    isOpen: false,
    position: { top: 0, left: 0 },
    filteredList: [],
    activeIndex: 0,
    matchStart: 0,
  });

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setIsMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    if (TEMPLATES[key]) {
      onChange(TEMPLATES[key].code);
    }
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const themeValue = e.target.value;
    const newCode = applyThemeToCode(code, themeValue);
    onChange(newCode);
  };

  // Helper to insert text at cursor position
  const insertText = (text: string, startOffset: number = 0, endOffset: number = 0) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Apply offset if we are replacing a partial word (autocomplete)
    const replaceStart = start - startOffset;
    const replaceEnd = end + endOffset;

    const newCode = code.substring(0, replaceStart) + text + code.substring(replaceEnd);
    onChange(newCode);
    
    // Restore cursor position
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const newCursorPos = replaceStart + text.length;
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
        // Close suggestions after insert
        setSuggestions(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleColorInsert = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const colorVal = e.target.value;
    if (colorVal) {
      let textToInsert = colorVal;
      const textarea = textareaRef.current;
      
      // Smart spacing: check if we need to add a space before the color
      if (textarea) {
        const cursor = textarea.selectionStart;
        if (cursor > 0) {
            const prevChar = code[cursor - 1];
            // If previous char is not whitespace, add a space
            if (prevChar && !/\s/.test(prevChar)) {
                textToInsert = ' ' + textToInsert;
            }
        }
      }

      insertText(textToInsert);
      e.target.value = "";
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  // Auto-format logic
  const handleFormat = () => {
    const lines = code.split('\n');
    let indentLevel = 0;
    const indentUnit = '  '; // 2 spaces

    const formattedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return ''; 

      // Check for dedent triggers (reduce level before printing current line)
      // Matches keywords that end a block: deactivate, return, end*, }, else, case
      const isDedent = 
        /^deactivate\b/.test(trimmed) ||
        /^return\b/.test(trimmed) ||
        /^(end|endif|endwhile|endfork|endrepeat|endswitch|endcase)\b/.test(trimmed) ||
        /^else\b/.test(trimmed) ||
        /^elseif\b/.test(trimmed) ||
        /^case\b/.test(trimmed) ||
        /^\}/.test(trimmed);

      if (isDedent) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const currentIndentStr = indentUnit.repeat(indentLevel);
      const newLine = currentIndentStr + trimmed;

      // Check for indent triggers (increase level for NEXT line)
      // Matches keywords that start a block
      const isIndent = 
        /^activate\b/.test(trimmed) ||
        /^(group|box|partition|loop|alt|opt|try|catch|break|critical|switch)\b/.test(trimmed) ||
        /^(if|while|repeat|fork)\b/.test(trimmed) ||
        /^else\b/.test(trimmed) ||
        /^elseif\b/.test(trimmed) ||
        /^case\b/.test(trimmed) ||
        // Note blocks (that don't have a colon inline)
        /^[rh]?note\s+(left|right|top|bottom|over)\b/.test(trimmed) && !trimmed.includes(':') || 
        /\{$/.test(trimmed); // Lines ending with {

      if (isIndent) {
        indentLevel++;
      }

      return newLine;
    });

    onChange(formattedLines.join('\n'));
  };

  // File Import Handler
  const triggerFileUpload = () => {
    fileInputRef.current?.click();
    setIsMenuOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        onChange(text);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    e.target.value = '';
  };

  // File Export Handler
  const handleFileDownload = () => {
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plantuml-${Date.now()}.puml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setIsMenuOpen(false);
  };

  // Autocomplete Logic: Get Cursor Coordinates
  const updateCursorPosition = (cursorIndex: number) => {
    if (!textareaRef.current || !measureRef.current) return { top: 0, left: 0 };

    const textBeforeCursor = code.substring(0, cursorIndex);
    
    // We use a hidden div that mirrors the textarea styles exactly to measure position
    measureRef.current.innerHTML = textBeforeCursor
        .replace(/\n$/g, '\n\u200b') // Handle trailing newline
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;') + '<span id="caret">|</span>';

    const caret = measureRef.current.querySelector('#caret') as HTMLElement;
    if (caret) {
        const top = caret.offsetTop - (textareaRef.current.scrollTop || 0);
        const left = caret.offsetLeft - (textareaRef.current.scrollLeft || 0);
        
        // Adjust line height for visual placement (below the cursor)
        return { top: top + 20, left: left };
    }
    return { top: 0, left: 0 };
  };

  const checkSuggestions = (value: string, cursorIndex: number) => {
    // Find the word being typed currently
    // Look backwards from cursor until whitespace or forbidden char
    // Added - and > and . to allowed characters for detection to support arrows
    let i = cursorIndex - 1;
    while (i >= 0 && /[\w!@\->.]/.test(value[i])) {
        i--;
    }
    // i is now at the index BEFORE the word, or -1
    const startIdx = i + 1;
    const currentWord = value.substring(startIdx, cursorIndex);

    if (currentWord.length < 1) {
        setSuggestions(prev => ({ ...prev, isOpen: false }));
        return;
    }
    
    // If it's a very short word, only trigger for symbols like - or @
    if (currentWord.length < 2 && !/^[-@!]/.test(currentWord)) {
         setSuggestions(prev => ({ ...prev, isOpen: false }));
         return;
    }

    const matches = COMPLETION_KEYWORDS.filter(k => 
        k.toLowerCase().startsWith(currentWord.toLowerCase()) && k !== currentWord
    );

    if (matches.length > 0) {
        const pos = updateCursorPosition(cursorIndex);
        setSuggestions({
            isOpen: true,
            position: pos,
            filteredList: matches.slice(0, 8), // Limit to 8 suggestions
            activeIndex: 0,
            matchStart: startIdx
        });
    } else {
        setSuggestions(prev => ({ ...prev, isOpen: false }));
    }
  };

  const confirmSuggestion = (index: number) => {
    const word = suggestions.filteredList[index];
    if (word) {
        const currentLen = code.substring(suggestions.matchStart, textareaRef.current?.selectionStart || 0).length;
        insertText(word, currentLen, 0);
    }
  };

  // Determine current theme for the dropdown value
  const currentTheme = useMemo(() => detectTheme(code), [code]);

  // Handle Keyboard Events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Suggestion Navigation
    if (suggestions.isOpen) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSuggestions(prev => ({
                ...prev,
                activeIndex: (prev.activeIndex + 1) % prev.filteredList.length
            }));
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSuggestions(prev => ({
                ...prev,
                activeIndex: (prev.activeIndex - 1 + prev.filteredList.length) % prev.filteredList.length
            }));
            return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            confirmSuggestion(suggestions.activeIndex);
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setSuggestions(prev => ({ ...prev, isOpen: false }));
            return;
        }
    }

    // Undo / Redo Shortcuts
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        return;
      }
      if (e.key === 'y') {
        e.preventDefault();
        onRedo?.();
        return;
      }
    }

    // Tab Indentation (if not using autocomplete)
    if (e.key === 'Tab' && !suggestions.isOpen) {
      e.preventDefault();
      insertText("  ");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      onChange(val);
      checkSuggestions(val, e.target.selectionStart);
  };

  // Sync scrolling between textarea, pre (highlighter), and line numbers
  const handleScroll = () => {
    if (textareaRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
      if (preRef.current) {
        preRef.current.scrollTop = scrollTop;
        preRef.current.scrollLeft = scrollLeft;
      }
      // Close suggestions on scroll to avoid detached UI
      if (suggestions.isOpen) {
          setSuggestions(prev => ({...prev, isOpen: false}));
      }
    }
  };

  // Calculate line numbers
  const lines = useMemo(() => code.split('\n'), [code]);

  // Generate highlighted HTML
  const highlightedCode = useMemo(() => highlightSyntax(code), [code]);

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 h-10 bg-slate-800 border-b border-slate-700 shrink-0 gap-2">
        
        {/* Left Group: Settings/Selectors */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-fade-right">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:inline-block mr-1">编辑器</span>
          
          {/* Template Selector */}
          <div className="relative group shrink-0">
            <select
              className="appearance-none bg-slate-900 text-xs text-slate-300 border border-slate-600 rounded pl-2 pr-6 py-1 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all cursor-pointer w-24 md:w-28"
              onChange={handleTemplateChange}
              value=""
              disabled={disabled}
              title="选择一个模板以覆盖当前代码"
            >
              <option value="" disabled>加载模板...</option>
              {Object.entries(TEMPLATES).map(([key, t]) => (
                <option key={key} value={key}>{t.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
              <svg className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>

          {/* Theme Selector */}
          <div className="relative group shrink-0">
            <select
              className="appearance-none bg-slate-900 text-xs text-slate-300 border border-slate-600 rounded pl-2 pr-6 py-1 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all cursor-pointer w-20 md:w-24"
              onChange={handleThemeChange}
              value={currentTheme} 
              disabled={disabled}
              title="切换图表主题风格"
            >
              <option value="">主题...</option>
              {PUML_THEMES.map((theme) => (
                <option key={theme.value} value={theme.value}>{theme.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
              <svg className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>

           {/* Color Selector */}
           <div className="relative group shrink-0">
            <select
              className="appearance-none bg-slate-900 text-xs text-slate-300 border border-slate-600 rounded pl-2 pr-6 py-1 hover:border-brand-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition-all cursor-pointer w-16 md:w-20"
              onChange={handleColorInsert}
              value=""
              disabled={disabled}
              title="插入颜色代码到光标处"
            >
              <option value="" disabled>颜色...</option>
              {PLANTUML_COLORS.map((c) => (
                <option key={c.name} value={c.value}>{c.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400">
              <svg className="h-3 w-3 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Right Group: Actions */}
        <div className="flex items-center gap-2 shrink-0">
            {/* Undo / Redo Buttons */}
            <div className="flex items-center gap-1 bg-slate-900 rounded p-0.5 border border-slate-700">
              <button 
                onClick={onUndo}
                disabled={!canUndo}
                title="撤销 (Ctrl+Z)"
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.061.025z" clipRule="evenodd" />
                </svg>
              </button>
              <button 
                onClick={onRedo}
                disabled={!canRedo}
                title="重做 (Ctrl+Y)"
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M12.207 2.232a.75.75 0 00.025 1.06l4.146 3.958H6.375a5.375 5.375 0 000 10.75h2.875a.75.75 0 000-1.5H6.375a3.875 3.875 0 010-7.75h10.003l-4.146 3.957a.75.75 0 001.036 1.085l5.5-5.25a.75.75 0 000-1.085l-5.5-5.25a.75.75 0 00-1.061.025z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="h-3 w-px bg-slate-700"></div>

            {/* Format Button (Icon Only) */}
            <button
                onClick={handleFormat}
                className="flex items-center justify-center p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded transition-colors focus:outline-none"
                title="自动格式化代码"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 15.25zM2 10a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
                </svg>
            </button>

            {/* Copy Button (Icon Only) */}
            <button
                onClick={handleCopy}
                className="flex items-center justify-center p-1.5 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded transition-colors focus:outline-none"
                title="复制 PlantUML 代码"
            >
                {copied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-400">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                        <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                    </svg>
                )}
            </button>

            <div className="h-3 w-px bg-slate-700"></div>

            {/* File Menu (More Actions) */}
            <div className="relative" ref={menuRef}>
                <button 
                   onClick={() => setIsMenuOpen(!isMenuOpen)}
                   className={`flex items-center justify-center p-1.5 rounded transition-colors focus:outline-none ${isMenuOpen ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-brand-400 hover:bg-slate-800'}`}
                   title="文件操作 (导入/导出)"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                    </svg>
                </button>
                
                {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                        <button 
                            onClick={triggerFileUpload}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            导入文件
                        </button>
                        <button
                            onClick={handleFileDownload}
                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white w-full text-left"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            导出文件
                        </button>
                    </div>
                )}
            </div>

            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".puml,.plantuml,.txt" 
                className="hidden" 
            />
        </div>
      </div>
      
      {/* Editor Area */}
      <div className="relative flex-1 overflow-hidden flex">
        {/* Line Numbers */}
        <div 
          ref={lineNumbersRef}
          className="bg-slate-900 text-right select-none py-4 pr-0 border-r border-slate-800 overflow-hidden shrink-0 z-10"
          style={{ minWidth: '3.5rem' }}
        >
          {lines.map((_, i) => {
            const lineNum = i + 1;
            const isError = errorLine === lineNum;
            return (
              <div 
                key={i} 
                className={`font-mono text-sm leading-6 transition-colors duration-200 flex justify-end items-center pr-2 ${
                  isError 
                    ? 'text-red-300 font-bold' 
                    : 'text-slate-600'
                }`}
              >
                {isError && (
                   <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
                )}
                {lineNum}
              </div>
            );
          })}
        </div>

        {/* Editor Overlay Container */}
        <div className="relative flex-1 h-full bg-slate-900 group">
            
            {/* Hidden Mirror Div for Cursor Measurement */}
            <div
                ref={measureRef}
                aria-hidden="true"
                className="absolute top-0 left-0 w-full p-4 font-mono text-sm leading-6 whitespace-pre bg-transparent text-transparent pointer-events-none overflow-hidden -z-50 opacity-0"
            />

            {/* Syntax Highlight Layer (Background) */}
            <pre
                ref={preRef}
                aria-hidden="true"
                className="absolute inset-0 w-full h-full p-4 m-0 font-mono text-sm leading-6 whitespace-pre overflow-auto pointer-events-none bg-slate-900 text-slate-300"
                dangerouslySetInnerHTML={{ __html: highlightedCode + '<br/>' }} 
            />

            {/* Actual Textarea (Foreground) */}
            <textarea
                ref={textareaRef}
                className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 whitespace-pre bg-transparent text-transparent caret-white resize-none focus:outline-none focus:ring-0 z-10"
                style={{ color: 'transparent', caretColor: 'white' }}
                value={code}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onScroll={handleScroll}
                spellCheck={false}
                placeholder="@startuml..."
                disabled={disabled}
            />

             {/* Suggestion Dropdown */}
             {suggestions.isOpen && (
                <div 
                    className="absolute z-50 bg-slate-800 border border-slate-700 rounded shadow-xl overflow-hidden min-w-[150px] max-h-60 flex flex-col"
                    style={{ 
                        top: suggestions.position.top, 
                        left: suggestions.position.left 
                    }}
                >
                    <div className="text-[10px] bg-slate-900 text-slate-500 px-2 py-1 border-b border-slate-700 font-medium">
                        SUGGESTIONS
                    </div>
                    <ul className="overflow-auto py-1">
                        {suggestions.filteredList.map((item, idx) => (
                            <li 
                                key={item}
                                className={`px-3 py-1.5 text-xs font-mono cursor-pointer flex items-center gap-2 ${
                                    idx === suggestions.activeIndex 
                                        ? 'bg-brand-600 text-white' 
                                        : 'text-slate-300 hover:bg-slate-700'
                                }`}
                                onClick={() => confirmSuggestion(idx)}
                                onMouseEnter={() => setSuggestions(prev => ({...prev, activeIndex: idx}))}
                            >
                                <span className="opacity-50 text-[10px]">
                                    {item.startsWith('@') ? 'CMD' : 'KW'}
                                </span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Error Line Background Indicator */}
            {errorLine && lines[errorLine - 1] !== undefined && (
                <div 
                    className="absolute left-0 right-0 bg-red-500/10 pointer-events-none z-0 border-y border-red-500/20"
                    style={{ 
                        top: `${(errorLine - 1) * 1.5 + 1}rem`, 
                        height: '1.5rem' 
                    }}
                />
            )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
