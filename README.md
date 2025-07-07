# Project Arbor

[![Deploy Client to GitHub Pages](https://github.com/tremechus/project_arbor/actions/workflows/deploy.yml/badge.svg)](https://github.com/tremechus/project_arbor/actions/workflows/deploy.yml)

MMO AI experiment with automatic deployment to GitHub Pages.

## 🚀 Live Demo

The client application is automatically deployed to GitHub Pages: **[Play Project Arbor](https://tremechus.github.io/project_arbor/)**

## 📋 Features

- **Phaser.js Game Engine**: Real-time multiplayer game client
- **WebSocket Communication**: Live player interactions and world updates
- **Automatic Deployment**: CI/CD pipeline with GitHub Actions
- **Fauna System**: AI-driven creatures with lifecycle management
- **Sound Effects**: Audio feedback for game events
- **Responsive UI**: Clean, modern interface

## 🛠️ Development

### Client Setup
```bash
cd client
npm install
npm run dev
```

### Server Setup
```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

## 🚀 Deployment

The project uses GitHub Actions for automatic deployment:

- **Trigger**: Every push to the `main` branch
- **Build**: Vite production build of the client
- **Deploy**: Automatic deployment to GitHub Pages
- **Status**: Check the badge above for deployment status

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment documentation.

## 📁 Project Structure

```
project-arbor/
├── client/          # Vite React frontend
├── server/          # Python FastAPI backend  
├── .github/         # GitHub Actions workflows
└── DEPLOYMENT.md    # Deployment documentation
```
