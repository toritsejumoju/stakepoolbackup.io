# 🏊‍♂️ StakePool247 SAAS Platform

> **Comprehensive Cardano staking pool monitoring and management platform**

[![Deploy to Firebase Hosting](https://github.com/stakepool247/stakepool247-saas/actions/workflows/firebase-hosting-merge.yml/badge.svg)](https://github.com/stakepool247/stakepool247-saas/actions/workflows/firebase-hosting-merge.yml)
[![Firebase Hosting](https://img.shields.io/badge/Frontend-Firebase%20Hosting-orange)](https://stakepool247-app.web.app)
[![API Status](https://img.shields.io/badge/API-api--v2.stakepool247.io-blue)](https://api-v2.stakepool247.io)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-17-blue)](https://reactjs.org)
[![Firebase](https://img.shields.io/badge/Database-Firebase%20v2-yellow)](https://firebase.google.com)
[![License](https://img.shields.io/badge/License-Private-red)](./LICENSE)
[![Cardano](https://img.shields.io/badge/Blockchain-Cardano-blue)](https://cardano.org)

## 🌟 Overview

StakePool247 is a comprehensive SAAS platform designed for Cardano stake pool operators, providing real-time monitoring, alerting, statistics, and automated notifications. The platform consists of 4 integrated components working together to deliver a complete pool management solution.

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   🌐 Frontend   │    │   🔧 Backend    │    │   📊 Scripts    │
│                 │    │                 │    │                 │
│ React 17        │◄──►│ Node.js + API   │◄──►│ Background      │
│ Firebase Host   │    │ PostgreSQL      │    │ Processing      │
│ Auto-Deploy     │    │ SSL + nginx     │    │ PM2 Ecosystem   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   🤖 Telegram   │
                    │                 │
                    │ Bot + Queues    │
                    │ Notifications   │
                    └─────────────────┘
```

## 🚀 Live Application

- **🌐 Frontend:** https://stakepool247-app.web.app
- **🔗 Custom Domain:** portal.stakepool247.io *(configurable)*
- **📡 API Endpoint:** https://api-v2.stakepool247.io
- **🔄 Auto-Deploy:** Every push to main branch

## 📦 Repository Structure

### 🌐 [`stakepool247-io`](./stakepool247-io/) - Frontend Web App
- **Tech:** React 17 + TailwindCSS + Firebase Auth
- **Hosting:** Firebase Hosting with GitHub Actions CI/CD
- **Features:** Dashboard, pool management, alerts, admin panel
- **Database:** Firebase Firestore `stakepool247-v2`

### 🔧 [`stakepool247-io-web-api`](./stakepool247-io-web-api/) - Backend API
- **Tech:** Node.js + Express + PostgreSQL + Firebase Admin
- **Hosting:** Custom server with SSL (api-v2.stakepool247.io)
- **Features:** REST API, authentication, Cardano blockchain integration
- **Database:** PostgreSQL + Firebase Firestore `stakepool247-v2`

### 📊 [`stakepool247-scripts`](./stakepool247-scripts/) - Background Services
- **Tech:** Node.js background processes + PM2
- **Purpose:** Automated data processing and pool monitoring
- **Features:** JSON loader, status manager, epoch processing
- **Schedule:** Configurable cron jobs (default: every 10 minutes)

### 🤖 [`stakepool247-bot-temp`](./stakepool247-bot-temp/) - Telegram Bot
- **Tech:** Node.js + Telegraf + Bull Queues
- **Purpose:** Telegram notifications and user interactions
- **Features:** Real-time alerts, pool status updates, epoch notifications
- **Integration:** Redis queues for message processing

## ⚡ Quick Start

### Prerequisites
- Node.js 20+ *(required for Firebase CLI)*
- PostgreSQL database
- Redis server
- Firebase project with Admin SDK
- Telegram bot token
- Blockfrost API key

### 🚀 Development Setup
```bash
# Clone the repository
git clone https://github.com/stakepool247/stakepool247-saas.git
cd stakepool247-saas

# Install dependencies for each component
cd stakepool247-io && npm install && cd ..
cd stakepool247-io-web-api && npm install && cd ..
cd stakepool247-scripts && npm install && cd ..
cd stakepool247-bot-temp && npm install && cd ..

# Configure environment variables (see individual README files)

# Start development services
cd stakepool247-io && npm start &          # Frontend (localhost:3000)
cd stakepool247-io-web-api && npm start &  # API (localhost:4000)
cd stakepool247-bot-temp && npm start &    # Telegram Bot
```

### 🏗️ Production Deployment

#### Frontend (Automatic)
The frontend automatically deploys to Firebase Hosting:
```bash
git push origin main  # Triggers GitHub Actions → Build → Deploy
```

#### Backend & Services
```bash
# API Server (with PM2)
cd stakepool247-io-web-api
npm run start:prod

# Background Scripts
cd stakepool247-scripts
pm2 start ecosystem.config.js

# Telegram Bot
cd stakepool247-bot-temp
npm run start:prod
```

## 🔧 Key Features

### 📊 **Real-time Monitoring**
- Live pool statistics and performance metrics
- Block production tracking and analysis
- Epoch data processing and visualization
- Custom dashboards with @nivo charts

### 🔔 **Smart Alerting**
- Custom alert configurations and triggers
- Telegram notifications for critical events
- Email notifications for pool status changes
- Real-time status updates and health checks

### 👥 **User Management**
- Firebase Authentication + Telegram login
- Multi-pool management per user
- Role-based access control (Admin/User)
- Device registration for monitoring

### 🔌 **Blockchain Integration**
- Blockfrost API integration for Cardano data
- Automatic pool data synchronization
- Slot assignment tracking and validation
- Bech32 pool ID conversion and management

## 🚀 CI/CD Pipeline

### GitHub Actions Workflows
- **`firebase-hosting-merge.yml`** - Auto-deploy to production on main branch
- **`firebase-hosting-pull-request.yml`** - Preview deployments for PRs

### Deployment Flow
```
Code Push → GitHub Actions → Build (Node.js 20) → Test → Deploy → Live
```

## 🗄️ Database Architecture

### Firebase Firestore (`stakepool247-v2`)
- **users** - User profiles and authentication data
- **poolData** - Pool configuration and metadata
- **telegramChats** - Telegram chat configurations
- **alerts** - User-defined alert configurations

### PostgreSQL
- **metrics** - Performance and statistics data
- **blocks** - Block production tracking
- **devices** - Monitoring device registration

## 📈 Multi-Network Support

The platform is designed to support:
- **Cardano Mainnet** - Primary network
- **Cardano Testnets** - Development and testing
- **Cardano Clones** - Networks like Apex Fusion
- **Unified Frontend** - Single interface for all networks

## 🔗 External Integrations

- **Blockfrost API** - Cardano blockchain data
- **Firebase Services** - Auth, Firestore, Hosting
- **Telegram Bot API** - Notifications and interactions
- **PM2 Ecosystem** - Process management
- **nginx + SSL** - Reverse proxy and security

## 📚 Documentation

- **[Complete Architecture Guide](./CLAUDE.md)** - Detailed technical documentation
- **[PM2 Configuration Guide](./PM2-CONFIGURATION.md)** - Deployment and server setup
- **[Frontend README](./stakepool247-io/README.md)** - React app specific docs

## 🛠️ Development Workflow

1. **Feature Development** - Create feature branch from main
2. **Testing** - Test across all components locally
3. **Pull Request** - Automated preview deployment
4. **Code Review** - Team review and approval
5. **Merge to Main** - Automatic production deployment
6. **Monitoring** - Track deployment and performance

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is part of the StakePool247 ecosystem. See individual component licenses for details.

## 🆘 Support

- **Documentation:** [Technical Architecture](./CLAUDE.md)
- **Issues:** [GitHub Issues](https://github.com/stakepool247/stakepool247-saas/issues)
- **Telegram:** Contact through the platform

---

**🏊‍♂️ Built for Cardano pool operators, by pool operators.**