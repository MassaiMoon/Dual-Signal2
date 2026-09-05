# DUAL // SIGNAL — Identity & Reputation Architecture

## Core Principle

**DUAL // SIGNAL** is a privacy-first community identity and reputation passport. Participation does not require a wallet. Your username is your primary identity; social accounts and a wallet are optional extensions.

```
DUAL // SIGNAL USER
  → PUBLIC USERNAME                 (primary identity, immutable)
  → CONNECTED COMMUNITY IDENTITIES  (optional: X, Telegram, Discord, DUAL Forum)
  → VERIFIED COMMUNITY ACTIVITY     (evidence tables: posts, active days, participations)
  → SIGNAL REPUTATION ENGINE        (scoring rules, level resolvers)
  → DUAL SMART OBJECT               (on-chain passport, updated asynchronously)
  → DUAL // SIGNAL PASSPORT         (visual badge face, shareable)
```

---

## Identity Model

### User
The root identity. Created once, identified by an immutable CUID and an optional **username**.

| Field              | Type     | Notes                                  |
|--------------------|----------|----------------------------------------|
| `id`               | CUID     | Primary key                            |
| `username`         | String?  | Unique, chosen once — cannot change    |
| `usernameNormalized` | String? | Lowercase version of username          |

### ExternalAccount
Links a user to a verified social identity. One row per connected platform.

| Field           | Type       | Notes                                        |
|-----------------|------------|----------------------------------------------|
| `source`        | Provider   | TWITTER, TELEGRAM, DISCORD, DUAL_FORUM       |
| `externalUserId`| String     | Platform-native user ID                      |
| `handle`        | String     | Display handle at time of verification       |
| `verifiedAt`    | DateTime?  | When the connection was verified             |

**Connected state** is derived from the presence of an `ExternalAccount` row — it is NOT stored as a badge field.

### Provider vs EventSource
- `Provider` enum: identity sources that a user can connect (TWITTER, TELEGRAM, DISCORD, DUAL_FORUM)
- `EventSource` enum: all possible event origins including infrastructure sources (MOCK, DUAL, LINKEDIN)

---

## Reputation Engine

### Four Tracks (250 pts each, 1000 pts total)

| Track      | Counter              | Level resolver         | Evidence table           |
|------------|----------------------|------------------------|--------------------------|
| X Signal   | publicViews + posts  | `resolveXSignalLevel`  | `x_posts`                |
| Telegram   | activeDays           | `resolveTelegramLevel` | `telegram_active_days`   |
| Discord    | activeDays           | `resolveDiscordLevel`  | `discord_active_days`    |
| Governance | participations       | `resolveGovernanceLevel`| `governance_participations` |

### X Signal Levels
Level 1 requires at least **1 qualifying post** AND is the first threshold crossed.
Views without posts = Level 0 (cannot unlock).

| Level | Name          | Requirement                     | Points |
|-------|---------------|---------------------------------|--------|
| 1     | FIRST_SIGNAL  | ≥1 qualifying post              | 50     |
| 2     | SPARK         | ≥1,000 public views             | 100    |
| 3     | PULSE         | ≥10,000 public views            | 150    |
| 4     | WAVE          | ≥100,000 public views           | 200    |
| 5     | IMPACT        | ≥1,000,000 public views         | 250    |

### Telegram / Discord Levels (identical thresholds)

| Level | Name          | Active Days | Points |
|-------|---------------|-------------|--------|
| 1     | FIRST_CONTACT | ≥1          | 50     |
| 2     | REGULAR       | ≥7          | 100    |
| 3     | CONNECTED     | ≥30         | 150    |
| 4     | CORE_MEMBER   | ≥90         | 200    |
| 5     | PILLAR        | ≥180        | 250    |

### Governance Levels (DUAL Forum participation)

| Level | Name          | Participations | Points |
|-------|---------------|----------------|--------|
| 1     | FIRST_VOICE   | ≥1             | 50     |
| 2     | CONTRIBUTOR   | ≥3             | 100    |
| 3     | PARTICIPANT   | ≥10            | 150    |
| 4     | GOVERNOR      | ≥25            | 200    |
| 5     | STEWARD       | ≥50            | 250    |

### Identity Tiers

| Tier        | Min Score |
|-------------|-----------|
| INITIATE    | 0         |
| EXPLORER    | 150       |
| BUILDER     | 350       |
| STAKEHOLDER | 550       |
| GENESIS     | 750       |
| LEGEND      | 900       |

---

## Evidence Tables

Evidence tables store the raw normalized activity records that are the source of truth for scoring.

```
x_posts                  — one row per qualifying X post
telegram_active_days     — one row per user per day they were active in Telegram
discord_active_days      — one row per user per day they were active in Discord
governance_participations — one row per DUAL Forum proposal participated in
```

Badge counters (`xSignalPublicViews`, `telegramActiveDays`, etc.) are cached aggregates derived from these tables. They are updated on each event, not recomputed from evidence on every read.

---

## Badge State & DUAL Object

The `Badge` record holds cached scoring state and is the source of truth for the visual passport. After any scoring change, a `BadgeUpdate` row is queued and an async worker propagates the state to the on-chain DUAL Object.

### DUAL Object Custom Properties

| Property          | Type   | Example         |
|-------------------|--------|-----------------|
| `signal_score`    | String | "750"           |
| `identity_tier`   | String | "GENESIS"       |
| `x_signal_level`  | String | "4"             |
| `telegram_level`  | String | "3"             |
| `discord_level`   | String | "2"             |
| `governance_level`| String | "1"             |
| `wallet_address`  | String | "0xAbCd..."     |
| `member_since`    | String | "2025-01"       |

---

## Badge Visibility Rules

- **Achievement icons** are only rendered when the track is connected (level > 0).
- When disconnected (level = 0), a dim circle placeholder appears — no icon, no level label.
- The Passport background image is fixed (baked text cannot be changed).
- The tier artwork and score are always rendered regardless of connection state.

---

## Privacy Principles

- No wallet is required to join or participate.
- Governance participation records direction of vote — only that a participation occurred.
- Connected accounts can be independently disconnected without losing accumulated score.
- Username is the stable identity anchor.

---

## Infrastructure

| Component      | Technology                              |
|----------------|-----------------------------------------|
| App            | Next.js 15 App Router (Node.js runtime) |
| Database       | PostgreSQL via Prisma ORM               |
| Deployment     | Railway (auto-deploy from GitHub)       |
| On-chain       | DUAL Network, Chain 6301               |
| Migrations     | `prisma migrate deploy` (not db push)   |
| Notifications  | Telegram Bot API                        |
| Testing        | Vitest (scoring engine unit tests)      |
