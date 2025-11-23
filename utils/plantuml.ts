

export const DEFAULT_SERVER_URL = 'https://www.plantuml.com/plantuml';

/**
 * Encodes PlantUML source code into a URL for the PlantUML server.
 * 
 * Standard PlantUML uses a complex Deflate + Custom Base64 mapping.
 * To keep this client-side implementation lightweight and dependency-free,
 * we use the Hex encoding supported by PlantUML (~h).
 * 
 * Format: {serverUrl}/svg/~h<HEX_STRING>
 */
export const encodePlantUML = (code: string, serverUrl: string = DEFAULT_SERVER_URL): string => {
  try {
    // 1. Encode string to UTF-8 bytes
    const encoder = new TextEncoder();
    const data = encoder.encode(code);

    // 2. Convert bytes to Hex string
    let hexStr = '';
    for (let i = 0; i < data.length; i++) {
      const hex = data[i].toString(16);
      hexStr += (hex.length === 1 ? '0' : '') + hex;
    }

    // 3. Construct URL
    // Remove trailing slash from serverUrl if present
    const cleanBaseUrl = serverUrl.replace(/\/+$/, '');
    
    // Using ~h prefix for hex encoded strings
    return `${cleanBaseUrl}/svg/~h${hexStr}`;
  } catch (e) {
    console.error("Failed to encode PlantUML", e);
    return '';
  }
};

/**
 * Checks the generated SVG for specific PlantUML syntax error messages.
 * PlantUML returns a valid SVG image even on error, containing text describing the error.
 */
export const checkSyntaxError = async (url: string): Promise<{ line: number; message: string } | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const svgText = await response.text();
    
    // PlantUML error SVGs usually contain "Syntax Error?" or "Error" text nodes
    // Also catch java exceptions that might leak into the SVG text
    const isError = svgText.includes("Syntax Error?") || 
                    svgText.includes("Syntax error") || 
                    svgText.includes("java.lang.IllegalStateException");

    if (isError) {
      // Try to extract line number
      // Patterns: 
      // - "[From string (line 2) ]"
      // - "line 2"
      // - "Line 2"
      const lineMatch = svgText.match(/line\s*:?\s*(\d+)/i);
      
      return {
        line: lineMatch ? parseInt(lineMatch[1], 10) : 1, // Default to line 1 if not found but error exists
        message: "语法错误"
      };
    }
    
    return null;
  } catch (e) {
    console.error("Syntax check failed:", e);
    return null;
  }
};

/**
 * Initial example code to populate the editor (Localized)
 */
export const INITIAL_CODE = `@startuml
skinparam backgroundColor transparent
skinparam theme plain

actor "用户" as user
participant "前端界面" as fe
participant "PlantUML 服务器" as puml

user -> fe : 输入 PlantUML 代码
activate fe

fe -> fe : 自动防抖动
fe -> fe : 将代码编码为 Hex 格式
fe -> puml : GET /svg/~h<HexCode>
activate puml
puml --> fe : 返回 SVG 图片
deactivate puml

fe --> user : 实时展示图表
deactivate fe
@enduml`;
