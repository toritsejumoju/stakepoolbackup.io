# StakePool247 SAAS - Technical Architecture & Infrastructure Documentation

## 🌐 Domain & Service Architecture

### Production Environment
```
📱 Frontend:    app.stakepool247.io          → React App (Google Cloud Run)
🔌 API:         api.stakepool247.io:4000     → Node.js API (SSL/HTTPS)
🤖 Bot:         Stakepool247_Bot             → Telegram Bot Service
📊 Scripts:     Background Services          → PM2 Managed Processes
```

### Development Environment
```
📱 Frontend:    dev.stakepool247.io          → Development React Build
🔌 API:         testnet-api.stakepool247.io:4000  → Development API
🤖 Bot:         Stakepool247_Dev_Bot         → Development Telegram Bot
```

## 🏗️ Infrastructure & Deployment

### Google Cloud Platform (GCP) Deployment

**Frontend (stakepool247-io)**
- **Platform:** Google Cloud Run (Containerized)
- **Build:** Cloud Build with Docker
- **Process:**
  1. `yarn install` → Install dependencies
  2. `yarn build` → Create production build
  3. Docker containerization
  4. Deploy to Cloud Run with auto-scaling

**API Server (stakepool247-io-web-api)**
- **Platform:** VPS/Dedicated Server
- **SSL:** Let's Encrypt (`/etc/letsencrypt/live/api.stakepool247.io/`)
- **Environment:** Node.js with Express
- **Port:** 4000 (HTTPS in production)

**Background Services (stakepool247-scripts)**
- **Process Manager:** PM2 Ecosystem
- **Services:**
  - `json-loader` → Pool data processing
  - `status-manager` → Pool status monitoring
- **Scheduling:** Cron-based automation

**Telegram Bot (stakepool247-bot-temp)**
- **Runtime:** Standalone Node.js process
- **Queue Processing:** Bull queues with Redis backend

## 🔐 Authentication & Authorization Architecture

### Multi-Layer Authentication System

#### 1. Firebase Authentication (Web Users)
```javascript
// Frontend: Automatic token injection
req.headers["Authorization"] = `Bearer ${await currentUser.getIdToken()}`;

// Backend: Token verification
getAuth().verifyIdToken(token)
  .then((decodedToken) => {
    req.uid = decodedToken.uid
    req.isAdmin = decodedToken.admin
  })
```

#### 2. JWT Authentication (Pool Operators/Devices)
```javascript
// Device/Pool authentication for block uploads
jose.jwtVerify(token, JWT_KEY).then(({payload}) => {
  req.pool = payload.pool
  req.device = payload.device
})
```

#### 3. Telegram Bot Authentication
```javascript
// User lookup via Telegram ID
const userDocs = await getFirestore()
  .collection("users")
  .where("telegramData.id", "==", ctx.from.id)
  .get();
```

### Authentication Middleware Chain
- `parseFirebaseAuthToken` → Extract & verify Firebase tokens
- `requireAuth` → Ensure authenticated user
- `requireAdmin` → Admin-only access
- `requireJWTAuth` → Device/pool operator access

## 📡 API Architecture & Endpoints

### Core API Structure (`api.stakepool247.io:4000`)

#### User Management
```
GET    /users              → List all users (admin)
POST   /users              → Create new user
GET    /users/me           → Get current user profile
PUT    /users/me           → Update user profile
DELETE /users/me/telegramData → Unlink Telegram account
```

#### Pool Management
```
GET    /pools                    → List user pools
GET    /pools/accessInfo         → Get pool access information
PUT    /pools/accessInfo/:poolId → Update pool access
GET    /pools/:poolId            → Get pool details
PUT    /pools/:poolId/owner      → Transfer pool ownership
PUT    /pools/:poolId/read-access → Grant read access
DELETE /pools/:poolId/read-access → Revoke read access
```

#### Pool Registration & Validation
```
GET    /pools/lookup/:poolId    → Lookup pool on blockchain
GET    /pools/validate/:poolId  → Validate pool configuration
```

#### Statistics & Metrics
```
GET    /stats                   → Pool statistics
GET    /metrics                → Performance metrics
```

#### Block Management
```
GET    /blocks/latest          → Latest submitted epoch
GET    /blocks/accepting       → Current accepting epoch
POST   /blocks                → Submit block schedule (JWT auth)
```

#### Epoch Management
```
GET    /pools/epoch/           → Epoch data
POST   /pools/epoch/:epochId/comment/:slotId → Add slot comment
```

#### Alert System
```
GET    /alerts                → Get user alerts
POST   /alerts               → Create alert
PUT    /alerts/:id           → Update alert
DELETE /alerts/:id           → Delete alert
```

#### Telegram Integration
```
GET    /telegram/availableNotifications → Available notification types
GET    /telegram/chats                 → User's Telegram chats
PUT    /telegram/chats                → Configure chat notifications
DELETE /telegram/chats/:id            → Remove chat configuration
```

#### Device Management
```
GET    /devices               → List user devices
POST   /devices              → Register new device
PUT    /devices/:id          → Update device
DELETE /devices/:id          → Remove device
```

#### Utility Endpoints
```
GET    /                     → Health check
POST   /contacts             → Contact form submission
GET    /token                → Token management
```

## 🗄️ Data Architecture & Storage

### Firebase Firestore (Primary Database)

#### Collections Structure
```javascript
// User profiles and authentication
users: {
  [uid]: {
    email: string,
    displayName: string,
    photoUrl?: string,
    telegramData?: {
      id: number,
      username: string,
      first_name: string
    }
  }
}

// Pool configurations
poolData: {
  [poolIdBech32]: {
    ticker: string,
    poolId: string,
    owner: string,           // User UID
    allowRead: string[],     // Array of user UIDs with read access
    status: {
      ticker: boolean,
      poolIdBech32: boolean,
      poolStakeAddress: boolean
    }
  }
}

// Epoch data subcollection
poolData/[poolId]/epochs: {
  [epochNumber]: {
    epoch: number,
    poolId: string,
    poolIdBech32: string,
    activeStake: number,
    totalActiveStake: number,
    assignedSlots: Array<{
      no: number,
      slot: number,
      slotInEpoch: number,
      at: string,
      status: "planned" | "success" | "failed"
    }>
  }
}

// Telegram chat configurations
telegramChats: {
  [chatId]: {
    chatId: number,
    user: string,           // User UID
    name: string,
    type: "private" | "group",
    allPools: boolean,
    notificationTypes: string[]  // ["alert", "new_block", "new_epoch"]
  }
}

// Global status management
globalData/statusManaging: {
  upcomingSlots: {
    [slotNumber]: string    // Reference to epoch document
  },
  missingPoolRewardsPoolEpochs: {
    [poolId_EPOCH_epochNumber]: string  // Reference to epoch document
  }
}
```

### PostgreSQL Database

#### Tables Structure
```sql
-- Performance metrics
CREATE TABLE metrics (
  id SERIAL PRIMARY KEY,
  pool_id VARCHAR(56),
  epoch INTEGER,
  metric_type VARCHAR(50),
  value DECIMAL,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Block production tracking
CREATE TABLE blocks (
  id SERIAL PRIMARY KEY,
  pool_id VARCHAR(56),
  epoch INTEGER,
  slot_number BIGINT,
  block_hash VARCHAR(64),
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Device registrations
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(128),
  device_name VARCHAR(100),
  device_token TEXT,
  pool_id VARCHAR(56),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🔄 Inter-Service Communication

### Queue-Based Messaging (Bull/Redis)

#### Notification Queue Structure
```javascript
// Queue: bot-notifications
{
  "receivers": {
    "users": ["user_uid_1", "user_uid_2"],      // Direct user targeting
    "pools": ["pool_id_1", "pool_id_2"],        // Pool-based targeting
    "chats": [telegram_chat_id_1, chat_id_2]    // Direct chat targeting
  },
  "type": "alert" | "new_block" | "new_epoch" | "epoch_slots_uploaded",
  "data": {
    "message": "Notification message",
    "poolId": "pool_id",
    "status": "success" | "failed",
    "epoch": 450,
    "slot": 98765432,
    "blockUrl": "https://cardanoscan.io/block/...",
    // ... additional context data
  }
}
```

### Data Flow Patterns

#### Block Production Pipeline
```
1. Pool Operator → block_updater.sh → Cardano CLI
2. Script → POST /blocks → API Server (JWT Auth)
3. API → Firebase → Pool epoch data stored
4. Status Manager → Monitors slots → Updates block status
5. Status change → Queue notification → Telegram Bot
6. Bot → Sends formatted message → Telegram users
```

#### User Authentication Flow
```
1. Frontend → Firebase Auth → ID Token generated
2. API calls → Bearer token → Firebase Admin verification
3. Middleware → req.uid populated → Route access granted
4. Telegram Bot → User lookup by telegram ID → Firebase query
```

## 🔧 Configuration Management

### Environment Variables by Service

#### Frontend (stakepool247-io)
```bash
REACT_APP_API_URL=https://api.stakepool247.io:4000/     # API endpoint
REACT_APP_TELEGRAM_BOT=Stakepool247_Bot                 # Bot name for login
```

#### API Server (stakepool247-io-web-api)
```bash
# Server Configuration
PORT=4000
NODE_ENV=production
API_SSL_PATH=/etc/letsencrypt/live/api.stakepool247.io/

# Database
DB_USER=postgres_user
DB_HOST=localhost
DB_PORT=5432
DB_NAME=stakepool247_metrics
DB_PASS=database_password
DB_SSL=false

# External Services
BF_API_KEY=blockfrost_project_id                        # Blockfrost API
JWT_SECRET=jwt_signing_key                              # Device tokens
QUEUE_PREFIX=stakepool247_                              # Redis queue prefix

# Scheduling
ALERTS_CRON=0 */5 * * * *                              # Every 5 minutes
```

#### Background Scripts (stakepool247-scripts)
```bash
# Data Processing
ROOT_DIR_POOL_JSON_LOADER=/path/to/data/processing      # File processing directory
JSON_LOADER_CRON=*/10 * * * *                          # Every 10 minutes
STATUS_MANAGER_CRON=15,45 * * * * *                    # Twice per minute

# Firebase Configuration
SERVICE_ACCOUNT_PRIVATE_KEY_JSON={"type":"service_account"...}
GLOBAL_DATA_COLLECTION_ID=globalData
POOLS_DATA_COLLECTION_ID=poolData
STATUS_MANAGING_COLLECTION_ID=statusManaging
EPOCHS_COLLECTION_ID=epochs

# External APIs
DATA_API_KEY=blockfrost_project_id                      # Cardano data API

# Email Notifications
SERVER_MAIL_HOST=smtp.example.com
SERVER_MAIL_PORT=587
SERVER_MAIL_SECURE=true
SERVER_MAIL_USER=smtp_username
SERVER_MAIL_PASS=smtp_password
SERVER_MAIL_SENDER=noreply@stakepool247.io
MAIL_NOTIF_RECIPIENT=alerts@stakepool247.io

# Queue System
QUEUE_PREFIX=stakepool247_                              # Redis queue prefix
```

#### Telegram Bot (stakepool247-bot-temp)
```bash
BOT_TOKEN=telegram_bot_token                            # Telegram API token
BASE_DOMAIN=https://app.stakepool247.io/                # Frontend URL for links
QUEUE_PREFIX=stakepool247_                              # Redis queue prefix
```

### Network-Specific Configurations

#### Mainnet Configuration
- **Frontend:** `app.stakepool247.io`
- **API:** `api.stakepool247.io:4000`
- **Bot:** `Stakepool247_Bot`
- **Cardano Network:** `--mainnet`
- **Genesis:** `mainnet-shelley-genesis.json`

#### Testnet Configuration
- **Frontend:** `dev.stakepool247.io`
- **API:** `testnet-api.stakepool247.io:4000`
- **Bot:** `Stakepool247_Dev_Bot`
- **Cardano Network:** `--testnet-magic [network_id]`
- **Genesis:** `testnet-shelley-genesis.json`

## 📊 Monitoring & Observability

### Health Checks & Monitoring
- **API Health:** `GET /` returns `{"status": "ok"}`
- **Queue Monitoring:** Bull dashboard for job processing
- **Database Health:** Connection pool monitoring
- **Firebase:** Authentication and data sync monitoring

### Logging Strategy
- **Centralized Logging:** All services log to centralized system
- **Error Tracking:** Application errors with stack traces
- **Performance Metrics:** Response times and throughput
- **Security Events:** Authentication failures and suspicious activity

### Alerting & Notifications
- **System Alerts:** Infrastructure issues and service downtime
- **Pool Alerts:** Block production issues and performance degradation
- **User Notifications:** Custom alerts via Telegram integration

## 🚀 Deployment & Operations

### CI/CD Pipeline
1. **Code Push** → Git repository
2. **Cloud Build** → Automated testing and building
3. **Docker Build** → Containerization (frontend)
4. **Deploy** → Google Cloud Run (frontend) / VPS (backend)

### Scaling Strategy
- **Frontend:** Auto-scaling via Google Cloud Run
- **API:** Horizontal scaling with load balancer
- **Database:** Connection pooling and read replicas
- **Queue Processing:** Multiple worker processes

### Security Measures
- **SSL/TLS:** End-to-end encryption
- **Authentication:** Multi-layer auth system
- **API Rate Limiting:** Prevent abuse
- **Input Validation:** Sanitize all user inputs
- **Secret Management:** Environment variables and key rotation

This technical architecture documentation provides a comprehensive overview of the StakePool247 SAAS platform's infrastructure, API design, authentication flows, and operational considerations.