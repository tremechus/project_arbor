# Deployment Setup

This repository includes GitHub Actions workflows for automatic deployment of the client application.

## GitHub Pages Deployment (Recommended)

The `deploy.yml` workflow automatically deploys to GitHub Pages when code is pushed to the main branch.

### Setup Steps:

1. **Enable GitHub Pages in your repository:**
   - Go to Settings → Pages
   - Source: "GitHub Actions"
   - Save the settings

2. **The workflow will automatically:**
   - Build the Vite React app
   - Deploy to GitHub Pages
   - Make it available at: `https://yourusername.github.io/project-arbor/`

3. **First deployment:**
   - Push to main branch or merge a PR
   - Check the "Actions" tab to monitor deployment
   - Once complete, visit your GitHub Pages URL

## Alternative: Netlify Deployment

The `deploy-netlify.yml` workflow can deploy to Netlify instead.

### Setup Steps:

1. **Create a Netlify account and site**
2. **Add repository secrets:**
   - Go to Settings → Secrets and variables → Actions
   - Add `NETLIFY_AUTH_TOKEN` (from Netlify account settings)
   - Add `NETLIFY_SITE_ID` (from your Netlify site settings)

3. **Rename the workflow:**
   - Rename `deploy-netlify.yml` to `deploy.yml`
   - Delete or rename the GitHub Pages workflow

## Local Development

The client can still be run locally:

```bash
cd client
npm install
npm run dev
```

## Production Build

To build locally for testing:

```bash
cd client
npm run build
npm run preview
```

## Notes

- The Vite config has been updated to handle GitHub Pages subdirectory paths
- Static assets should be placed in the `client/public/` directory
- Environment variables for production should be set in the workflow or hosting service
