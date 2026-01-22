# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Spoke App Skeleton**, a template/reference implementation for creating spoke apps in the Kokokino Hub & Spoke architecture. The Hub (kokokino.com) handles authentication and billing via Lemon Squeezy; spoke apps validate SSO tokens and check subscriptions via Hub API.

## Commands

```bash
# Development (runs on port 3010)
meteor --port 3010 --settings settings.development.json

# Or use npm script
npm run dev

# Run tests once
npm test

# Run tests in watch mode
npm run test-app

# Analyze bundle size
npm run visualize

# Deploy to Meteor Galaxy
meteor deploy your-app.kokokino.com --settings settings.production.json
```

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Meteor 3.3** | Real-time framework with MongoDB integration |
| **Mithril.js 2.3** | UI framework - uses JavaScript to generate HTML (no JSX) |
| **Pico CSS** | Classless CSS framework for minimal styling |
| **jsonwebtoken** | JWT validation for SSO tokens |

## Architecture

### SSO Flow
1. User clicks "Launch" in Hub → Hub generates RS256-signed JWT
2. User redirected to `/sso?token=<jwt>` on spoke
3. Spoke validates JWT signature with Hub's public key
4. Spoke calls Hub API for fresh user data
5. Spoke creates local Meteor session via custom `Accounts.registerLoginHandler`

### Key Directories
- `imports/hub/` - Hub integration (SSO handler, API client, subscription checking)
- `imports/ui/components/` - Mithril components including `RequireAuth` and `RequireSubscription` HOCs
- `imports/ui/pages/` - Route pages including `SsoCallback` for SSO handling
- `server/accounts.js` - Custom login handler for SSO
- `server/methods.js` - Meteor methods (chat.send, user.getSubscriptionStatus)
- `server/publications.js` - Data publications (chatMessages, userData)

### Settings Structure
```json
{
  "public": {
    "appId": "unique_app_id",
    "hubUrl": "https://kokokino.com",
    "requiredProducts": ["product_id"]
  },
  "private": {
    "hubApiKey": "api-key-from-hub",
    "hubApiUrl": "https://kokokino.com/api/spoke",
    "hubPublicKey": "-----BEGIN PUBLIC KEY-----..."
  }
}
```

## Code Conventions

### Meteor v3
- Use async/await patterns (no fibers) - e.g., `Meteor.users.findOneAsync()`, `insertAsync()`, `updateAsync()`
- Do not use `autopublish` or `insecure` packages
- When recommending Atmosphere packages, ensure Meteor v3 compatibility

### JavaScript Style
- Use `const` by default, `let` when needed, avoid `var`
- Always use curly braces with `if` blocks
- Avoid early returns - prefer single return statement at end
- Each variable declaration on its own line (no comma syntax)
- Use readable variable names (`document` not `doc`)

### UI Style
- Leverage Pico CSS patterns - avoid inline styles
- Use semantic CSS class names (`warning` not `yellow`)
- Use Mithril for UI; Blaze integration is acceptable for packages like accounts-ui
- Avoid React unless specifically instructed

### Security
- Validate all user input
- Implement rate limiting on sensitive endpoints
- Never store Hub's private key in spoke code
- Sanitize user content before display to prevent XSS
