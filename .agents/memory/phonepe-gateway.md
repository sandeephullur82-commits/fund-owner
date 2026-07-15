---
name: PhonePe Multi-Tenant Payment Gateway
description: Architecture and key decisions for the PhonePe PG integration added to FundCircle
---

# PhonePe Multi-Tenant Payment Gateway

## Collections
- `orgPhonePeConfig/{orgId}` — AES-256-CBC encrypted credentials (server-only; Firestore rules deny all client access)
- `phonePeOrders/{merchantTransactionId}` — payment order tracking; org agents/owners can read for realtime status updates

## Encryption
Key derived from `SESSION_SECRET` via SHA-256 in `server/phonepe.ts`.
`encryptField()` / `decryptField()` use AES-256-CBC with random IV prepended as hex: `iv_hex:encrypted_hex`.

## Server Routes (server/index.ts + server/phonepe.ts)
- `POST /api/phonepe/save-config` — owner-only; encrypts+stores, updates `organizations` doc with phonePeConfigured/phonePeEnvironment/phonePeMerchantIdHint
- `POST /api/phonepe/delete-config` — owner-only; marks deleted, clears org doc flags
- `POST /api/phonepe/validate` — owner-only; tests credentials by calling PhonePe status API with dummy txn ID
- `POST /api/phonepe/create-order` — authenticated member; creates UPI_QR order, stores in phonePeOrders
- `POST /api/phonepe/check-status` — authenticated member; polls PhonePe status API, updates phonePeOrders
- `POST /api/phonepe/webhook` — no auth; verifies HMAC-SHA256 signature; updates phonePeOrders status

## Frontend Flow
- `phonePeConfigured` = `organizations/{orgId}.phonePeConfigured` (loaded via useDocumentRealtime in CollectDialog)
- `phonePeMode` state defaults true; "Use Static UPI" sets it false
- `PhonePeQRPanel` (`components/agent/PhonePeQRPanel.tsx`): creates order on mount, shows QR, Firestore realtime listener
- On PhonePe SUCCESS: sets `phonePeTxnRefOverride.current` then calls `executeEMICollection()`
- PhonePe settings at `src/pages/organization/PhonePeSettings.tsx` (owner-only credential form)

## Why phonePeTxnRefOverride ref
`executeEMICollection` is a useCallback whose closure captures `upiTxnRef` state. Setting state and calling the callback synchronously gives stale state. A ref bypasses this — line 293 reads `(phonePeTxnRefOverride.current || upiTxnRef).trim()`.

## PhonePe API
- Sandbox: `https://api-preprod.phonepe.com/apis/pg-sandbox`
- Production: `https://api.phonepe.com/apis/hermes`
- X-VERIFY: `sha256(base64Payload + endpoint + saltKey) + "###" + saltIndex`
- UPI_QR returns `intentUrl` (UPI deep link) → QR generated via qrserver.com

## Firestore Writes From Server
Server uses `VITE_FIREBASE_API_KEY` (unauthenticated REST calls). This works only while deployed Firestore rules are permissive. `orgPhonePeConfig` writes succeed in development but will fail in production with strict rules (rules in repo deny all client access). May need to add a service-account-based approach in production.
