// Server-side feed aggregator for links.john-ellison.com.
// One endpoint, four feeds: /api/feed?type=podcast|video|writings|code
// Everything is fetched here (not in the browser) so the CDN can cache it,
// there are no CORS or third-party RSS-proxy dependencies, and the GitHub
// rate limit is never hit by visitors.

const SOURCES = {
  podcast: {
    rss: 'https://anchor.fm/s/10db3ec88/podcast/rss',
    spotifyShowId: '4uoBTqzAjJnSbSiJVJjiUK',
  },
  youtubeChannelId: 'UCu9vXNUlLwb4Iw4CuG7aHtQ',
  writings: [
    { name: 'Substack', feed: 'https://iamjohnellison.substack.com/feed' },
    { name: 'Regenera', feed: 'https://regenera.substack.com/feed' },
  ],
  github: { user: 'johnellison', orgs: ['aiosbrain'] },
};

const UA = 'Mozilla/5.0 (compatible; links.john-ellison.com feed)';

async function get(url, headers = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, ...headers },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res;
}

const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();

const stripHtml = (s = '') =>
  decode(s)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? m[1] : '';
};
const attr = (xml, name, a) => {
  const m = xml.match(new RegExp(`<${name}\\s[^>]*?${a}="([^"]*)"`));
  return m ? decode(m[1]) : '';
};
const items = (xml, name) => [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1]);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

// ---------- podcast ----------
async function podcast() {
  const xml = await (await get(SOURCES.podcast.rss)).text();
  const channel = xml.split('<item>')[0];
  const show = {
    title: decode(tag(channel, 'title')),
    image: attr(channel, 'itunes:image', 'href'),
    spotifyUrl: `https://open.spotify.com/show/${SOURCES.podcast.spotifyShowId}`,
    appleUrl: 'https://podcasts.apple.com/us/podcast/john-ellison-show/id1868730301',
  };
  const episodes = items(xml, 'item').slice(0, 24).map((it) => ({
    title: decode(tag(it, 'title')),
    url: decode(tag(it, 'link')),
    date: new Date(decode(tag(it, 'pubDate'))).toISOString(),
    duration: decode(tag(it, 'itunes:duration')),
    image: attr(it, 'itunes:image', 'href') || show.image,
    summary: clip(stripHtml(tag(it, 'description')), 260),
    spotifyEpisodeId: null,
  }));

  // The Spotify embed page exposes the newest episode's Spotify ID. Match it by
  // title so the featured card can deep-link and embed the real episode.
  try {
    const html = await (await get(`https://open.spotify.com/embed/show/${SOURCES.podcast.spotifyShowId}`)).text();
    const data = JSON.parse(html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]);
    const entity = data.props.pageProps.state.data.entity;
    const id = String(entity.uri || '').split(':')[2];
    const match = episodes.find((e) => e.title === entity.title || e.title === entity.name);
    if (id && match) match.spotifyEpisodeId = id;
  } catch {
    /* best effort: cards fall back to the episode page */
  }
  return { show, episodes };
}

// ---------- youtube ----------
async function video() {
  const xml = await (await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${SOURCES.youtubeChannelId}`)).text();
  const videos = items(xml, 'entry').map((e) => {
    const id = decode(tag(e, 'yt:videoId'));
    return {
      id,
      title: decode(tag(e, 'title')),
      url: `https://www.youtube.com/watch?v=${id}`,
      date: decode(tag(e, 'published')),
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      views: Number(attr(e, 'media:statistics', 'views')) || null,
    };
  });
  return { videos: videos.slice(0, 30) };
}

// ---------- writings ----------
async function writings() {
  const results = await Promise.allSettled(
    SOURCES.writings.map(async (src) => {
      const xml = await (await get(src.feed)).text();
      return items(xml, 'item').map((it) => ({
        source: src.name,
        title: decode(tag(it, 'title')),
        url: decode(tag(it, 'link')),
        date: new Date(decode(tag(it, 'pubDate'))).toISOString(),
        image: attr(it, 'enclosure', 'url') || null,
        excerpt: clip(stripHtml(tag(it, 'description')), 220),
      }));
    }),
  );
  const posts = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!posts.length && results.every((r) => r.status === 'rejected')) throw new Error('all writing feeds failed');
  return { posts: posts.slice(0, 30), sources: SOURCES.writings.map((s) => s.name) };
}

// ---------- code ----------
async function code() {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const { user, orgs } = SOURCES.github;
  const urls = [
    `https://api.github.com/users/${user}/repos?type=owner&sort=pushed&per_page=100`,
    ...orgs.map((o) => `https://api.github.com/orgs/${o}/repos?type=public&sort=pushed&per_page=100`),
  ];
  const results = await Promise.allSettled(urls.map(async (u) => (await get(u, headers)).json()));
  if (results.every((r) => r.status === 'rejected')) throw new Error('github unavailable');
  const repos = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((r) => !r.fork && !r.archived && !r.private)
    .map((r) => ({
      name: r.name,
      owner: r.owner.login,
      url: r.html_url,
      description: r.description || '',
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      pushedAt: r.pushed_at,
    }))
    .sort((a, b) => new Date(b.pushedAt) - new Date(a.pushedAt));
  return { repos: repos.slice(0, 36), total: repos.length };
}

const HANDLERS = { podcast, video, writings, code };

module.exports = async function handler(req, res) {
  const type = String((req.query && req.query.type) || '');
  const fn = HANDLERS[type];
  if (!fn) {
    res.status(400).json({ error: 'unknown type', valid: Object.keys(HANDLERS) });
    return;
  }
  try {
    const data = await fn();
    // 15 min fresh, then serve stale for a day while revalidating in the background.
    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    res.setHeader('Cache-Control', 's-maxage=30');
    res.status(502).json({ error: String(err.message || err) });
  }
};

module.exports._internals = { decode, stripHtml, tag, attr, items };
