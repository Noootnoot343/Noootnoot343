import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const username = process.env.GITHUB_USERNAME ?? "Noootnoot343";
const outputPath = process.env.OUTPUT_PATH ?? "assets/contribution-graph.svg";

if (!/^[a-zA-Z0-9-]+$/.test(username)) {
  throw new Error("GITHUB_USERNAME contains unsupported characters");
}

const response = await fetch(`https://github.com/users/${username}/contributions`, {
  headers: {
    Accept: "text/html",
    "User-Agent": `${username}-profile-contribution-graph`,
  },
});

if (!response.ok) {
  throw new Error(`GitHub contribution request failed: ${response.status}`);
}

const html = await response.text();
const totalMatch = html.match(
  /id="js-contribution-activity-description"[^>]*>\s*([\d,]+)\s*contributions/s,
);
const cellPattern =
  /<td\b[^>]*data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="([0-4])"[^>]*><\/td>/g;
const daysByDate = new Map();

for (const match of html.matchAll(cellPattern)) {
  daysByDate.set(match[1], Number(match[2]));
}

const days = [...daysByDate]
  .map(([date, level]) => ({ date, level }))
  .sort((a, b) => a.date.localeCompare(b.date));

if (!totalMatch || days.length < 350) {
  throw new Error("GitHub contribution markup was not recognized");
}

const total = Number(totalMatch[1].replaceAll(",", ""));
const firstDate = new Date(`${days[0].date}T00:00:00Z`);
const cellSize = 9;
const pitch = 12;
const gridX = 94;
const gridY = 96;
const colors = ["#0a2035", "#0b4e75", "#087aa5", "#18a9d4", "#65daff"];
const monthNames = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const cells = days
  .map(({ date, level }) => {
    const value = new Date(`${date}T00:00:00Z`);
    const week = Math.floor((value - firstDate) / 604_800_000);
    const weekday = value.getUTCDay();
    const x = gridX + week * pitch;
    const y = gridY + weekday * pitch;

    return `    <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${colors[level]}"><title>${date}: activity level ${level}</title></rect>`;
  })
  .join("\n");

const seenMonths = new Set();
const monthPositions = days
  .map(({ date }) => {
    const value = new Date(`${date}T00:00:00Z`);
    const key = `${value.getUTCFullYear()}-${value.getUTCMonth()}`;

    if (seenMonths.has(key)) return "";
    seenMonths.add(key);

    const week = Math.floor((value - firstDate) / 604_800_000);
    return { label: monthNames[value.getUTCMonth()], week };
  })
  .filter(Boolean);

if (monthPositions[1]?.week - monthPositions[0]?.week < 3) {
  monthPositions.shift();
}

const monthLabels = monthPositions
  .map(({ label, week }) => {
    const x = gridX + week * pitch;
    return `    <text x="${x}" y="84" class="month">${label}</text>`;
  })
  .join("\n");

const range = `${days[0].date.replaceAll("-", ".")} - ${days.at(-1).date.replaceAll("-", ".")}`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="230" viewBox="0 0 900 230" role="img" aria-labelledby="title desc">
  <title id="title">${username} contribution signal</title>
  <desc id="desc">${total} GitHub contributions from ${days[0].date} through ${days.at(-1).date}</desc>
  <defs>
    <pattern id="micro-grid" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#65daff" opacity="0.08"/>
    </pattern>
    <linearGradient id="scan" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#65daff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#65daff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#65daff" stop-opacity="0"/>
    </linearGradient>
    <clipPath id="grid-clip"><rect x="88" y="89" width="650" height="96"/></clipPath>
  </defs>
  <style>
    text { font-family: Consolas, "Liberation Mono", monospace; }
    .month { fill: #79cdeb; font-size: 10px; font-weight: 700; }
    .label { fill: #9de8ff; font-size: 10px; }
  </style>

  <path d="M14 1H886V8H894V222H886V229H14V222H6V8H14Z" fill="#06172c" stroke="#1596c8" stroke-width="2"/>
  <path d="M7 8H17V222H7Z" fill="#39c6f4"/>
  <path d="M742 1H886V8H894V222H850Z" fill="#0a4167" opacity="0.42"/>
  <rect x="18" y="9" width="874" height="212" fill="url(#micro-grid)"/>

  <text x="44" y="37" fill="#65daff" font-size="13" font-weight="800" letter-spacing="3">NOOTS / ACTIVITY SIGNAL</text>
  <text x="44" y="57" fill="#d8f5ff" font-size="12">$ git activity --last-year</text>
  <text x="856" y="38" fill="#ffffff" font-size="26" font-weight="800" text-anchor="end">${total}</text>
  <text x="856" y="56" fill="#79cdeb" font-size="10" font-weight="700" text-anchor="end">CONTRIBUTIONS</text>
  <path d="M44 68H856" stroke="#1596c8" stroke-width="2"/>
  <path d="M44 63V73M856 63V73" stroke="#ffffff" stroke-width="2"/>

${monthLabels}
  <text x="57" y="116" class="label">MON</text>
  <text x="57" y="140" class="label">WED</text>
  <text x="57" y="164" class="label">FRI</text>
  <g shape-rendering="crispEdges">
${cells}
  </g>

  <g clip-path="url(#grid-clip)">
    <rect x="76" y="89" width="34" height="96" fill="url(#scan)">
      <animate attributeName="x" values="76;738;76" dur="8s" repeatCount="indefinite"/>
    </rect>
  </g>

  <path d="M44 190H856" stroke="#0b4e75"/>
  <text x="44" y="211" fill="#65daff" font-size="10" font-weight="700">AUTO-SYNC / GITHUB PUBLIC ACTIVITY</text>
  <text x="450" y="211" fill="#79cdeb" font-size="10" text-anchor="middle">${range}</text>
  <text x="685" y="211" fill="#79cdeb" font-size="10">LOW</text>
  <g shape-rendering="crispEdges">
    <rect x="715" y="202" width="9" height="9" fill="${colors[0]}"/>
    <rect x="729" y="202" width="9" height="9" fill="${colors[1]}"/>
    <rect x="743" y="202" width="9" height="9" fill="${colors[2]}"/>
    <rect x="757" y="202" width="9" height="9" fill="${colors[3]}"/>
    <rect x="771" y="202" width="9" height="9" fill="${colors[4]}"/>
  </g>
  <text x="790" y="211" fill="#79cdeb" font-size="10">HIGH</text>
  <rect x="842" y="202" width="8" height="8" fill="#65daff">
    <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.48;0.5;1" dur="1.2s" repeatCount="indefinite"/>
  </rect>
</svg>
`;

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, svg, "utf8");
console.log(`Generated ${outputPath} with ${total} contributions across ${days.length} days`);
