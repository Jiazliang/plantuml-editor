
import React, { useState } from 'react';

// Safely import electron if available
const electron = (window as any).require ? (window as any).require('electron') : null;

interface PreviewProps {
  imageUrl: string;
  isLoading: boolean;
}

const Preview: React.FC<PreviewProps> = ({ imageUrl, isLoading }) => {
  // State for Derived State Pattern
  const [lastImageUrl, setLastImageUrl] = useState(imageUrl);
  
  // Internal loading state
  // We initialize based on whether we have a URL to load
  const [isImageLoading, setIsImageLoading] = useState(!!imageUrl);

  const [imgError, setImgError] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Zoom and Pan State
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Sync state with props (Derived State Pattern)
  // This runs during render, ensuring no frame gap between prop change and state reset.
  if (imageUrl !== lastImageUrl) {
    setLastImageUrl(imageUrl);
    setIsImageLoading(!!imageUrl);
    setImgError(false);
    setSvgContent(null);
    setCopied(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  const handleImgLoad = () => {
    setIsImageLoading(false);
  };

  const handleImgError = () => {
    setIsImageLoading(false); // Stop loading spinner on error
    setImgError(true);
    if (imageUrl) {
        fetch(imageUrl)
            .then(res => res.text())
            .then(text => {
                if (text.trim().includes('<svg')) {
                    setSvgContent(text);
                }
            })
            .catch(e => console.error("Failed to recover SVG content", e));
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `diagram-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Download failed", e);
      alert("无法下载图片（可能受服务器 CORS 限制影响）。");
    }
  };

  const handleCopyPNG = async () => {
      try {
          // 1. Get SVG content
          let text = svgContent;
          if (!text && imageUrl) {
             const response = await fetch(imageUrl);
             if (!response.ok) throw new Error("Failed to fetch");
             text = await response.text();
          }

          if (!text) throw new Error("No SVG content found");

          // 2. Convert SVG string to Image
          const img = new Image();
          // Handling Unicode in SVG for Base64 safely
          const svg64 = btoa(unescape(encodeURIComponent(text)));
          const b64Start = 'data:image/svg+xml;base64,';
          const image64 = b64Start + svg64;

          img.onload = () => {
              const canvas = document.createElement('canvas');
              // Increase scale for better quality (e.g. 2x)
              const scaleFactor = 2;
              canvas.width = img.width * scaleFactor;
              canvas.height = img.height * scaleFactor;
              
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              
              // Fill white background to handle transparency
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              ctx.scale(scaleFactor, scaleFactor);
              ctx.drawImage(img, 0, 0);

              if (electron) {
                  // Electron: Use nativeImage
                  try {
                      const dataURL = canvas.toDataURL('image/png');
                      const nativeImage = electron.nativeImage.createFromDataURL(dataURL);
                      electron.clipboard.writeImage(nativeImage);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                  } catch (e) {
                      console.error("Electron copy failed", e);
                      alert("复制失败");
                  }
              } else {
                  // Web: Use Clipboard API
                  canvas.toBlob(async (blob) => {
                      if (!blob) {
                          alert("生成图片失败");
                          return;
                      }
                      try {
                          await navigator.clipboard.write([
                              new ClipboardItem({ 'image/png': blob })
                          ]);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                      } catch (err) {
                          console.error("Web copy failed", err);
                          alert("复制失败: 您的浏览器可能不支持直接写入 PNG 图片到剪贴板。");
                      }
                  }, 'image/png');
              }
          };

          img.onerror = (e) => {
              console.error("SVG Image load failed", e);
              alert("无法转换 SVG 为 PNG。");
          };

          img.src = image64;

      } catch (e) {
          console.error("Copy preparation failed", e);
          alert("复制失败：无法获取图片数据。");
      }
  };

  // Zoom Handlers
  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 5));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.1));
  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Pan Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only allow left click drag
    if (e.button !== 0) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Determine if we should show the loading overlay
  // Show if parent is calculating (isLoading) OR if browser is fetching image (isImageLoading)
  // But stop showing if we have an error or recovered SVG content
  const showLoading = isLoading || (imageUrl && isImageLoading && !imgError && !svgContent);

  return (
    <div className="flex flex-col h-full bg-slate-950 relative overflow-hidden">
       <div className="flex items-center justify-between px-4 h-10 bg-slate-800 border-b border-slate-700 shrink-0 z-20 relative">
        <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">预览</span>
            
            {/* Zoom Controls */}
            <div className="flex items-center bg-slate-900 rounded border border-slate-700 p-0.5 ml-2">
                <button 
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                    title="缩小"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z" clipRule="evenodd" />
                    </svg>
                </button>
                <span className="text-[10px] text-slate-400 w-8 text-center select-none">{Math.round(scale * 100)}%</span>
                <button 
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                    title="放大"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                         <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                </button>
                <div className="w-px h-3 bg-slate-700 mx-1"></div>
                <button 
                    onClick={handleResetZoom}
                    className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors"
                    title="重置视图"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                        <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.061.025z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button
                onClick={handleCopyPNG}
                disabled={showLoading || (!imageUrl && !svgContent)}
                className="text-xs flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="复制 PNG 图片 (适合粘贴到文档/微信)"
            >
                {copied ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-green-400">
                             <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-400">已复制 PNG</span>
                    </>
                ) : (
                    <>
                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                            <path fillRule="evenodd" d="M13.887 3.182c.396.037.79.08 1.183.128C16.194 3.45 17 4.414 17 5.517V16.75A2.25 2.25 0 0114.75 19h-9.5A2.25 2.25 0 013 16.75V5.517c0-1.103.806-2.068 1.93-2.207.393-.048.787-.09 1.183-.128A3.001 3.001 0 019 1h2c1.373 0 2.531.923 2.887 2.182zM7.5 4A1.5 1.5 0 019 2.5h2A1.5 1.5 0 0112.5 4v.5h-5V4z" clipRule="evenodd" />
                         </svg>
                         <span>复制 PNG 图片</span>
                    </>
                )}
            </button>

            <button 
                onClick={handleDownload}
                disabled={showLoading || (!imageUrl && !svgContent)}
                className="text-xs flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="下载 SVG 代码"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.965 3.129V2.75z" />
                    <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                </svg>
                下载 SVG 代码
            </button>
        </div>
      </div>

      <div 
        className={`flex-1 overflow-hidden flex items-center justify-center p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed ${
             imageUrl ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        onMouseDown={imageUrl ? handleMouseDown : undefined}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {showLoading && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center z-10 backdrop-blur-sm">
             <svg className="animate-spin h-10 w-10 text-brand-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-brand-200 font-medium animate-pulse">正在渲染图表...</span>
          </div>
        )}

        {/* Image Container with Transform */}
        <div
            style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                pointerEvents: 'none', // Allows clicks to pass through to the container for dragging
                maxWidth: '100%',
                maxHeight: '100%'
            }}
            className="flex items-center justify-center"
        >
            {/* Case 1: Render Recovered SVG (often the syntax error image) */}
            {!showLoading && svgContent && (
                 <div 
                    className="max-w-none shadow-2xl bg-white rounded-sm p-2"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                 />
            )}

            {/* Case 2: Render Image via img tag */}
            {!svgContent && !imgError && imageUrl && (
              <img 
                key={imageUrl}
                src={imageUrl} 
                alt="PlantUML Diagram" 
                className={`max-w-none shadow-2xl bg-white rounded-sm select-none ${showLoading ? 'opacity-0' : 'opacity-100'}`}
                draggable={false}
                onError={handleImgError}
                onLoad={handleImgLoad}
              />
            )}
        </div>

        {/* Case 3: Fatal Error (Neither img nor SVG content worked) */}
        {!showLoading && !svgContent && imgError && (
          <div className="absolute text-red-400 p-4 border border-red-900 bg-red-950/30 rounded max-w-md text-center pointer-events-none">
            <h3 className="font-bold mb-2">加载失败</h3>
            <p className="text-sm opacity-80">无法加载图表图片。请检查服务器连接。</p>
          </div>
        )}

        {!showLoading && !imageUrl && !imgError && !svgContent && (
          <div className="absolute text-slate-600 text-center pointer-events-none">
            <p>输入 PlantUML 代码以生成图表</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Preview;
