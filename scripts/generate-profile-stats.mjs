import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const username = process.env.GITHUB_USERNAME ?? "Noootnoot343";
const outputPath = process.env.STATS_OUTPUT_PATH ?? "assets/github-stats.svg";

if (!/^[a-zA-Z0-9-]+$/.test(username)) {
  throw new Error("GITHUB_USERNAME contains unsupported characters");
}

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${username}-profile-stats`,
  ...(process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {}),
};
const [userResponse, repositoriesResponse] = await Promise.all([
  fetch(`https://api.github.com/users/${username}`, { headers }),
  fetch(
    `https://api.github.com/users/${username}/repos?per_page=100&type=owner&sort=updated`,
    { headers },
  ),
]);

if (!userResponse.ok || !repositoriesResponse.ok) {
  throw new Error(
    `GitHub profile request failed: user ${userResponse.status}, repositories ${repositoriesResponse.status}`,
  );
}

const user = await userResponse.json();
const repositories = await repositoriesResponse.json();
const stars = repositories.reduce(
  (total, repository) => total + repository.stargazers_count,
  0,
);
const forks = repositories.reduce(
  (total, repository) => total + repository.forks_count,
  0,
);
const updatedAt = new Date().toISOString().slice(0, 10).replaceAll("-", ".");
const metrics = [
  ["PUBLIC REPOS", user.public_repos],
  ["FOLLOWERS", user.followers],
  ["STARS EARNED", stars],
  ["REPO FORKS", forks],
];
const metricMarkup = metrics
  .map(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 42 + column * 238;
    const y = 76 + row * 58;

    return `  <g transform="translate(${x} ${y})">
    <text class="value" x="0" y="0">${value}</text>
    <text class="label" x="0" y="20">${label}</text>
  </g>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195" role="img" aria-labelledby="title desc">
  <title id="title">${username} GitHub statistics</title>
  <desc id="desc">${user.public_repos} public repositories, ${user.followers} followers, ${stars} stars earned, and ${forks} repository forks.</desc>
  <defs>
    <pattern id="micro-grid" width="12" height="12" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r="0.8" fill="#65daff" opacity="0.08"/>
    </pattern>
  </defs>
  <style>
    text { font-family: Consolas, "Liberation Mono", monospace; }
    .value { fill: #ffffff; font-size: 24px; font-weight: 800; }
    .label { fill: #79cdeb; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
  </style>
  <rect x="0.5" y="0.5" width="494" height="194" rx="10" fill="#061a32" stroke="#1596c8"/>
  <rect x="1" y="1" width="493" height="193" rx="9" fill="url(#micro-grid)"/>
  <path d="M374 1H485Q494 1 494 10V194H448Z" fill="#0a4167" opacity="0.42"/>
  <text x="28" y="34" fill="#65daff" font-size="12" font-weight="800" letter-spacing="2.5">NOOTS / GITHUB STATS</text>
  <path d="M28 48H467" stroke="#1596c8"/>
  <path d="M247.5 62V163" stroke="#1596c8" opacity="0.65"/>
  <path d="M28 111H467" stroke="#1596c8" opacity="0.35"/>
${metricMarkup}
  <text x="28" y="180" fill="#65daff" font-size="9" font-weight="700">AUTO-SYNC / GITHUB PUBLIC PROFILE</text>
  <text x="467" y="180" fill="#79cdeb" font-size="9" text-anchor="end">UPDATED ${updatedAt}</text>
</svg>
`;

await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, svg, "utf8");
console.log(`Generated ${outputPath} for ${username}`);
