
/**
 * PlantUML Themes based on user provided list and standard themes.
 */

export interface PumlTheme {
  name: string;
  value: string;
}

export const PUML_THEMES: PumlTheme[] = [
  { name: '默认 (Default)', value: '' },
  { name: '极简 (Plain)', value: 'plain' },
  { name: '复古 (Amiga)', value: 'amiga' },
  { name: 'AWS 橙 (AWS Orange)', value: 'aws-orange' },
  { name: '黑骑士 (Black Knight)', value: 'black-knight' },
  { name: '蓝灰 (Bluegray)', value: 'bluegray' },
  { name: '工程蓝图 (Blueprint)', value: 'blueprint' },
  { name: '碳灰 (Carbon Gray)', value: 'carbon-gray' },
  { name: '天蓝 (Cerulean)', value: 'cerulean' },
  { name: '云架构 (Cloudscape Design)', value: 'cloudscape-design' },
  { name: 'CRT 琥珀 (CRT Amber)', value: 'crt-amber' },
  { name: '赛博格 (Cyborg)', value: 'cyborg' },
  { name: '黑客 (Hacker)', value: 'hacker' },
  { name: '亮灰 (Lightgray)', value: 'lightgray' },
  { name: '火星 (Mars)', value: 'mars' },
  { name: '质感 (Materia)', value: 'materia' },
  { name: '金属 (Metal)', value: 'metal' },
  { name: '油印 (Mimeograph)', value: 'mimeograph' },
  { name: '薄荷 (Minty)', value: 'minty' },
  { name: '单色 (Mono)', value: 'mono' },
  { name: '红裙深蓝 (Reddress Darkblue)', value: 'reddress-darkblue' },
  { name: '红裙浅蓝 (Reddress Lightblue)', value: 'reddress-lightblue' },
  { name: '砂岩 (Sandstone)', value: 'sandstone' },
  { name: '银色 (Silver)', value: 'silver' },
  { name: '手绘 (Sketchy)', value: 'sketchy' },
  { name: '太空实验室 (Spacelab)', value: 'spacelab' },
  { name: '逐日 (Sunlust)', value: 'sunlust' },
  { name: '超级英雄 (Superhero)', value: 'superhero' },
  { name: '玩具 (Toy)', value: 'toy' },
  { name: '联合 (United)', value: 'united' },
  { name: '活力 (Vibrant)', value: 'vibrant' },
];

/**
 * Replaces or inserts the theme directive in the PlantUML code.
 * Handles both `!theme name` and legacy `skinparam theme name`.
 */
export const applyThemeToCode = (code: string, themeValue: string): string => {
  const lines = code.split('\n');
  
  // Regex to find existing theme declarations
  // Matches "!theme <name>" or "skinparam theme <name>"
  // We ignore leading whitespace
  const themeRegex = /^\s*(!theme|skinparam\s+theme)\s+([\w-]+)/i;
  
  const existingThemeIndex = lines.findIndex(line => themeRegex.test(line));
  
  if (themeValue === '') {
    // If switching to default, remove the theme line if it exists
    if (existingThemeIndex !== -1) {
      lines.splice(existingThemeIndex, 1);
    }
    return lines.join('\n');
  }

  // Use skinparam theme for better compatibility/completeness preference
  const newThemeLine = `skinparam theme ${themeValue}`;

  if (existingThemeIndex !== -1) {
    // Replace existing theme
    lines[existingThemeIndex] = newThemeLine;
  } else {
    // Insert new theme after the first @start... tag
    const startTagIndex = lines.findIndex(line => line.trim().startsWith('@start'));
    if (startTagIndex !== -1) {
      lines.splice(startTagIndex + 1, 0, newThemeLine);
    } else {
      // Fallback: prepend if no start tag (unlikely for valid code)
      lines.unshift(newThemeLine);
    }
  }

  return lines.join('\n');
};

/**
 * Detects the current theme from the code.
 */
export const detectTheme = (code: string): string => {
    const match = code.match(/^\s*(?:!theme|skinparam\s+theme)\s+([\w-]+)/m);
    return match ? match[1] : '';
};
