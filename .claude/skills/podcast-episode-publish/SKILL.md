---
name: podcast-episode-publish
description: Given a source audio file (m4a/wav/etc.) and the blog post it belongs to, transcode it to a podcast-ready MP3, upload it to the droplet's podcast-audio directory, and wire it into the post and the /podcast.xml feed. Use when the user provides a new episode's audio file and names (or clearly implies) which Insights/blog post it's the narration for.
allowed-tools: Bash, Read, Edit
---

# Publish a podcast episode — dioramaconsulting.co.uk

Turns a source audio file into a live, subscribable podcast episode attached to a
specific blog post. This is the recipe used for `seeking-solis` and the other
NotebookLM-narrated posts, and for `the-ai-world-cup-may-have-no-single-winner`
(a non-NotebookLM source, same pipeline).

## Before starting

Confirm two things with the user if either is unclear from context — guessing wrong
here means audio gets attached to the wrong post:
1. **Which blog post** this episode belongs to (its slug under `src/content/blog/`).
2. **Where the source audio file is** (commonly dropped in `AudioFiles/` at the repo
   root, which is git-ignored — see `.gitignore`). Confirm it exists before proceeding.

Also confirm `droplet_key`/`droplet_key.pub` exist in the repo root (git-ignored) —
see `.claude/skills/docker-status/SKILL.md` for connection details (host
`188.166.171.220`, user `deploy`). If missing, stop and ask the user rather than
attempting to recreate them.

## 1. Transcode to MP3

Standard recipe for every episode so far — 96kbps mono, 24kHz. Spoken-word
podcast audio doesn't need more than this, and it keeps file sizes small
(roughly 1MB per minute):

```bash
mkdir -p AudioFiles/mp3
ffmpeg -y -v error -i "AudioFiles/<source-file>" \
  -ac 1 -ar 24000 -codec:a libmp3lame -b:a 96k \
  "AudioFiles/mp3/<post-slug>.mp3"
```

Output filename **must** match the post's slug exactly (e.g. `seeking-solis.mp3`) —
this is the naming convention the whole pipeline (frontmatter, Caddy route,
`AUDIO_BYTES` map) assumes.

Verify the duration matches the source exactly (catches truncation):

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "AudioFiles/<source-file>"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 "AudioFiles/mp3/<post-slug>.mp3"
```

## 2. Upload to the droplet

The directory is already `deploy`-owned from one-time setup — no sudo needed for
routine uploads:

```bash
rsync -avz --progress -e "ssh -i droplet_key" \
  "AudioFiles/mp3/<post-slug>.mp3" \
  deploy@188.166.171.220:/var/www/podcast-audio/
```

Verify it's actually reachable before wiring it in:

```bash
curl -sI "https://dioramaconsulting.co.uk/podcast-audio/<post-slug>.mp3" | grep -iE "^HTTP|content-type|content-length|accept-ranges"
```

Expect `200`, `content-type: audio/mpeg`, `accept-ranges: bytes`, and a
`content-length` matching the local file's byte size exactly.

## 3. Wire it into the post

Add (or update) two frontmatter fields in `src/content/blog/<post-slug>/index.mdx`,
right after `heroImage`/`heroImageUrl` if present, otherwise near the top:

```yaml
audioUrl: 'https://dioramaconsulting.co.uk/podcast-audio/<post-slug>.mp3'
audioTitle: 'Listen: <Post Title>'
```

This is an existing, already-typed schema field (`src/content.config.ts`) — no
schema changes needed. It also automatically surfaces the pinned audio player in
`BlogPost.astro` with zero UI changes.

## 4. Add the episode to the podcast feed's byte-size map

`src/pages/podcast.xml.js` hardcodes each enclosure's exact byte length in
`AUDIO_BYTES` (the audio lives outside the repo/build, so there's no local file to
`stat()` at build time — see the comment above that map in the file). Get the exact
size and add an entry keyed by the post's slug:

```bash
wc -c < "AudioFiles/mp3/<post-slug>.mp3"
```

```js
const AUDIO_BYTES = {
  // ...existing entries...
  '<post-slug>': <byte-count>,
};
```

## 5. Verify locally before shipping

```bash
pkill -f "astro dev" 2>/dev/null; sleep 1
nohup npm run dev > /tmp/astro-dev.log 2>&1 &
sleep 6
curl -s "http://localhost:4321/insights/<post-slug>/" | grep -o '<audio[^>]*src="[^"]*"'
curl -s http://localhost:4321/podcast.xml | grep -B2 "<post-slug>" | grep -E "title>|enclosure"
pkill -f "astro dev" 2>/dev/null
```

Confirm the `<audio>` tag's `src` and the feed's `<enclosure>` both point at the
right URL, and the enclosure `length` matches the uploaded file's byte size.

## 6. Commit, log in CHANGES.md, and push

Follow this repo's usual conventions (see `CLAUDE.md`):

- Commit the frontmatter change + `podcast.xml.js` change together.
- Add a dated entry to `CHANGES.md` under a `## \`<hash>\`` heading (commit first,
  then amend the entry in with the real hash — see existing entries for the
  pattern).
- Before pushing, `git fetch origin` and check `git log --oneline HEAD..origin/main`
  — Keystatic content edits land on `main` independently and often, since editors
  can save through `/keystatic` at any time. If new commits are there, check
  `git show --stat <hash>` for each; if they don't touch files this skill changed,
  a plain `git merge origin/main --no-edit` is safe. If they touch the *same* blog
  post's frontmatter, resolve by keeping Keystatic's content/reformatting and
  re-inserting the `audioUrl`/`audioTitle` lines at the same position (this has
  happened before — see `CHANGES.md`'s `0067423` entry for a worked example).
- Push, then watch the deploy:

```bash
git push origin main
gh run list --branch main --limit 1 --json databaseId,status,conclusion,headSha
gh run watch <databaseId> --exit-status
```

## 7. Verify live

```bash
curl -s "https://dioramaconsulting.co.uk/insights/<post-slug>/" | grep -o '<audio[^>]*src="[^"]*"'
curl -s https://dioramaconsulting.co.uk/podcast.xml | grep -B2 "<post-slug>" | grep "enclosure"
```

Report back what changed (episode title, file size, feed episode count) — don't
just say "done," confirm the actual production response.
