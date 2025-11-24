const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const url = require('url');
const fs = require('fs');
const net = require('net');

let mainWindow;
let localServer = null;

// ==========================================
// PlantUML Persistent Process Manager
// ==========================================
class PlantUMLService {
  constructor() {
    this.process = null;
    this.queue = [];
    this.buffer = '';
    this.isRestarting = false;
  }

  getJarPath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, 'plantuml.jar');
    } else {
      return path.join(__dirname, '..', 'plantuml.jar');
    }
  }

  start() {
    this.stop(); // Ensure clean slate
    const jarPath = this.getJarPath();
    
    if (!fs.existsSync(jarPath)) {
      throw new Error(`找不到 plantuml.jar 文件。\n路径: ${jarPath}`);
    }

    // Start Java in pipe mode (-pipe) which reads from STDIN and writes to STDOUT
    // -Djava.awt.headless=true is crucial for server environments
    this.process = spawn('java', [
      '-Djava.awt.headless=true', 
      '-Dfile.encoding=UTF-8', 
      '-jar', jarPath, 
      '-pipe', 
      '-tsvg',
      '-charset', 'UTF-8'
    ]);

    this.process.stdout.on('data', (chunk) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.stderr.on('data', (chunk) => {
      // PlantUML outputs some info to stderr, log it but don't crash
      console.log('PlantUML Stderr:', chunk.toString());
    });

    this.process.on('close', (code) => {
      console.log(`PlantUML process exited with code ${code}`);
      this.process = null;
      // Reject all pending requests
      while (this.queue.length > 0) {
        const { reject } = this.queue.shift();
        reject(new Error('PlantUML process closed unexpectedly'));
      }
    });

    this.process.on('error', (err) => {
      console.error('Failed to start PlantUML process:', err);
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.queue = [];
    this.buffer = '';
  }

  // Handle the output stream from PlantUML
  processBuffer() {
    // We look for the closing </svg> tag to identify a complete diagram
    const delimiter = '</svg>';
    let splitIndex = this.buffer.indexOf(delimiter);

    while (splitIndex !== -1) {
      // Extract the complete SVG part
      const svgContent = this.buffer.substring(0, splitIndex + delimiter.length);
      // Remove it from the buffer
      this.buffer = this.buffer.substring(splitIndex + delimiter.length);

      // Resolve the oldest request in the queue
      const request = this.queue.shift();
      if (request) {
        clearTimeout(request.timeoutId);
        request.resolve(svgContent);
      }

      // Check for next diagram
      splitIndex = this.buffer.indexOf(delimiter);
    }
  }

  async generateSvg(pumlCode) {
    if (!this.process) {
      try {
        this.start();
      } catch (e) {
        return Promise.reject(e);
      }
    }

    // CRITICAL: Check for completeness.
    // In -pipe mode, if we send text without a closing tag (e.g. @enduml), 
    // PlantUML will hang waiting for more input, blocking the entire queue.
    // We do a loose check for common end tags.
    const hasEndTag = /@enduml|@endmindmap|@endwbs|@endgantt|@endsalt|@endjson|@endyaml|@endmath|@endlatex/i.test(pumlCode);
    
    if (!hasEndTag) {
      // Return a placeholder SVG indicating incomplete code instead of blocking the pipe
      return Promise.resolve(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="10" y="40" font-family="sans-serif" font-size="14" fill="#888">...</text></svg>'
      );
    }

    return new Promise((resolve, reject) => {
      // 10s timeout to prevent infinite hanging if something goes wrong
      const timeoutId = setTimeout(() => {
        // If timeout, assume process state is corrupted/desynced. Restart it.
        console.warn('PlantUML rendering timed out, restarting process...');
        const originalQueue = [...this.queue];
        const currentReqIndex = originalQueue.findIndex(r => r.resolve === resolve);
        
        // Remove self from queue
        if (currentReqIndex !== -1) {
            this.queue.splice(currentReqIndex, 1);
        }

        this.restart();
        reject(new Error('Rendering timed out'));
      }, 10000);

      this.queue.push({ resolve, reject, timeoutId });

      // Write code to STDIN
      // Ensure it ends with a newline to trigger processing
      try {
        this.process.stdin.write(pumlCode + '\n');
      } catch (err) {
        clearTimeout(timeoutId);
        reject(err);
      }
    });
  }

  restart() {
    this.stop();
    this.start();
  }
}

const plantUmlService = new PlantUMLService();

// ==========================================
// Electron Window Management
// ==========================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "PlantUML Editor",
    backgroundColor: '#020617',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    autoHideMenuBar: true,
  });

  const isDev = !app.isPackaged; 

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Stop background process when all windows closed
  plantUmlService.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  plantUmlService.stop();
});

// ==========================================
// Local HTTP Server Logic
// ==========================================

// Helper: Try to listen on a port. Returns Promise that resolves if successful, rejects if occupied.
const tryListen = (server, port) => {
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(err);
      } else {
        // Other errors are fatal
        reject(err);
      }
    });
    
    server.once('listening', () => {
      server.removeAllListeners('error'); // Remove the error listener
      resolve(port);
    });

    server.listen(port, '127.0.0.1');
  });
};

const createServerInstance = (event) => {
    const server = http.createServer(async (req, res) => {
      // CORS & Headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      try {
        const parsedUrl = url.parse(req.url);
        // Path: /svg/~h<HEX>
        const parts = parsedUrl.pathname.split('/');
        const hexIndex = parts.findIndex(p => p.startsWith('~h'));

        if (hexIndex === -1) {
          res.writeHead(400);
          res.end('Invalid path');
          return;
        }

        const hex = parts[hexIndex].substring(2); // Remove ~h
        const pumlCode = Buffer.from(hex, 'hex').toString('utf8');

        // Use the persistent service
        try {
            const svgData = await plantUmlService.generateSvg(pumlCode);
            res.writeHead(200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
            res.end(svgData);
        } catch (err) {
            console.error("Generation Error:", err);
            res.writeHead(500);
            res.end('<svg><text y="20" fill="red">Server Error</text></svg>');
        }

      } catch (e) {
        console.error('Server Handler Error:', e);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });

    server.on('error', (e) => {
        // Logic handled in tryListen usually, but global error handler just in case
        console.error("Global Server Error:", e);
    });

    return server;
}

ipcMain.on('start-local-server', async (event, specificPort = null) => {
  // Stop existing HTTP server
  if (localServer) {
    localServer.close();
    localServer = null;
  }

  // Pre-start the Java process
  try {
    plantUmlService.start();
  } catch (err) {
    event.reply('local-server-status', { success: false, error: err.message });
    return;
  }

  // Determine port strategy
  const startPort = 8080;
  const endPort = 8090;

  if (specificPort) {
      // Manual Mode: Try specific port only
      localServer = createServerInstance(event);
      try {
          await tryListen(localServer, specificPort);
          console.log(`Local PlantUML server started on manual port ${specificPort}`);
          event.reply('local-server-status', { success: true, port: specificPort });
      } catch (e) {
          event.reply('local-server-status', { success: false, error: `端口 ${specificPort} 被占用，请尝试其他端口。` });
          localServer = null;
      }
  } else {
      // Auto Mode: Scan 8080 -> 8090
      let currentPort = startPort;
      let started = false;

      while (currentPort <= endPort && !started) {
          localServer = createServerInstance(event);
          try {
              await tryListen(localServer, currentPort);
              started = true;
              console.log(`Local PlantUML server started on auto-detected port ${currentPort}`);
              event.reply('local-server-status', { success: true, port: currentPort });
          } catch (e) {
              console.log(`Port ${currentPort} is busy, trying next...`);
              localServer = null; // Clean up failed instance
              currentPort++;
          }
      }

      if (!started) {
          event.reply('local-server-status', { 
              success: false, 
              error: `端口 ${startPort}-${endPort} 均被占用。请手动指定一个端口。` 
          });
      }
  }
});

ipcMain.on('stop-local-server', (event) => {
  if (localServer) {
    localServer.close();
    localServer = null;
    console.log('Local server stopped');
  }
  // Also stop the Java process to save RAM
  plantUmlService.stop();
});
