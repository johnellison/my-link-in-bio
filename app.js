import { initPrismWaves } from '/assets/prism-waves.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const SPOTIFY_SHOW = 'https://open.spotify.com/show/4uoBTqzAjJnSbSiJVJjiUK';
const URLS = {
    github: 'https://github.com/johnellison',
    youtube: 'https://www.youtube.com/@iamjohnellison',
    substack: 'https://iamjohnellison.substack.com/',
    regenera: 'https://iamregenera.substack.com/',
};
const PAGE = 6; // items revealed per "See more"

const SUBSTACK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/></svg>';

const LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', HTML: '#e34c26', CSS: '#563d7c',
    Rust: '#dea584', Go: '#00ADD8', Shell: '#89e051', Svelte: '#ff3e00', Swift: '#ffac45', Vue: '#41b883',
    Astro: '#ff5a03', Java: '#b07219', Ruby: '#701516', PHP: '#4F5D95',
};

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function timeAgo(iso) {
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    const units = [['y', 31536000], ['mo', 2592000], ['w', 604800], ['d', 86400], ['h', 3600], ['m', 60]];
    for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)}${u} ago`;
    return 'Just now';
}

function fmtDuration(d) {
    if (!d) return '';
    const p = d.split(':').map(Number);
    if (p.length === 3) return p[0] ? `${p[0]}h ${p[1]}m` : `${p[1]} min`;
    if (p.length === 2) return `${p[0]} min`;
    return '';
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const feeds = {};
function getFeed(type) {
    feeds[type] ||= fetch(`/api/feed?type=${type}`).then((r) => {
        if (!r.ok) throw new Error(`feed ${type}: ${r.status}`);
        return r.json();
    });
    // a failed request must not be cached forever
    feeds[type].catch(() => delete feeds[type]);
    return feeds[type];
}

/** Paginated list with a "See more" button. Renders `pageSize` at a time. */
function paginate({ listEl, moreEl, items, render, pageSize = PAGE, allUrl, allLabel }) {
    let shown = 0;
    const draw = () => {
        const next = items.slice(shown, shown + pageSize);
        listEl.insertAdjacentHTML('beforeend', next.map(render).join(''));
        shown += next.length;
        if (shown < items.length) {
            moreEl.innerHTML = `<button class="more-btn" type="button">See more <i class="fa-solid fa-chevron-down"></i></button>`;
            $('button', moreEl).addEventListener('click', draw);
        } else if (allUrl) {
            moreEl.innerHTML = `<a class="more-btn" href="${allUrl}" target="_blank" rel="noopener">${allLabel} <i class="fa-solid fa-arrow-right"></i></a>`;
        } else {
            moreEl.innerHTML = '';
        }
    };
    listEl.innerHTML = '';
    draw();
}

const failMsg = (el, text, href, label) => {
    el.innerHTML = `<div class="empty">${text} <a href="${href}" target="_blank" rel="noopener">${label}</a></div>`;
};

// ---------- tabs ----------
const tabBtns = $$('.tab-btn');
const loaders = {};
const loaded = new Set();

function showTab(name, { updateHash = true } = {}) {
    if (!$(`#tab-${name}`)) name = 'links';
    tabBtns.forEach((b) => {
        const on = b.dataset.tab === name;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on);
    });
    $$('.tab-content').forEach((c) => c.classList.toggle('active', c.id === `tab-${name}`));
    if (updateHash) history.replaceState(null, '', name === 'links' ? location.pathname : `#${name}`);
    if (loaders[name] && !loaded.has(name)) {
        loaded.add(name);
        loaders[name]().catch((e) => { console.error(e); loaded.delete(name); });
    }
}
tabBtns.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---------- podcast: featured banner + show tab ----------
let episodeVideoMatch = null; // YouTube URL of the latest episode, if one is published

async function loadFeatured() {
    const el = $('#featured-episode');
    try {
        const { show, episodes } = await getFeed('podcast');
        const ep = episodes[0];
        if (!ep) throw new Error('no episodes');
        const spotifyUrl = ep.spotifyEpisodeId ? `https://open.spotify.com/episode/${ep.spotifyEpisodeId}` : ep.url;
        const fresh = Date.now() - new Date(ep.date) < 7 * 864e5;
        const watch = await findVideoFor(ep);
        el.innerHTML = `
            <div class="featured-bg" style="background-image:url('${esc(ep.image)}')"></div>
            <div class="featured-inner">
                <a class="featured-art" href="${esc(spotifyUrl)}" target="_blank" rel="noopener" aria-label="Play ${esc(ep.title)}">
                    <img src="${esc(ep.image)}" alt="" width="132" height="132">
                </a>
                <div class="featured-body">
                    <span class="eyebrow">${fresh ? '<span class="pulse"></span>' : ''}${fresh ? 'New episode' : 'Latest episode'}</span>
                    <h2 class="featured-title">${esc(ep.title)}</h2>
                    <span class="featured-meta">${esc(show.title)} &middot; ${timeAgo(ep.date)}${ep.duration ? ' &middot; ' + fmtDuration(ep.duration) : ''}</span>
                    <div class="featured-actions">
                        <a class="btn btn-spotify" href="${esc(spotifyUrl)}" target="_blank" rel="noopener"><i class="fa-brands fa-spotify"></i> Listen</a>
                        ${watch ? `<a class="btn btn-ghost" href="${esc(watch)}" target="_blank" rel="noopener"><i class="fa-brands fa-youtube"></i> Watch</a>` : ''}
                    </div>
                </div>
            </div>`;
    } catch (e) {
        console.error(e);
        el.innerHTML = `<a class="featured glass" style="display:block;padding:1.1rem;border-radius:1.25rem" href="${SPOTIFY_SHOW}" target="_blank" rel="noopener"><span class="eyebrow">The John Ellison Show</span><h2 class="featured-title">Listen on Spotify</h2></a>`;
    }
}

async function findVideoFor(ep) {
    try {
        const { videos } = await getFeed('video');
        const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const v = videos.find((x) => norm(x.title) === norm(ep.title));
        episodeVideoMatch = v ? v.url : null;
        return episodeVideoMatch;
    } catch { return null; }
}

loaders.show = async () => {
    const head = $('#show-header');
    try {
        const { show, episodes } = await getFeed('podcast');
        head.innerHTML = `
            <div class="show-head glass">
                <img class="show-art" src="${esc(show.image)}" alt="" width="96" height="96">
                <div>
                    <h2 class="show-name">${esc(show.title)}</h2>
                    <p class="show-tagline">Startups, AI, regeneration and indigenous wisdom. New episodes on Tuesdays.</p>
                    <div class="show-platforms">
                        <a class="btn btn-spotify" href="${esc(show.spotifyUrl)}" target="_blank" rel="noopener"><i class="fa-brands fa-spotify"></i> Spotify</a>
                        <a class="btn btn-ghost" href="${esc(show.appleUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-podcast"></i> Apple</a>
                        <a class="btn btn-ghost" href="${URLS.youtube}" target="_blank" rel="noopener"><i class="fa-brands fa-youtube"></i> YouTube</a>
                    </div>
                </div>
            </div>`;
        const latest = episodes[0];
        const player = $('#show-player');
        if (latest && latest.spotifyEpisodeId) {
            player.innerHTML = `<div class="embed"><iframe src="https://open.spotify.com/embed/episode/${esc(latest.spotifyEpisodeId)}?theme=0" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" title="Spotify player: ${esc(latest.title)}"></iframe></div>`;
        }
        const rest = episodes.slice(latest && latest.spotifyEpisodeId ? 1 : 0);
        paginate({
            listEl: $('#show-episodes'),
            moreEl: $('#show-more'),
            items: rest,
            render: (e) => `
                <a class="media-card" href="${esc(e.url)}" target="_blank" rel="noopener">
                    <img class="media-thumb" src="${esc(e.image)}" alt="" loading="lazy">
                    <span class="media-body">
                        <span class="media-title">${esc(e.title)}</span>
                        <span class="media-meta">${fmtDate(e.date)}${e.duration ? ' &middot; ' + fmtDuration(e.duration) : ''}</span>
                    </span>
                    <i class="fa-brands fa-spotify media-icon"></i>
                </a>`,
            allUrl: show.spotifyUrl,
            allLabel: 'All episodes on Spotify',
        });
        if (!rest.length) $('#show-episodes').innerHTML = '';
    } catch (e) {
        console.error(e);
        failMsg(head, 'Could not load episodes right now.', SPOTIFY_SHOW, 'Open on Spotify');
    }
};

// ---------- code ----------
loaders.code = async () => {
    const list = $('#code-list');
    try {
        const { repos } = await getFeed('code');
        if (!repos.length) throw new Error('no repos');
        paginate({
            listEl: list,
            moreEl: $('#code-more'),
            items: repos,
            allUrl: URLS.github,
            allLabel: 'View all on GitHub',
            render: (r) => {
                const dot = LANG_COLORS[r.language] || '#8b949e';
                const isAios = r.owner === 'aiosbrain';
                return `
                <a class="repo-card" href="${esc(r.url)}" target="_blank" rel="noopener">
                    <div class="repo-head">
                        <span class="repo-owner-icon">${isAios ? '<img src="/assets/aios-mark.svg" alt="AIOS">' : '<i class="fa-brands fa-github"></i>'}</span>
                        <span class="repo-name">${isAios ? `<small>${esc(r.owner)}/</small>` : ''}${esc(r.name)}</span>
                        <span class="repo-date">${timeAgo(r.pushedAt)}</span>
                    </div>
                    ${r.description ? `<div class="repo-desc">${esc(r.description)}</div>` : ''}
                    <div class="repo-meta">
                        ${r.language ? `<span><i class="lang-dot" style="background:${dot}"></i>${esc(r.language)}</span>` : ''}
                        ${r.stars ? `<span><i class="fa-solid fa-star"></i>${r.stars}</span>` : ''}
                        ${r.forks ? `<span><i class="fa-solid fa-code-branch"></i>${r.forks}</span>` : ''}
                    </div>
                </a>`;
            },
        });
    } catch (e) {
        console.error(e);
        failMsg(list, 'GitHub is not responding.', URLS.github, 'See my repos on GitHub');
    }
};

// ---------- writing ----------
loaders.writing = async () => {
    const list = $('#writing-list');
    const more = $('#writing-more');
    try {
        const { posts } = await getFeed('writings');
        const render = (p) => {
            const regenera = p.source === 'Regenera';
            return `
            <a class="post-card" href="${esc(p.url)}" target="_blank" rel="noopener">
                ${p.image ? `<div class="post-img" style="background-image:url('${esc(p.image)}')" role="img" aria-label=""></div>` : ''}
                <div class="post-body">
                    <div class="post-meta">
                        <span class="badge ${regenera ? 'regenera' : 'substack'}">${regenera ? '<i class="fa-solid fa-seedling"></i>' : SUBSTACK_SVG}${esc(p.source)}</span>
                        <span>${fmtDate(p.date)}</span>
                    </div>
                    <div class="post-title">${esc(p.title)}</div>
                    ${p.excerpt ? `<div class="post-excerpt">${esc(p.excerpt)}</div>` : ''}
                </div>
            </a>`;
        };
        const draw = (source) => {
            const items = source === 'all' ? posts : posts.filter((p) => p.source === source);
            if (!items.length) {
                more.innerHTML = '';
                const url = source === 'Regenera' ? URLS.regenera : URLS.substack;
                failMsg(list, `Nothing published on ${esc(source)} yet.`, url, `Visit ${esc(source)}`);
                return;
            }
            paginate({ listEl: list, moreEl: more, items, render, allUrl: source === 'Regenera' ? URLS.regenera : URLS.substack, allLabel: source === 'Regenera' ? 'Read more on Regenera' : 'Read more on Substack' });
        };
        $$('#writing-chips .chip').forEach((chip) => chip.addEventListener('click', () => {
            $$('#writing-chips .chip').forEach((c) => c.classList.toggle('active', c === chip));
            draw(chip.dataset.source);
        }));
        draw('all');
    } catch (e) {
        console.error(e);
        failMsg(list, 'Could not load writing right now.', URLS.substack, 'Read on Substack');
    }
};

// ---------- video ----------
loaders.video = async () => {
    const list = $('#video-list');
    const more = $('#video-more');
    try {
        const { videos } = await getFeed('video');
        if (!videos.length) throw new Error('no videos');
        let index = 0;
        paginate({
            listEl: list,
            moreEl: more,
            items: videos,
            pageSize: 6,
            allUrl: URLS.youtube,
            allLabel: 'More on YouTube',
            render: (v) => {
                const first = index++ === 0;
                return `
                <a class="video-card${first ? ' first' : ''}" href="${esc(v.url)}" target="_blank" rel="noopener">
                    <div class="video-thumb">
                        <img src="${esc(v.thumbnail)}" alt="" loading="lazy">
                        <div class="play"><span><i class="fa-solid fa-play"></i></span></div>
                    </div>
                    <div class="video-info">
                        <div class="video-title">${esc(v.title)}</div>
                        <div class="video-meta">${timeAgo(v.date)}${v.views ? ' &middot; ' + v.views.toLocaleString('en-US') + ' views' : ''}</div>
                    </div>
                </a>`;
            },
        });
    } catch (e) {
        console.error(e);
        failMsg(list, 'Could not load videos right now.', URLS.youtube, 'Watch on YouTube');
    }
};

// ---------- email signup ----------
const form = $('#email-signup-form');
const msg = $('#form-message');
form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = $('.signup-btn', form);
    const label = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Subscribing...';
    btn.disabled = true;
    msg.className = 'form-message';
    try {
        const res = await fetch(form.action, { method: form.method, body: new FormData(form), headers: { Accept: 'application/json' } });
        if (res.ok) {
            msg.textContent = 'Thanks for signing up! Check your inbox to confirm.';
            msg.className = 'form-message success';
            form.reset();
        } else {
            const data = await res.json().catch(() => ({}));
            msg.textContent = data.errors ? data.errors.map((e) => e.message).join(', ') : 'Oops! There was a problem submitting your form';
            msg.className = 'form-message error';
        }
    } catch {
        msg.textContent = 'Oops! There was a problem submitting your form';
        msg.className = 'form-message error';
    } finally {
        btn.innerHTML = label;
        btn.disabled = false;
    }
});

// ---------- boot ----------
$('#year').textContent = new Date().getFullYear();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) initPrismWaves($('#bg-waves'));
loadFeatured();
showTab(location.hash.slice(1) || 'links', { updateHash: false });
