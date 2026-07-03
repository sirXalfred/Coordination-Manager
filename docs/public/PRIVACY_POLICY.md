# Privacy Policy

**Coordination Manager**
*Effective Date: February 7, 2026*
*Last Updated: June 19, 2026*

---

## 1. Introduction

Coordination Manager ("the App", "the Service") is an open-source scheduling and event coordination application operated by **Voltaire Swarm OÜ**, a private limited company registered in Estonia ("we", "us", "our"). This Privacy Policy explains what data we collect, how we use it, who we share it with, and the rights you have over it.

Voltaire Swarm OÜ is the **data controller** for personal data processed through the hosted instance at <https://coordinationmanager.com>. If you self-host the software, you are the controller for your own deployment.

We are committed to transparency — both in how we handle your data and in how our software is built.

---

## 2. Open Source Transparency

Coordination Manager is developed as an **open-source project** under the **MIT License**. The public source code is available for review, audit, and contribution:

- **Public repository:** [github.com/whitevo/coordination-manager-public](https://github.com/whitevo/coordination-manager-public)
- **Licence:** [LICENSE](https://github.com/whitevo/coordination-manager-public/blob/main/LICENSE)

The production platform that operates coordinationmanager.com is maintained in a separate private repository that is not publicly accessible. We selectively merge valuable community contributions from the public repository into production, and we periodically release appropriate non-sensitive improvements back to the public repository.

You can inspect exactly how your data is processed. We believe open-source development is the strongest form of privacy assurance — you don't have to take our word for it; you can verify it yourself.

---

## 3. Information We Collect

### 3.1 Google Account Users

When you sign in with Google, we receive:

- **Name** — Your display name from your Google profile.
- **Email address** — Your primary Google email.
- **Profile picture** — Your Google profile avatar (if available).
- **Google user ID** — A unique identifier from Google.

We do **not** receive or store your Google account password.

### 3.2 Traveler (Guest) Accounts

When you continue as a Traveler, we collect:

- **No personal information** — No email, no name, no password.
- A randomly generated **Traveler name** is assigned to you (e.g., *Wandering Falcon 42*).
- A session token is stored in your browser to maintain access.

Traveler accounts are **fully anonymous**. We cannot identify who you are, and we cannot recover your account if you lose your browser session.

**Traveler data is automatically deleted after 64 days.**

### 3.3 Cardano Wallet Sign-In

If you sign in using a Cardano-compatible browser wallet (CIP-30, such as Lace, Eternl, Typhon, or Yoroi):

- We record your **wallet address** as a pseudonymous identifier for your account.
- We do **not** receive your private keys, mnemonic, or signing capability beyond the one-time authentication challenge.
- We do **not** access your funds, transaction history, or other on-chain activity.

A wallet address is **pseudonymous personal data** under the EU General Data Protection Regulation (GDPR): on its own it does not identify you by name, but it can be linked to your account, and on-chain analysis by third parties may further identify you. We treat wallet addresses with the same care as other personal data: they are included in your data export and deleted when you delete your account.

### 3.4 Discord Linking and Bot Interactions

If you link your account to Discord or interact with our Discord bots:

- We store your Discord user ID and server/channel context relevant to the integration.
- Server administrators who hold the **moderator role** for a given server may view bot interaction and moderation data for that server only, after explicitly accepting the moderator role.
- We do not access your DMs unrelated to the bot, your private Discord servers, or your wider Discord activity.

### 3.5 Calendar Data

If you grant calendar permissions (e.g., Google Calendar), we access:

- **Calendar events** — Event titles, times, durations, and participant information from your connected calendars.
- **Availability data** — Free/busy information for scheduling purposes.

This data is used solely to provide scheduling functionality within the App.

### 3.6 Application Data

Data you create within the App:

- **User preferences** — Timezone, notification settings, display preferences.
- **Meetings and events** — Meetings you create or are invited to through the App.
- **Availability settings** — Your configured available hours and scheduling preferences.

### 3.7 Automatically Collected Data

- **Usage and server logs** — Basic server logs for error tracking, abuse prevention, and performance monitoring. These are kept for a limited period and minimised where possible.
- **No third-party advertising or behavioural-tracking trackers.** We do not embed analytics, advertising, or marketing tags from third parties.

---

## 4. How We Use Your Information

We use your information exclusively to:

- **Authenticate your identity** via Google OAuth 2.0, Cardano wallet signatures, or Traveler session tokens.
- **Display your profile** within the application.
- **Sync your calendar** data for scheduling features.
- **Coordinate meetings** by comparing availability across participants.
- **Send notifications** about schedule changes and upcoming events.
- **Operate Discord integrations** you have explicitly enabled.
- **Protect the Service** — abuse prevention, rate limiting, security incident response.
- **Produce de-identified, aggregated analytics** for product improvement, governance research, and public reporting (no individual identification).

We do **not**:

- Sell your data to third parties.
- Use your data for advertising.
- Share your data with unrelated services.
- Train AI/ML models on your personal data.

### 4.1 Google API Services Limited Use Compliance

The use and transfer of raw or derived user data received from Google Workspace APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

Data received from Google APIs is used only to provide user-facing scheduling and availability features requested by the user. We do not sell this data, use it for advertising, or use it to train generalized AI or ML models.

---

## 5. Data Storage & Security

### 5.1 Infrastructure

- **Authentication** is handled by [Supabase](https://supabase.com), which manages secure token exchange with Google. Your Google credentials never pass through our application servers.
- **Database** is hosted on Supabase (PostgreSQL) with row-level security policies.
- All data is transmitted over **HTTPS/TLS** encryption.

### 5.2 Data Retention

- **Google accounts**: Your data is retained as long as your account is active. You may **delete your account** at any time through the App settings, which removes all associated data.
- **Traveler accounts**: All data (profile, calendars, events) is **automatically deleted 64 days** after account creation. This is enforced by an automated database cleanup process.
- Calendar data is accessed in real-time and is not permanently cached beyond what is necessary for the features you use.

---

## 6. Third-Party Services (Sub-processors)

The hosted Service relies on the following third-party providers. Each operates under its own privacy and security obligations:

| Service | Purpose | Privacy Policy |
|---------|---------|----------------|
| Supabase | Database, authentication, file storage | [Supabase Privacy Policy](https://supabase.com/privacy) |
| Vercel | Frontend hosting and edge delivery | [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy) |
| Railway | Backend API hosting | [Railway Privacy Policy](https://railway.app/legal/privacy) |
| Google (OAuth & Calendar) | Authentication and calendar integration | [Google Privacy Policy](https://policies.google.com/privacy) |
| Cardano wallet providers (e.g. Lace, Eternl, Typhon, Yoroi) | Wallet sign-in via CIP-30 | See each wallet provider's policy |
| Discord | Discord bot and guardian features | [Discord Privacy Policy](https://discord.com/privacy) |
| Cloudflare Turnstile | Captcha for abuse prevention | [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/) |
| ImprovMX | Email forwarding for project addresses | [ImprovMX Privacy Policy](https://improvmx.com/privacy/) |

If this list changes materially, we will update this Privacy Policy and reflect the change in the public repository history.

---

## 7. Your Rights

If you are in the European Economic Area, the United Kingdom, or another jurisdiction granting equivalent data protection rights, you have the right to:

- **Access** your stored data through the App or by contacting us.
- **Rectify** inaccurate data via the App or by contacting us.
- **Erase** your account and all associated data ("right to be forgotten").
- **Restrict** or **object to** certain processing.
- **Receive a copy** of your data in a portable, machine-readable format (data portability).
- **Revoke** Google calendar access through your [Google Account Permissions](https://myaccount.google.com/permissions).
- **Lodge a complaint** with your national data protection authority. In Estonia, this is the [Estonian Data Protection Inspectorate (AKI)](https://www.aki.ee/en).

To exercise any of these rights, contact **privacy@coordinationmanager.com**. We aim to respond within 30 days.

---

## 8. Children's Privacy

Coordination Manager is not intended for use by individuals under the age of 13 (or under 16 where required by local law, such as some EU member states). We do not knowingly collect personal information from children below those ages. If you believe we have collected such data, please contact us so we can delete it.

---

## 9. Forward-Looking Privacy Roadmap

We are actively exploring **zero-knowledge (ZK) and privacy-preserving cryptographic techniques** so that participants can compare availability and coordinate meetings without revealing more information than necessary, even to the platform operator. This is not yet implemented; we will update this Policy when such features are released. The current Service operates with conventional server-side processing as described above.

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be reflected in the "Last Updated" date at the top of this page. For material changes, we will notify users through the App or via email where appropriate.

As an open-source project, policy-facing changes are tracked in our [public repository](https://github.com/whitevo/coordination-manager-public).

---

## 11. Contact

If you have questions about this Privacy Policy or your data:

- **Data controller:** Voltaire Swarm OÜ (Estonia)
- **Privacy & data requests:** privacy@coordinationmanager.com
- **General contact:** tevo@coordinationmanager.com
- **Security:** security@coordinationmanager.com
- **GitHub:** [github.com/whitevo/coordination-manager-public/issues](https://github.com/whitevo/coordination-manager-public/issues) (for non-personal questions only)

---

*Coordination Manager is an open-source project stewarded by Voltaire Swarm OÜ. Public source code is available under the MIT License at [github.com/whitevo/coordination-manager-public](https://github.com/whitevo/coordination-manager-public).*
