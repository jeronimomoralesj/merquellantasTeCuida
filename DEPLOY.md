# Merque Bienestar — Deployment Guide (Windows Server)

## Prerequisites

1. **Windows Server** with:
   - Node.js 20+ installed ([download](https://nodejs.org))
   - SQL Server installed and running
   - Port 3000 open (or your chosen port)

2. **Azure AD App Registration** (you already have one):
   - Add redirect URI: `http://YOUR-SERVER-IP:3000/api/auth/callback/microsoft-entra-id`
   - Under Authentication → enable "ID tokens"
   - Under API Permissions → add `User.Read`, `openid`, `profile`, `email`
   - Under API Permissions → add `Files.ReadWrite.All` (for OneDrive)

---

## Step 1: Set Up the Database

Open SQL Server Management Studio and run:

```sql
-- Run the schema file
database/schema.sql
```

---

## Step 2: Migrate Data from Firebase

Only needed once, while Firebase is still running:

```powershell
# Set environment variables
$env:FIREBASE_ADMIN_KEY = '{"project_id":"...","client_email":"...","private_key":"..."}'
$env:DB_SERVER = "localhost"
$env:DB_NAME = "MerqueBienestar"
$env:DB_USER = "sa"
$env:DB_PASSWORD = "your-password"

# Run migration
npx tsx database/migrate-from-firebase.ts
```

---

## Step 3: Configure Environment

Copy `.env.example` to `.env.local` and fill in all values:

```powershell
copy .env.example .env.local
notepad .env.local
```

Key values:
- `NEXTAUTH_SECRET`: Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `NEXTAUTH_URL`: `http://YOUR-SERVER-IP:3000`
- `DB_*`: Your SQL Server credentials
- `AZURE_*`: Your existing Azure app registration values

---

## Step 4: Build and Start

```powershell
# Install dependencies
npm install --legacy-peer-deps

# Build the production bundle
npm run build

# Start the server
npm run start
```

The app will be available at `http://YOUR-SERVER-IP:3000`

---

## Step 5: Run as a Windows Service (optional but recommended)

Install [NSSM](https://nssm.cc/) to run as a service:

```powershell
# Download nssm and extract to a folder in PATH

# Install the service
nssm install MerqueBienestar "C:\Program Files\nodejs\node.exe"
nssm set MerqueBienestar AppDirectory "C:\path\to\merque-bienestar"
nssm set MerqueBienestar AppParameters "node_modules\.bin\next start"
nssm set MerqueBienestar AppEnvironmentExtra "NODE_ENV=production"

# Start the service
nssm start MerqueBienestar
```

The service will:
- Start automatically on boot
- Restart if it crashes
- Run in the background

---

## Step 6: Update Users' Emails

Since we moved from `{cedula}@merque.com` to real Microsoft emails:

1. Update the `users` table with real `@merquellantas.com` emails
2. Users can now log in with their Microsoft account

```sql
-- Example: update a user's email
UPDATE users SET email = 'juan.perez@merquellantas.com' WHERE cedula = '1023456789';
```

Or re-import from Excel using the admin panel (the create-from-excel endpoint now requires real emails).

---

## Architecture Overview

```
[Browser] → [Next.js on Windows Server :3000]
                ↓                    ↓
         [SQL Server]      [Microsoft Graph API]
                              ↓           ↓
                        [Azure AD]   [OneDrive]
```

- **Auth**: Microsoft SSO via Azure AD (next-auth)
- **Database**: SQL Server (via mssql package)
- **File Storage**: OneDrive via Microsoft Graph API
- **Email**: Gmail via Nodemailer (unchanged)
- **AI Chat**: Google Gemini (unchanged)
