# links.john-ellison.com

John Ellison's link-in-bio. Static HTML/CSS/JS plus one Vercel serverless function.

- `index.html`, `style.css`, `app.js`: the page (Prism design system from john-ellison.com)
- `api/feed.js`: server-side feeds, cached at the CDN for 15 minutes
  - `?type=podcast`: John Ellison Show RSS, with the latest episode's Spotify ID resolved from the Spotify embed
  - `?type=video`: YouTube channel feed
  - `?type=writings`: Substack (iamjohnellison) + Regenera
  - `?type=code`: public non-fork repos from `johnellison` and the `aiosbrain` org, newest push first
- Optional env var `GITHUB_TOKEN` raises the GitHub API rate limit.

Nothing needs updating by hand: new episodes, videos, posts and repos appear on their own.
