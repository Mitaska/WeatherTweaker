// Build script: generates weatherTweaker.extension.json from JS + CSS
// Run: node build.js

const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, 'weatherTweaker.js');

const css =
  '.mt-row{display:flex;align-items:center;gap:6px;padding:2px 0}' +
  '.mt-lbl{flex:0 0 66px;font-size:0.6875rem;color:var(--marinara-chat-chrome-panel-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.mt-rng{flex:1;min-width:0;appearance:none;-webkit-appearance:none;height:4px;border-radius:2px;background:var(--marinara-chat-chrome-input-border);cursor:pointer;outline:none;margin:6px 0}' +
  '.mt-rng::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:12px;height:12px;border-radius:50%;background:var(--primary);border:none;cursor:pointer}' +
  '.mt-rng::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--primary);border:none;cursor:pointer}' +
  '.mt-rng::-moz-range-track{height:4px;border-radius:2px;background:transparent}' +
  '.mt-rng:disabled{opacity:.4;cursor:not-allowed}' +
  '.mt-rng:focus-visible{box-shadow:0 0 0 2px var(--marinara-chat-chrome-focus-ring)}' +
  '.mt-val{flex:0 0 30px;text-align:right;font-size:0.625rem;font-variant-numeric:tabular-nums;color:var(--marinara-chat-chrome-panel-muted);overflow:hidden}' +
  '.mt-clr{width:24px;height:20px;padding:0;border:1px solid var(--marinara-chat-chrome-input-border);border-radius:3px;cursor:pointer;background:none;flex-shrink:0}' +
  '.mt-clr:disabled{opacity:.4;cursor:not-allowed}' +
  '.mt-sel{flex:1;height:22px;font-size:0.6875rem;border:1px solid var(--marinara-chat-chrome-input-border);border-radius:0.5rem;background:var(--marinara-chat-chrome-panel-bg);color:var(--marinara-chat-chrome-panel-text);cursor:pointer;padding:0 6px}' +
  '.mt-sel:disabled{opacity:.4;cursor:not-allowed}' +
  '.mt-sel:focus{outline:none;border-color:var(--marinara-chat-chrome-input-border-focus);box-shadow:0 0 0 2px var(--marinara-chat-chrome-focus-ring)}' +
  '.mt-tabs{display:flex;gap:2px;margin:0 -12px;padding:0 12px;border-bottom:1px solid var(--marinara-chat-chrome-panel-divider)}' +
  '.mt-tab{display:flex;align-items:center;gap:4px;font-size:0.6875rem;color:var(--marinara-chat-chrome-panel-muted);padding:6px 9px;cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;transition:color .15s}' +
  '.mt-tab:hover{color:var(--marinara-chat-chrome-panel-text)}' +
  '.mt-tab--on{color:var(--marinara-chat-chrome-panel-text);border-bottom-color:var(--primary)}' +
  '.mt-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px 0 4px}' +
  '.mt-tile{height:34px;border-radius:8px;border:1px solid var(--marinara-chat-chrome-button-border);background:var(--marinara-chat-chrome-button-bg);cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;transition:border-color .15s,background .15s}' +
  '.mt-tile:hover{border-color:var(--marinara-chat-chrome-button-border-hover);background:var(--marinara-chat-chrome-button-bg-hover)}' +
  '.mt-tile--on{border-color:var(--marinara-chat-chrome-button-border-active);background:var(--marinara-chat-chrome-button-bg-active)}' +
  '.mt-tile>span{font-size:0.5625rem;font-weight:600;letter-spacing:.03em;color:var(--marinara-chat-chrome-panel-muted)}' +
  '.mt-tile--on>span{color:var(--marinara-chat-chrome-button-text-active)}' +
  '.mt-name{font-size:0.6875rem;color:var(--primary);padding:0 0 4px;min-height:16px}' +
  '.mt-card{background:var(--marinara-chat-chrome-button-bg);border:1px solid var(--marinara-chat-chrome-panel-divider);border-radius:10px;padding:6px 10px 8px;margin:2px 0 6px}' +
  '.mt-card-title{font-size:0.6875rem;font-weight:600;color:var(--marinara-chat-chrome-panel-muted);padding:2px 0 4px}' +
  '.mt-sec{font-size:0.6875rem;font-weight:600;color:var(--marinara-chat-chrome-panel-muted);padding:7px 0 3px}' +
  '.mt-sw{appearance:none;-webkit-appearance:none;width:30px;height:17px;border-radius:99px;background:var(--marinara-chat-chrome-input-border);position:relative;cursor:pointer;flex-shrink:0;margin:0;transition:background .15s}' +
  '.mt-sw:checked{background:var(--primary)}' +
  '.mt-sw::before{content:"";position:absolute;left:2px;top:2px;width:13px;height:13px;border-radius:50%;background:#fff;transition:transform .15s}' +
  '.mt-sw:checked::before{transform:translateX(13px)}' +
  '.mt-seg{display:flex;gap:2px;flex:1;background:var(--marinara-chat-chrome-button-bg);border:1px solid var(--marinara-chat-chrome-input-border);border-radius:8px;padding:2px}' +
  '.mt-seg>button{flex:1;font-size:0.6875rem;color:var(--marinara-chat-chrome-panel-muted);padding:3px 0;border:none;background:none;border-radius:6px;cursor:pointer;transition:background .15s,color .15s}' +
  '.mt-seg>button:hover{color:var(--marinara-chat-chrome-panel-text)}' +
  '.mt-seg>button.mt-seg--on{background:var(--primary);color:#fff}' +
  '.mt-foot{display:flex;align-items:center;gap:8px;margin:4px -12px 0;padding:8px 12px 10px;border-top:1px solid var(--marinara-chat-chrome-panel-divider)}' +
  '.mt-foot label{display:flex;align-items:center;gap:6px;flex:1;cursor:pointer;font-size:0.6875rem;color:var(--marinara-chat-chrome-panel-muted)}' +
  '.mt-badge{font-size:0.625rem;color:var(--marinara-chat-chrome-panel-muted);border:1px solid var(--marinara-chat-chrome-input-border);border-radius:99px;padding:1px 7px;white-space:nowrap;font-variant-numeric:tabular-nums;flex-shrink:0}' +
  '.mt-rst{padding:4px 12px;border:1px solid var(--marinara-chat-chrome-input-border);background:none;color:var(--marinara-chat-chrome-panel-text);border-radius:0.5rem;font-size:0.6875rem;cursor:pointer;transition:background .15s}' +
  '.mt-rst:hover{background:var(--marinara-chat-chrome-button-bg-hover)}' +
  '.mt-rst:active{opacity:.7}' +
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
