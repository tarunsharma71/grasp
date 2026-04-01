import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const repository = process.env.STAR_HISTORY_REPO || process.env.GITHUB_REPOSITORY || 'Yuzc-001/grasp';
const [owner, repo] = repository.split('/');

if (!owner || !repo) {
  throw new Error(`Invalid repository name: ${repository}`);
}

const outputPath = new URL('../star-history.svg', import.meta.url);
const token = process.env.GITHUB_TOKEN;

async function main() {
  const starredAtValues = await fetchStargazers();
  const series = buildSeries(starredAtValues);
  const svg = buildSvg(series);

  await writeFile(outputPath, svg, 'utf8');
  console.log(`Updated ${fileURLToPath(outputPath)} with ${series.at(-1)?.count ?? 0} stars`);
}

async function fetchStargazers() {
  try {
    return await fetchStargazersWithToken(token);
  } catch (error) {
    if (token && error?.status === 401) {
      console.warn('GITHUB_TOKEN is invalid locally, retrying without authentication');
      return fetchStargazersWithToken();
    }

    throw error;
  }
}

async function fetchStargazersWithToken(authToken) {
  const headers = {
    Accept: 'application/vnd.github.v3.star+json',
    'User-Agent': 'grasp-star-history-updater',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const starredAtValues = [];

  for (let page = 1; ; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
      { headers },
    );

    if (!response.ok) {
      const body = await response.text();
      const error = new Error(
        `GitHub API request failed on page ${page}: ${response.status} ${response.statusText}\n${body}`,
      );
      error.status = response.status;
      throw error;
    }

    const entries = await response.json();

    if (!Array.isArray(entries) || entries.length === 0) {
      break;
    }

    for (const entry of entries) {
      if (entry?.starred_at) {
        starredAtValues.push(entry.starred_at);
      }
    }

    if (entries.length < 100) {
      break;
    }
  }

  return starredAtValues.sort((left, right) => Date.parse(left) - Date.parse(right));
}

function buildSeries(starredAtValues) {
  const today = toUtcDay(new Date());

  if (starredAtValues.length === 0) {
    return [{ date: today, count: 0 }];
  }

  const dailyAdds = new Map();

  for (const value of starredAtValues) {
    const day = toUtcDay(value);
    dailyAdds.set(day, (dailyAdds.get(day) || 0) + 1);
  }

  const startDay = [...dailyAdds.keys()].sort()[0];
  const series = [];
  let running = 0;

  for (
    let cursor = new Date(`${startDay}T00:00:00Z`);
    cursor <= new Date(`${today}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const day = toUtcDay(cursor);
    running += dailyAdds.get(day) || 0;
    series.push({ date: day, count: running });
  }

  return series;
}

function buildSvg(series) {
  const width = 960;
  const height = 540;
  const padding = { top: 76, right: 34, bottom: 52, left: 76 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const lastPoint = series.at(-1);
  const updatedDay = toUtcDay(new Date());
  const xDivisor = Math.max(series.length - 1, 1);
  const { ceiling, ticks } = buildYTicks(lastPoint.count);

  const scaleX = (index) => padding.left + (plotWidth * index) / xDivisor;
  const scaleY = (value) => padding.top + plotHeight - (plotHeight * value) / ceiling;

  const points = series.map((point, index) => ({
    x: Number(scaleX(index).toFixed(2)),
    y: Number(scaleY(point.count).toFixed(2)),
    date: point.date,
    count: point.count,
  }));

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaPoints = [
    `${padding.left},${padding.top + plotHeight}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${padding.left + plotWidth},${padding.top + plotHeight}`,
  ].join(' ');

  const xTickIndices = buildTickIndices(series.length, 5);
  const yGrid = ticks
    .map((tick) => {
      const y = scaleY(tick);
      return [
        `<line x1="${padding.left}" y1="${y}" x2="${padding.left + plotWidth}" y2="${y}" stroke="#D7E3F4" stroke-width="1" />`,
        `<text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="#48617D">${formatNumber(tick)}</text>`,
      ].join('');
    })
    .join('');

  const xLabels = xTickIndices
    .map((index) => {
      const point = points[index];
      return [
        `<line x1="${point.x}" y1="${padding.top + plotHeight}" x2="${point.x}" y2="${padding.top + plotHeight + 6}" stroke="#B6C8DE" stroke-width="1" />`,
        `<text x="${point.x}" y="${padding.top + plotHeight + 24}" text-anchor="middle" font-size="12" fill="#48617D">${escapeXml(formatDate(point.date))}</text>`,
      ].join('');
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(repository)} star history</title>
  <desc id="desc">${escapeXml(`Cumulative GitHub stars for ${repository} from ${series[0].date} to ${lastPoint.date}.`)}</desc>
  <defs>
    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.28" />
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.04" />
    </linearGradient>
    <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0EA5E9" />
      <stop offset="100%" stop-color="#2563EB" />
    </linearGradient>
  </defs>

  <rect x="0" y="0" width="${width}" height="${height}" rx="22" fill="#F8FBFF" />
  <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="20.5" fill="none" stroke="#D7E3F4" stroke-width="3" />

  <text x="${padding.left}" y="42" font-size="26" font-weight="700" fill="#0F172A">Star History</text>
  <text x="${padding.left}" y="64" font-size="13" fill="#48617D">${escapeXml(repository)}</text>
  <text x="${width - padding.right}" y="42" text-anchor="end" font-size="24" font-weight="700" fill="#0F172A">${formatNumber(lastPoint.count)}</text>
  <text x="${width - padding.right}" y="64" text-anchor="end" font-size="13" fill="#48617D">Updated ${escapeXml(updatedDay)} UTC</text>

  ${yGrid}
  <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${padding.left + plotWidth}" y2="${padding.top + plotHeight}" stroke="#94AFCB" stroke-width="1.5" />
  ${xLabels}

  <polygon points="${areaPoints}" fill="url(#areaFill)" />
  <polyline points="${polylinePoints}" fill="none" stroke="url(#lineStroke)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
  <circle cx="${points.at(-1).x}" cy="${points.at(-1).y}" r="6.5" fill="#2563EB" />
  <circle cx="${points.at(-1).x}" cy="${points.at(-1).y}" r="11" fill="#2563EB" fill-opacity="0.16" />
</svg>
`;
}

function buildYTicks(maxValue) {
  const step = niceStep(Math.max(maxValue, 1) / 4);
  const ceiling = Math.max(step, Math.ceil(Math.max(maxValue, 1) / step) * step);
  const ticks = [];

  for (let value = 0; value <= ceiling; value += step) {
    ticks.push(value);
  }

  return { ceiling, ticks };
}

function buildTickIndices(length, desiredCount) {
  if (length === 1) {
    return [0];
  }

  const count = Math.min(length, desiredCount);
  const indices = new Set();

  for (let index = 0; index < count; index += 1) {
    indices.add(Math.round(((length - 1) * index) / (count - 1)));
  }

  return [...indices].sort((left, right) => left - right);
}

function niceStep(target) {
  const safeTarget = Math.max(target, 1);
  const power = 10 ** Math.floor(Math.log10(safeTarget));
  const scaled = safeTarget / power;

  if (scaled <= 1) {
    return power;
  }

  if (scaled <= 2) {
    return 2 * power;
  }

  if (scaled <= 5) {
    return 5 * power;
  }

  return 10 * power;
}

function formatDate(day) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`));
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function toUtcDay(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
