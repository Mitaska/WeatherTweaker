// Build script: generates weatherTweaker.extension.json from JS + CSS
// Run: node build.js

const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'weatherTweaker.js');

const css =
  '.mt-row{display:flex;align-items:center;gap:6px;padding:2px 0}' +
  '.mt-lbl{flex:0 0 66px;font-size:0.6875rem;color:var(--marinara-chat-chrome-panel-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.mt-rng{flex:1;min-width:0;height:4px;cursor:pointer;accent-color:var(--primary)}' +
  '.mt-val{flex:0 0 30px;text-align:right;font-size:0.625rem;font-variant-numeric:tabular-nums;color:var(--marinara-chat-chrome-panel-muted);overflow:hidden}' +
  '.mt-clr{width:24px;height:20px;padding:0;border:1px solid var(--marinara-chat-chrome-input-border);border-radius:3px;cursor:pointer;background:none;flex-shrink:0}' +
  '.mt-clr:disabled{opacity:.4;cursor:not-allowed}' +
  '.mt-sel{flex:1;height:22px;font-size:0.6875rem;border:1px solid var(--marinara-chat-chrome-input-border);border-radius:0.5rem;background:var(--marinara-chat-chrome-panel-bg);color:var(--marinara-chat-chrome-panel-text);cursor:pointer;padding:0 6px}' +
  '.mt-sel:disabled{opacity:.4;cursor:not-allowed}' +
  '.mt-sel:focus{outline:none;border-color:var(--marinara-chat-chrome-input-border-focus);box-shadow:0 0 0 2px var(--marinara-chat-chrome-focus-ring)}' +
  '.mt-rst{display:block;width:calc(100% - 24px);margin:4px 12px 6px;padding:4px 0;cursor:pointer;background:var(--primary);color:#fff;border:none;border-radius:0.5rem;font-size:0.6875rem;transition:opacity .15s}' +
  '.mt-rst:hover{opacity:.85}' +
  '.mt-rst:active{opacity:.65}' +
  '.mt-aurora-hdr{display:flex;align-items:center;gap:6px;padding:5px 0 2px}' +
  '.mt-aurora-hdr>span{font-size:0.6875rem;font-weight:600;color:var(--marinara-chat-chrome-panel-muted)}' +
  '.mt-help{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:1px solid var(--marinara-chat-chrome-input-border);color:var(--marinara-chat-chrome-panel-muted);font-size:0.625rem;cursor:help;flex-shrink:0}' +
  '.mt-divider{border-top:1px solid var(--marinara-chat-chrome-panel-divider)}' +
  '#weathertweaker-tint{position:absolute;inset:0;pointer-events:none;z-index:1;mix-blend-mode:overlay;transition:background .3s}';

// Safe minifier: removes comments and collapses whitespace.
// Avoids regex that could corrupt string literals.
function minifyJS(code) {
  code = code.replace(/^[ \t]*\/\/.*$/gm, '');           // full-line comments
  code = code.replace(/; *\/\/[^\n"']*$/gm, ';');         // end-of-line comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, '');           // block comments
  code = code.replace(/\n{3,}/g, '\n\n');                  // collapse blank lines
  code = code.split('\n').map(function(l) { return l.trim(); }).join('\n');
  code = code.replace(/\n\n+/g, '\n');                      // remove empty lines
  code = code.replace(/\n/g, ' ');                          // remove newlines
  code = code.replace(/ {2,}/g, ' ');                       // collapse spaces
  code = code.replace(/; /g, ';');                          // spaces after semicolons
  return code.trim();
}

const js = fs.readFileSync(jsPath, 'utf8');
const minJS = minifyJS(js);

try {
  new Function(minJS);
} catch (e) {
  console.error('ERROR: Minified JS is invalid!');
  console.error(e.message);
  process.exit(1);
}

const extension = {
  kind: 'marinara.extension',
  version: 1,
  config: {
    name: 'WeatherTweaker',
    description: 'Tweak weather effects intensity & appearance via a popup in the chat toolbar. Adjust opacity, speed, size, particle count, brightness, contrast, and color tint in real-time.',
    enabled: true,
    css: css,
    js: minJS,
  },
};

const json = JSON.stringify(extension, null, 2);
const outPath = path.join(__dirname, 'weatherTweaker.extension.json');
fs.writeFileSync(outPath, json, 'utf8');

console.log('OK: ' + path.basename(outPath));
console.log('  JS: ' + minJS.length + ' bytes (was ' + js.length + ', ratio ' + (100 * minJS.length / js.length).toFixed(0) + '%)');
console.log('  CSS: ' + css.length + ' bytes');
