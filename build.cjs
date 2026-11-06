/* Combines src/ into the single Taskmaster.html people open. Run: node build.cjs */
const fs = require('node:fs'), path = require('node:path');
const src = f => path.join(__dirname, 'src', f);
const read = f => fs.readFileSync(src(f), 'utf8');

const fontFaces = [300, 400, 500, 600, 700].flatMap(w => [
  ['latin', 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212,U+2215,U+FEFF,U+FFFD'],
  ['latin-ext', 'U+0100-02AF,U+1E00-1EFF,U+20A0-20AB,U+20AD-20CF,U+2C60-2C7F,U+A720-A7FF'],
].map(([subset, range]) => {
  const b64 = fs.readFileSync(src(`fonts/poppins-${subset}-${w}.woff2`)).toString('base64');
  return `@font-face{font-family:Poppins;font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:${range}}`;
})).join('\n');

const scripts = ['core.js', 'storage.js', 'ui-fx.js', 'ui-app.js', 'ui-board.js', 'ui-select.js', 'ui-areas.js', 'ui-views.js', 'ui-calendar.js', 'ui-time.js', 'ui-notes.js', 'ui-clients.js', 'ui-setup.js'].map(read).join('\n');
if (/<\/script/i.test(scripts)) throw new Error('A script contains a closing script tag, which would break the page.');

const icon = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 65 65"><path fill="#3DD79D" d="M32.8,23.3h-9.5v30.9c0,6,4.8,10.8,10.8,10.8h10.7V35.2C44.8,28.6,39.4,23.3,32.8,23.3z"/><path fill="#3DD79D" d="M35.2,41.7h9.5V10.8C44.8,4.8,39.9,0,34,0H23.3v29.8C23.3,36.4,28.6,41.7,35.2,41.7z"/><path fill="#00B570" d="M44.8,29.8V12.2c0,0-2.7,8-9.5,8H10.8C4.8,20.2,0,25.1,0,31v10.7h33.2C39.8,41.7,44.8,36.4,44.8,29.8z"/></svg>');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Taskmaster 1.0</title>
<link rel="icon" href="${icon}">
<style>
${fontFaces}
${read('styles.css')}
</style>
</head>
<body>
<div id="root"></div>
<div id="modalRoot"></div>
<noscript>Taskmaster needs JavaScript to run.</noscript>
<script>
${scripts}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'Taskmaster.html'), html);
console.log(`Built Taskmaster.html (${Math.round(html.length / 1024)} KB)`);
