# BCRP DMV Services

A persistent Discord slash-command bot for BCRP DMV roleplay. It stores vehicle, license, inspection, and appointment records in `data/records.json`.

## Setup

1. Create a Discord application and bot at the Discord Developer Portal.
2. Enable the `applications.commands` and `bot` scopes when inviting it. The bot needs `Send Messages`, `Embed Links`, and `Manage Roles`; its role must be above the Resident role.
3. Copy `.env.example` to `.env` and fill in `DISCORD_TOKEN`, `CLIENT_ID`, and optionally `GUILD_ID`.
4. Install dependencies and register commands:

```powershell
npm install
npm run register
```

5. Start the bot:

```powershell
npm run dev
```

Use `npm run build` followed by `npm start` for a production-style run. Set `STAFF_ROLE_ID` for regular DMV staff, and `STAFF_ADMIN_ROLE_ID` for supervisors who may issue or suspend licenses. Server managers can also use supervisor commands. If a token has been exposed, rotate it in the Discord Developer Portal before starting the bot.

## Verification

Set `WELCOME_CHANNEL_ID` to `1553867583969824778` or your desired welcome channel. The welcome message is sent automatically when a member joins; there is no manual welcome command. In Server Settings, deny `@everyone` access to member channels and grant the `Resident` role access so verification controls access correctly. The bot role must be above the Resident role. Enable the **Server Members Intent** for the bot in the Discord Developer Portal.

Appointment requests are forwarded to `APPOINTMENT_CHANNEL_ID` and mention `DMV_STAFF_ROLE_ID`. The bot needs permission to view that channel, send messages, and embed links there.

## Commands

- `/ping`, `/userinfo`
- `/say` (DMV staff), `/announce` (supervisors)
- `/dmv-info send|edit` (supervisors)
- `/support-panel` (supervisors)
- `/application-panel` (administrators)
- `/shift start`, `/shift end`, `/shift status`, `/shift leaderboard` (DMV staff)
- `/shift review` (DMV administrators)
- **DMV Support:** staff claim a ticket, then use `/greet username` to introduce the assigned representative to the citizen.
- DMV Support staff can use `/add @member` to grant a member ticket access and `/unclaim` to release the current ticket assignment.

Applications are published with `/application-panel`. Anyone can click **Reply / Start Application** and complete the 20-question application in DMs. Applications are reviewed in `APPLICATION_REVIEW_CHANNEL_ID`; anyone with `View Channel` access can click **Accept Applicant** or **Deny Applicant**, but must provide a reason. Accepted applicants receive `STAFF_ROLE_ID` and DMV Trainee role `1553870809838256218`, and every decision is sent to the applicant by DM. Enable the Discord **Message Content Intent** and **Direct Messages** intent for the bot.

The support panel is published with `/support-panel` by a supervisor. Members can open one private ticket at a time; tickets are visible to the opener, DMV staff, supervisors, and `SUPPORT_TEAM_ROLE_ID`. Every new ticket mentions the support team. Set `TICKET_CATEGORY_ID` if tickets should be created under a specific category. The bot needs `Manage Channels` and `Manage Roles` for the support and verification systems.

Shift management uses a Monday-based weekly cycle. Staff role `1553870849050808361` can manage only their own time with `/shift start`, `/shift end`, and `/shift status`; `/shift leaderboard` shows this week's totals. Administrator role `1553870687645732995` alone can run `/shift review`, which privately sends an attendance notice to every tracked staff member below the 1 hour 30 minute minimum and records the review in audit logs.
- `/help`
- `/vehicle add`, `/vehicle list`, `/vehicle remove`, `/vehicle transfer`
- `/license show`, `/license issue`, `/license suspend`, `/license revoke`
- `/inspection`, `/inspection-history`
- `/appointment book`, `/appointment list`, `/appointment cancel`, `/appointment staff-list`, `/appointment complete`
- `/lookup`

Never paste the bot token into chat or commit `.env`.