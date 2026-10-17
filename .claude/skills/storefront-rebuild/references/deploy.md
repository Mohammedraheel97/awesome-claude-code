# Deploying the static site

Deploy only when the user asks, and redeploy only on request — a deploy publishes the site.

## Vercel through the MCP tools (no CLI token needed)

Push the site to a GitHub branch first, then:

1. `list_teams` → pick the team id (ask if there are several).
2. `create_deployment` with a git source and project settings that point at the site folder:

```json
{ "teamId": "team_…", "skipAutoDetectionConfirmation": "1",
  "requestBody": { "name": "<project>", "project": "<project>", "target": "production",
    "gitSource": { "type": "github", "org": "<owner>", "repo": "<repo>", "ref": "<branch>", "sha": "<pushed sha>" },
    "projectSettings": { "framework": null, "rootDirectory": "<site-folder>", "buildCommand": null,
      "installCommand": null, "outputDirectory": null } } }
```

3. `get_deployment` until `readyState` is `READY`; the alias `<project>.vercel.app` is the public URL.
4. Verify: `curl` key pages (expect 200), an unknown path (expect the custom 404), a path without the trailing
   slash (expect 308), `/tools/build.py` (expect 404 thanks to `.vercelignore`), and run `smoke_test.js` against
   the live URL.

Redeploy = the same `create_deployment` call with the new pushed sha (project settings are remembered).

Why not `create_git_project`: it links the repo so every push redeploys. If the repo's default branch doesn't contain
the site (e.g. the site lives on a feature branch of an unrelated repo), every unrelated commit would trigger a
failing build. Link the repo only when the site is on the production branch.

Inline-file deploys (`files` with base64) suit a handful of small files only — not hundreds of images.

## Other hosts

The site is plain files: Netlify (drag & drop the folder), GitHub Pages, Cloudflare Pages or any static host. Keep
`trailingSlash` behaviour (directories with `index.html`) and serve `404.html` for unknown paths.

## Custom domain

Offer it, don't do it unasked: `add_project_domain` on Vercel, then the user changes DNS at their registrar.
Rebuild with `--site-url https://<domain>` so canonical/OG URLs and the sitemap use the real domain.
