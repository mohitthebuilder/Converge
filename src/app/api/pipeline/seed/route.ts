import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/db/supabase-server'
import { getSession } from '@/lib/auth/session'
import { hashContent } from '@/lib/db/sync'

// Fictional company: Nexus — B2B SaaS analytics platform
// Team: Sarah Chen (PM), Raj Patel (Eng Lead), Lena Park (Designer), Marcus Johnson (Backend),
//       Priya Sharma (Data Eng), Tom Wilson (QA), Alex Rivera (DevOps), Nina Kowalski (CS Lead)

const JIRA_ISSUES: Array<{
  key: string; summary: string; type: string; status: string; priority: string
  assignee: string | null; reporter: string; sprint: string | null; labels: string[]
  description: string; comments: Array<{ author: string; body: string; created: string }>
  created: string; updated: string
}> = [
  // ──── EPIC: Platform Migration ────
  {
    key: 'NX-101', summary: 'Q3 Platform Migration to Microservices', type: 'Epic',
    status: 'In Progress', priority: 'Critical', assignee: 'Raj Patel', reporter: 'Sarah Chen',
    sprint: null, labels: ['platform', 'q3', 'migration'],
    description: `Migrate the Nexus monolith to microservices architecture. This is our highest-priority technical initiative for Q3.

Business justification:
• Current monolith cannot scale beyond 500 concurrent users without degradation
• Deployment cycle is 4 hours — blocking feature velocity
• Single failure domain — one bad deploy takes down everything

Target architecture:
• User Service (auth, profiles, permissions)
• Analytics Service (event ingestion, aggregation, dashboards)
• Billing Service (Stripe integration, invoicing, usage metering)
• Notification Service (email, in-app, webhooks)
• API Gateway (rate limiting, routing, auth middleware)

Success criteria:
| Metric | Current | Target | Deadline |
|--------|---------|--------|----------|
| Deploy time | 4 hours | 15 minutes | Aug 15 |
| Concurrent users | 500 | 5,000 | Sep 1 |
| Service uptime | 99.2% | 99.9% | Sep 30 |
| Mean recovery time | 45 min | 5 min | Sep 30 |
| Feature deploy frequency | 1/week | 3/day | Aug 30 |

Dependencies:
• NX-104 (Terraform) must complete before any service migration
• NX-102 (Auth) is the first service to migrate — blocks all others
• Database migration (NX-103) can run in parallel with auth
• Load testing infrastructure needed by Aug 1`,
    comments: [
      { author: 'Raj Patel', body: `Proposed timeline after architecture review:
Phase 1 (Jul 1-15): Infrastructure setup — Terraform, K8s, CI/CD
Phase 2 (Jul 15-Aug 15): Auth service + API Gateway
Phase 3 (Aug 15-Sep 1): Analytics + Billing services
Phase 4 (Sep 1-15): Notification service + integration testing
Phase 5 (Sep 15-30): Cutover, monitoring, fallback plan

Risk: Phase 2 is the hardest — auth touches everything. If we slip here, everything shifts.`, created: '2026-06-01' },
      { author: 'Sarah Chen', body: 'Approved. Flagged to leadership that Q3 feature roadmap will be lighter because of this. Got buy-in from VP Eng. Let\'s staff this with Marcus and Alex full-time.', created: '2026-06-02' },
      { author: 'Alex Rivera', body: 'K8s cluster is provisioned. Terraform modules ready for review. One concern: our current monitoring (Datadog) needs namespace-level dashboards for each service. I\'ll set that up in Phase 1.', created: '2026-06-05' },
    ],
    created: '2026-06-01', updated: '2026-06-20',
  },
  {
    key: 'NX-102', summary: 'Migrate User Authentication to OAuth 2.0 + RBAC', type: 'Story',
    status: 'In Review', priority: 'Critical', assignee: 'Marcus Johnson', reporter: 'Raj Patel',
    sprint: 'Sprint 14', labels: ['auth', 'migration', 'security'],
    description: `Replace the legacy session-cookie auth with OAuth 2.0 + JWT. Add role-based access control.

Current state:
• Server-rendered session cookies (express-session + Redis)
• No roles — everyone is "admin"
• Password hashing with bcrypt (fine, but we want passwordless)
• No SSO, no MFA

Target state:
• OAuth 2.0 with PKCE flow for SPAs
• JWT access tokens (15 min) + refresh tokens (7 days)
• Three roles: Owner, Admin, Member
• Google Workspace SSO for enterprise customers
• Optional TOTP-based MFA

Permission matrix:
| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| Manage billing | ✓ | ✗ | ✗ |
| Invite users | ✓ | ✓ | ✗ |
| Create dashboards | ✓ | ✓ | ✓ |
| Delete dashboards | ✓ | ✓ | Only own |
| View all data | ✓ | ✓ | ✓ |
| Manage integrations | ✓ | ✓ | ✗ |
| Export data | ✓ | ✓ | ✓ |
| API key management | ✓ | ✓ | ✗ |

Acceptance criteria:
• [ ] Existing users migrated without password reset
• [ ] Google SSO login works for @company.com domains
• [ ] JWT tokens issued and validated correctly
• [ ] Refresh token rotation implemented (one-time use)
• [ ] RBAC enforced on all API endpoints
• [ ] Session invalidation on role change
• [ ] Rate limiting on auth endpoints (10 req/min)
• [ ] Audit log for all auth events`,
    comments: [
      { author: 'Marcus Johnson', body: `Migration strategy for existing users:
1. Keep bcrypt passwords as fallback during transition (60 days)
2. On first login post-migration, issue JWT + set refresh token
3. Old session cookies rejected after cutover date
4. Users with Google Workspace email get prompted to link SSO

Edge case: 47 users have email addresses that don't match any Google Workspace domain. They keep email+password until we add SAML.`, created: '2026-06-10' },
      { author: 'Tom Wilson', body: 'QA checklist ready. 23 test cases covering: token expiry, refresh rotation, concurrent sessions, role changes mid-session, SSO with multiple Google accounts, MFA enrollment/recovery. Will need a staging environment with test Google Workspace.', created: '2026-06-12' },
      { author: 'Sarah Chen', body: 'Can we ship RBAC without MFA? MFA is nice-to-have for MVP. Our enterprise prospects (Acme Corp, TechFlow) specifically asked for SSO + roles, not MFA.', created: '2026-06-13' },
      { author: 'Raj Patel', body: 'Agreed. MFA moved to NX-135 (stretch). Core delivery is OAuth + RBAC + SSO. Marcus, update the AC.', created: '2026-06-13' },
    ],
    created: '2026-06-05', updated: '2026-06-22',
  },
  {
    key: 'NX-103', summary: 'Database Migration from MySQL 5.7 to PostgreSQL 15', type: 'Story',
    status: 'In Progress', priority: 'High', assignee: 'Priya Sharma', reporter: 'Raj Patel',
    sprint: 'Sprint 14', labels: ['database', 'migration', 'infrastructure'],
    description: `Migrate from MySQL 5.7 to PostgreSQL 15 for better JSON support, full-text search, and pgvector compatibility.

Motivation:
• MySQL 5.7 EOL was October 2023 — we're on unsupported software
• pgvector enables AI features without a separate vector DB
• PostgreSQL JSONB is vastly superior for our analytics event storage
• Full-text search (tsvector) replaces our hacky LIKE queries

Migration plan:
1. Schema conversion using pgloader
2. Data migration with dual-write period (2 weeks)
3. Read traffic cutover (shadow reads first, then primary)
4. Write traffic cutover
5. MySQL decommission (30 days after full cutover)

Schema differences requiring manual handling:
| MySQL | PostgreSQL | Notes |
|-------|-----------|-------|
| AUTO_INCREMENT | SERIAL / GENERATED ALWAYS | Use IDENTITY columns |
| TINYINT(1) | BOOLEAN | Convert in migration script |
| DATETIME | TIMESTAMPTZ | Add timezone awareness |
| TEXT with FULLTEXT index | TEXT with tsvector + GIN | Rebuild search indexes |
| JSON column | JSONB | Migration is transparent |
| ENUM types | CHECK constraints or custom types | Prefer CHECK for flexibility |
| GROUP_CONCAT | STRING_AGG | Update 14 queries |

Data volume: 2.3M rows across 47 tables. Largest: events (1.8M rows), users (12K), dashboards (8.4K).

Rollback plan: MySQL replica stays hot for 30 days post-cutover. Reverse pgloader script tested.`,
    comments: [
      { author: 'Priya Sharma', body: 'pgloader dry run completed. 44 of 47 tables converted cleanly. 3 tables need manual intervention:\n1. `events` — JSON column has inconsistent nested structure\n2. `user_preferences` — ENUM with 23 values, converting to varchar + CHECK\n3. `api_keys` — binary column for key hash needs bytea conversion\n\nEstimated full migration time: 45 minutes for 2.3M rows.', created: '2026-06-15' },
      { author: 'Marcus Johnson', body: 'I\'ve updated 11 of 14 GROUP_CONCAT → STRING_AGG queries. The remaining 3 are in the reporting module — they use GROUP_CONCAT with custom separators and ORDER BY, which STRING_AGG handles slightly differently. Will have a PR today.', created: '2026-06-17' },
    ],
    created: '2026-06-08', updated: '2026-06-20',
  },
  {
    key: 'NX-104', summary: 'Set Up Terraform for Multi-Environment Infrastructure', type: 'Task',
    status: 'Done', priority: 'High', assignee: 'Alex Rivera', reporter: 'Raj Patel',
    sprint: 'Sprint 13', labels: ['infrastructure', 'terraform', 'devops'],
    description: `Create Terraform modules for provisioning staging and production environments on AWS.

Resources to provision:
• EKS cluster (1.28) with managed node groups
• RDS PostgreSQL 15 (Multi-AZ for prod)
• ElastiCache Redis 7 (session store + caching)
• S3 buckets (file uploads, backups, static assets)
• CloudFront distribution
• Route 53 DNS
• ACM certificates
• VPC with public/private subnets across 3 AZs
• NAT Gateway
• Security groups + NACLs

Environment differences:
| Resource | Staging | Production |
|----------|---------|------------|
| EKS nodes | 2x t3.medium | 3x t3.large (auto-scale to 6) |
| RDS | Single AZ, db.t3.medium | Multi-AZ, db.r6g.large |
| Redis | Single node, cache.t3.small | Cluster mode, 3x cache.r6g.large |
| CloudFront | Disabled | Enabled with WAF |
| Backup retention | 3 days | 30 days |
| Estimated monthly cost | $340 | $1,850 |

State management: S3 backend with DynamoDB locking. Separate state files per environment.`,
    comments: [
      { author: 'Alex Rivera', body: 'All modules deployed and tested. Staging environment is live. Production will be provisioned when we\'re ready for Phase 2 cutover.\n\n```\nterraform plan output:\nPlan: 47 to add, 0 to change, 0 to destroy.\n```\n\nCost estimate validated: staging $342/mo, prod $1,847/mo. Within budget.', created: '2026-06-12' },
      { author: 'Raj Patel', body: 'Looks great. One request: add a `terraform destroy` safeguard for production. I don\'t want anyone accidentally nuking prod with a typo.', created: '2026-06-12' },
      { author: 'Alex Rivera', body: 'Added. Production workspace requires `TF_VAR_confirm_destroy=yes-i-am-sure` environment variable. Also added Sentinel policies for: no public S3 buckets, no unencrypted RDS, no security groups with 0.0.0.0/0 ingress.', created: '2026-06-13' },
    ],
    created: '2026-06-03', updated: '2026-06-13',
  },
  {
    key: 'NX-105', summary: 'Memory Leak in WebSocket Connection Handler', type: 'Bug',
    status: 'Done', priority: 'Critical', assignee: 'Marcus Johnson', reporter: 'Tom Wilson',
    sprint: 'Sprint 13', labels: ['bug', 'performance', 'websocket'],
    description: `Production server OOM crashes every ~18 hours. Memory grows linearly from 512MB to 4GB.

Reproduction:
1. Open 50+ concurrent dashboard sessions with live updates
2. Monitor heap with \`--inspect\` flag
3. After ~2 hours, heap exceeds 2GB

Root cause (confirmed):
WebSocket \`on('close')\` handler has a race condition. When a client disconnects during a data push, the interval timer is not cleared. Orphaned intervals accumulate, each holding a reference to the connection object and its data buffers.

\`\`\`javascript
// BEFORE (buggy)
ws.on('close', () => {
  subscriptions.delete(ws)  // removes from map
  // but clearInterval(ws.interval) is never called
})

// AFTER (fixed)
ws.on('close', () => {
  if (ws.interval) clearInterval(ws.interval)
  if (ws.heartbeat) clearTimeout(ws.heartbeat)
  subscriptions.delete(ws)
  ws.removeAllListeners()
})
\`\`\`

Impact: 3 production OOM incidents in the past week. Each causes ~5 min downtime.

Fix also adds:
• Heartbeat ping/pong (30s interval) to detect zombie connections
• Max connection limit (1000 per server instance)
• Graceful shutdown that closes all connections on SIGTERM`,
    comments: [
      { author: 'Tom Wilson', body: 'Confirmed fix works. Load tested with 200 concurrent WebSocket connections over 6 hours. Memory stable at 680MB (±30MB). No OOM. Heap snapshots show no orphaned interval references.', created: '2026-06-08' },
      { author: 'Alex Rivera', body: 'Added Datadog alert: if any pod exceeds 2GB RSS, page oncall immediately. Previously we only alerted at 3.5GB which was too late.', created: '2026-06-09' },
    ],
    created: '2026-06-06', updated: '2026-06-09',
  },
  // ──── EPIC: Pricing Redesign ────
  {
    key: 'NX-106', summary: 'Q3 Pricing Redesign — Usage-Based Model', type: 'Epic',
    status: 'In Progress', priority: 'High', assignee: 'Sarah Chen', reporter: 'Sarah Chen',
    sprint: null, labels: ['pricing', 'q3', 'revenue'],
    description: `Redesign pricing from flat-rate tiers to usage-based model. Driven by enterprise feedback and competitive pressure.

Current pricing:
| Plan | Price | Limits |
|------|-------|--------|
| Starter | $29/mo | 3 users, 10 dashboards, 100K events/mo |
| Growth | $99/mo | 10 users, 50 dashboards, 1M events/mo |
| Enterprise | Custom | Unlimited |

Problems with current model:
• Starter-to-Growth jump is too steep ($29→$99) — 68% of Starter users churn before upgrading
• Growth plan's 1M event limit is hit by 40% of customers within 3 months
• No intermediate option — customers either pay too much or too little
• Enterprise pricing is opaque and slows sales cycle (avg 47 days)

Proposed model:
| Component | Price | Unit |
|-----------|-------|------|
| Platform fee | $0/mo (free tier) to $49/mo (pro) | per workspace |
| Events | $1.50 per 100K | tracked events |
| Users | $8/user/mo | active users (logged in within billing period) |
| Dashboards | Free (unlimited) | — |
| Data retention | 90 days free, $5/mo per extra 90 days | retention tier |
| API access | Included in Pro | — |

Projected impact:
• 23% increase in average revenue per customer (modeled on current usage data)
• Lower entry barrier should improve Starter→paid conversion by ~15%
• Enterprise customers get predictable, transparent pricing

Risks:
• Existing customers on flat-rate may see price increase — need grandfather clause
• Usage-based revenue is less predictable for forecasting
• Billing complexity increases (metering, invoicing, proration)`,
    comments: [
      { author: 'Nina Kowalski', body: 'CS perspective: our top 3 churn reasons are (1) price shock at renewal, (2) hitting event limits, (3) seat limits when team grows. Usage-based addresses all three. But we need a clear "your estimated bill" calculator — customers hate surprises.\n\nAlso: can we keep at least one simple flat-rate plan? Some small teams just want a number they can expense without approval.', created: '2026-06-10' },
      { author: 'Sarah Chen', body: 'Good point. Updated: keeping a $49/mo "Pro" plan with generous included usage (500K events, 5 users). Usage-based kicks in above those thresholds. Best of both worlds.', created: '2026-06-11' },
    ],
    created: '2026-06-08', updated: '2026-06-18',
  },
  {
    key: 'NX-107', summary: 'Implement Usage-Based Billing with Stripe Metered Subscriptions', type: 'Story',
    status: 'To Do', priority: 'High', assignee: 'Marcus Johnson', reporter: 'Sarah Chen',
    sprint: 'Sprint 15', labels: ['billing', 'stripe', 'pricing'],
    description: `Integrate Stripe metered billing to support the new usage-based pricing model.

Architecture:
• Event counter service reports usage hourly to Stripe via Usage Records API
• Stripe handles proration, invoicing, and payment collection
• Our billing dashboard shows real-time usage and projected invoice

Stripe products to create:
1. Platform fee (recurring) — $0 or $49/mo depending on plan
2. Events metered (usage-based) — $1.50 per 100K events
3. Active users metered (usage-based) — $8/user/mo
4. Data retention add-on (recurring) — $5/mo per tier

Edge cases:
• Mid-cycle upgrade from free to Pro: prorate platform fee
• Mid-cycle downgrade: complete current billing period, then switch
• Usage spike followed by credit: allow one-time usage credit via Stripe credit notes
• Failed payment: 3 retry attempts over 7 days, then suspend (not delete) account
• Annual contracts: 10% discount, usage still metered monthly

Webhook events to handle:
• invoice.payment_succeeded → update account status
• invoice.payment_failed → trigger retry flow + CS notification
• customer.subscription.updated → sync plan changes
• customer.subscription.deleted → trigger offboarding flow`,
    comments: [
      { author: 'Marcus Johnson', body: 'Stripe setup question: should we use Stripe Billing Portal for self-service plan changes, or build our own? Stripe portal is faster but less customizable. Our own gives us full control over the UX.\n\nRecommendation: Stripe portal for MVP, custom portal in v2.', created: '2026-06-15' },
      { author: 'Sarah Chen', body: 'Stripe portal for MVP. We can always switch later. Don\'t over-invest in billing UX when we haven\'t validated the pricing model yet.', created: '2026-06-15' },
    ],
    created: '2026-06-12', updated: '2026-06-18',
  },
  {
    key: 'NX-110', summary: 'Proration Bug on Mid-Cycle Plan Downgrades', type: 'Bug',
    status: 'Open', priority: 'High', assignee: null, reporter: 'Nina Kowalski',
    sprint: null, labels: ['bug', 'billing', 'customer-reported'],
    description: `Three enterprise customers reported being double-charged when downgrading mid-billing cycle.

Customer reports:
• Acme Corp: downgraded from Enterprise ($499/mo) to Growth ($99/mo) on June 10. Charged $499 + $99 on June 15.
• TechFlow: same pattern on June 8.
• DataViz Inc: downgraded, then upgraded again. Charged 3 times.

Expected behavior: prorated credit for unused Enterprise days, prorated charge for remaining Growth days.

Actual behavior: full charge for both plans on next invoice.

Suspected root cause: our Stripe webhook handler doesn't process \`customer.subscription.updated\` events with \`previous_attributes\` containing plan changes. It only handles new subscriptions and cancellations.

Impact: $2,847 in erroneous charges across 3 customers. CS has issued manual refunds. Need programmatic fix before more customers hit this.`,
    comments: [
      { author: 'Nina Kowalski', body: 'Adding context: this is our #1 support ticket this week. Two more customers just reported it. Total affected: 5 customers, ~$4,200 in overcharges. All manually refunded but this is a trust issue.', created: '2026-06-16' },
      { author: 'Sarah Chen', body: 'Escalating to P0. @Marcus please prioritize this over NX-107. We can\'t launch new pricing with a proration bug.', created: '2026-06-16' },
    ],
    created: '2026-06-14', updated: '2026-06-16',
  },
  // ──── EPIC: Mobile App ────
  {
    key: 'NX-111', summary: 'Mobile App v2.0 — Offline-First Architecture', type: 'Epic',
    status: 'To Do', priority: 'Medium', assignee: 'Lena Park', reporter: 'Sarah Chen',
    sprint: null, labels: ['mobile', 'v2', 'offline'],
    description: `Complete rewrite of the Nexus mobile app. v1 was a WebView wrapper — v2 is native (React Native) with offline-first architecture.

Why rewrite:
• v1 WebView performance: avg 4.2s load time, 2.1 star App Store rating
• No offline access — PMs check dashboards in meetings without reliable WiFi
• Push notifications not supported in WebView
• Deep linking broken on iOS 17

v2 scope:
• React Native with Expo (managed workflow)
• SQLite for local data (WatermelonDB)
• Background sync every 15 minutes when online
• Push notifications via Firebase Cloud Messaging
• Biometric auth (Face ID / fingerprint)
• Dashboard viewer (read-only for v2, edit in v3)
• Search across dashboards and saved queries

Offline strategy:
| Data type | Cache policy | Max local size |
|-----------|-------------|---------------|
| Dashboard definitions | Always cached | 50MB |
| Last 7 days of chart data | Cached on view | 200MB |
| User preferences | Always cached | 1MB |
| Search index | Updated on sync | 20MB |
| Raw events | Never cached | 0 |

Tech stack decision:
Evaluated Flutter vs React Native vs native (Swift/Kotlin). Chose React Native because:
• 3 of 4 mobile engineers already know React
• Code sharing with web dashboard (shared types, API client, business logic)
• Expo simplifies build/deploy (OTA updates without App Store review)
• Performance benchmarks showed <5% difference from native for our dashboard rendering use case`,
    comments: [
      { author: 'Lena Park', body: 'Design exploration done. Key insight from user research (8 PM interviews): #1 use case for mobile is "check metrics before a meeting" — they want glanceable KPI cards, not full dashboard editing. Designing around this insight.\n\nProposed navigation: Home (KPI cards) → Dashboards (list) → Dashboard Detail (read-only) → Search\n\nNo settings on mobile — manage account on web.', created: '2026-06-18' },
      { author: 'Sarah Chen', body: 'Love the "glanceable KPIs" angle. That\'s our mobile differentiator. Amplitude and Mixpanel mobile apps try to cram the full desktop experience into a phone — it\'s terrible. Let\'s be opinionated: mobile = consumption, desktop = creation.', created: '2026-06-18' },
    ],
    created: '2026-06-15', updated: '2026-06-20',
  },
  {
    key: 'NX-115', summary: 'iOS Keyboard Overlaps Input Fields on iPhone SE and Mini', type: 'Bug',
    status: 'Open', priority: 'Low', assignee: null, reporter: 'Tom Wilson',
    sprint: null, labels: ['bug', 'mobile', 'ios'],
    description: `On iPhone SE (3rd gen) and iPhone 13 Mini, the keyboard overlaps text input fields in the search and filter modals. User cannot see what they're typing.

Steps to reproduce:
1. Open Nexus app on iPhone SE
2. Navigate to any dashboard
3. Tap the search icon
4. Start typing — keyboard covers the input field

Expected: Input field scrolls above keyboard.
Actual: Input field stays behind keyboard. No scrolling.

Root cause: KeyboardAvoidingView behavior prop is set to "padding" which doesn't work correctly with our modal layout. Need "position" behavior for iOS or use react-native-keyboard-aware-scroll-view.

Affects ~8% of our mobile users (iPhone SE + Mini combined).`,
    comments: [
      { author: 'Tom Wilson', body: 'Tested on: iPhone SE (3rd gen, iOS 17.4), iPhone 13 Mini (iOS 17.5), iPhone 12 Mini (iOS 16.7). Bug confirmed on all three. iPhone 14 and larger: not affected.', created: '2026-06-19' },
    ],
    created: '2026-06-19', updated: '2026-06-19',
  },
  // ──── EPIC: Data Pipeline ────
  {
    key: 'NX-116', summary: 'Data Pipeline Overhaul — Real-Time Event Streaming', type: 'Epic',
    status: 'In Progress', priority: 'High', assignee: 'Priya Sharma', reporter: 'Sarah Chen',
    sprint: null, labels: ['data', 'pipeline', 'kafka', 'q3'],
    description: `Replace batch ETL with real-time event streaming. Currently, dashboard data is 4-6 hours stale.

Current pipeline (batch):
SDK → API → MySQL → Hourly cron → Aggregation tables → Dashboard queries

Proposed pipeline (streaming):
SDK → API → Kafka → Stream processors (Flink) → PostgreSQL + ClickHouse → Dashboard queries

Why ClickHouse:
• Sub-second OLAP queries on billions of rows
• Columnar storage = 10x compression vs row-based
• Native Kafka consumer — no custom ingestion code
• MergeTree engine handles time-series data perfectly

Event schema (v2):
\`\`\`json
{
  "event_id": "uuid",
  "workspace_id": "uuid",
  "user_id": "string",
  "event_name": "page_view | button_click | form_submit | custom",
  "properties": { "page": "/dashboard", "duration_ms": 1234 },
  "timestamp": "2026-06-15T10:30:00Z",
  "session_id": "uuid",
  "device": { "type": "desktop", "os": "macOS", "browser": "Chrome 126" }
}
\`\`\`

Capacity planning:
| Metric | Current | 6-month target |
|--------|---------|---------------|
| Events/second (peak) | 500 | 5,000 |
| Events/day | 12M | 100M |
| Storage (raw) | 50GB/mo | 400GB/mo |
| Storage (compressed, ClickHouse) | N/A | 40GB/mo |
| Query latency (p95) | 2.3s | 200ms |

Migration strategy: dual-write for 4 weeks. Old pipeline and new pipeline run in parallel. Compare outputs daily. Switch dashboards to new pipeline once parity confirmed.`,
    comments: [
      { author: 'Priya Sharma', body: 'Kafka cluster provisioned on Confluent Cloud (3 brokers, multi-AZ). Topic partitioning strategy:\n• 12 partitions per topic (matches our max consumer group size)\n• Partitioned by workspace_id for ordering guarantees within a workspace\n• Retention: 7 days raw, then archive to S3 in Parquet format\n\nFlink jobs scaffolded for 3 aggregations: event counts (1-min windows), unique users (5-min windows), funnel completion (session-based).', created: '2026-06-12' },
      { author: 'Raj Patel', body: 'Cost check: Confluent Cloud estimate is $850/mo for our current volume, scaling to ~$2,100/mo at 100M events/day. That\'s within budget. ClickHouse Cloud estimate: $400/mo current, $1,600/mo at scale. Total pipeline cost: ~$3,700/mo at scale vs current $200/mo (just MySQL cron). Significant increase but justified by real-time capability.', created: '2026-06-14' },
    ],
    created: '2026-06-10', updated: '2026-06-20',
  },
  {
    key: 'NX-120', summary: 'ETL Job Silently Drops Records with Unicode Characters', type: 'Bug',
    status: 'In Progress', priority: 'High', assignee: 'Priya Sharma', reporter: 'Nina Kowalski',
    sprint: 'Sprint 14', labels: ['bug', 'data', 'etl', 'unicode'],
    description: `Customer "Würzburg Analytics GmbH" reported missing data. Investigation revealed our ETL job drops any event where properties contain non-ASCII characters.

Root cause: The aggregation script uses a regex sanitizer that strips "special characters" — but the regex is too aggressive:
\`\`\`python
# BUGGY
cleaned = re.sub(r'[^a-zA-Z0-9_\-\.\s]', '', value)

# FIXED
cleaned = value  # don't strip anything, use parameterized queries instead
\`\`\`

Impact analysis:
• ~3.2% of all events contain non-ASCII characters (names, cities, product descriptions in non-English languages)
• Affected customers: 14 workspaces with international users
• Data loss: ~180K events over the past 90 days
• Revenue impact: at least 2 enterprise customers evaluating competitors because of "data accuracy issues"

Fix: Remove the regex sanitizer entirely. Use parameterized SQL queries (which we already do for writes — the sanitizer was a leftover from an early prototype that used string concatenation).

Recovery plan: Re-process raw event logs from S3 archive for the past 90 days. Estimated recovery time: 6 hours.`,
    comments: [
      { author: 'Priya Sharma', body: 'Fix deployed to staging. Re-processing script ready. One concern: re-processing 90 days of raw logs will temporarily double our aggregation table sizes until the dedup job runs. Need ~200GB of temporary storage. Cleared with Alex.', created: '2026-06-18' },
      { author: 'Nina Kowalski', body: 'Communicated with all 14 affected customers. Würzburg Analytics is satisfied with our response time. Two customers want a written incident report — drafting now.', created: '2026-06-19' },
    ],
    created: '2026-06-16', updated: '2026-06-20',
  },
  // ──── Onboarding & UX ────
  {
    key: 'NX-125', summary: 'Redesign Onboarding — Time to First Dashboard Under 5 Minutes', type: 'Story',
    status: 'In Progress', priority: 'Medium', assignee: 'Lena Park', reporter: 'Sarah Chen',
    sprint: 'Sprint 14', labels: ['onboarding', 'ux', 'activation'],
    description: `Current onboarding takes 23 minutes on average. Target: under 5 minutes to first dashboard.

Current flow (23 min avg):
1. Sign up (email + password)
2. Email verification (many users drop here — 34% fail to verify within 24h)
3. Company details form (12 fields)
4. Invite team members
5. Install SDK (requires developer)
6. Wait for first events (variable — hours to days)
7. Create first dashboard from scratch

Proposed flow (5 min target):
1. Sign up with Google SSO (1 click)
2. Company name only (1 field)
3. Auto-detect SDK if common platforms (Segment, Amplitude re-route)
4. Show demo dashboard with synthetic data immediately
5. Guide SDK installation with in-app wizard + verification
6. Dashboard auto-populates when real events arrive

Key metric: activation rate (% of signups who create a dashboard within 7 days)
• Current: 31%
• Target: 55%
• Benchmark: Mixpanel (48%), Amplitude (52%), PostHog (44%)

Design principle: "Show value before asking for investment." The user should see a working dashboard before they install anything.`,
    comments: [
      { author: 'Lena Park', body: 'Prototype ready in Figma: https://figma.com/file/nexus-onboarding-v2\n\nKey design decisions:\n1. Demo dashboard uses a fictional e-commerce dataset — relatable for most PMs\n2. "Your data will appear here" placeholder cards that animate when first real event arrives\n3. SDK installation wizard supports: JavaScript, React, Next.js, Python, Ruby, iOS, Android\n4. Copy-paste code snippets with syntax highlighting\n5. Real-time event debugger (shows events as they arrive, like Segment debugger)', created: '2026-06-18' },
      { author: 'Tom Wilson', body: 'Tested prototype with 5 internal users (non-engineering). Average time to demo dashboard: 2 minutes 15 seconds. SDK installation: varies by platform (React: 4 min, Python: 3 min, vanilla JS: 2 min). Total under 7 min in all cases. Close to target.', created: '2026-06-20' },
    ],
    created: '2026-06-15', updated: '2026-06-22',
  },
  {
    key: 'NX-130', summary: 'API Rate Limiting and Throttling Strategy', type: 'Task',
    status: 'Done', priority: 'Medium', assignee: 'Raj Patel', reporter: 'Raj Patel',
    sprint: 'Sprint 13', labels: ['api', 'security', 'infrastructure'],
    description: `Implement rate limiting across all API endpoints. Currently no rate limiting — a single bad actor or buggy SDK can DDoS us.

Rate limit tiers:
| Endpoint category | Free | Pro | Enterprise |
|-------------------|------|-----|-----------|
| Event ingestion | 100/sec | 1,000/sec | 10,000/sec |
| Dashboard queries | 10/sec | 50/sec | 200/sec |
| Management API | 5/sec | 20/sec | 100/sec |
| Auth endpoints | 10/min | 10/min | 10/min |
| Export/bulk operations | 5/min | 20/min | 60/min |

Implementation:
• Token bucket algorithm via Redis (consistent across all server instances)
• Rate limit headers on every response: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
• 429 Too Many Requests response with Retry-After header
• Per-workspace limits (not per-user) for event ingestion
• Per-user limits for management API

Special cases:
• Webhook retries exempt from rate limits (tracked separately)
• Health check endpoints (/health, /ready) exempt
• Internal service-to-service calls exempt (verified by mTLS)`,
    comments: [
      { author: 'Raj Patel', body: 'Deployed. Redis-based token bucket using @upstash/ratelimit. Tested with k6: 5000 req/sec sustained for 10 minutes, rate limiter correctly throttles above tier limits. Latency overhead: <2ms per request.\n\nMonitoring: Datadog dashboard shows rate-limited requests by workspace. Alert if any workspace hits >80% of their limit for >5 minutes.', created: '2026-06-10' },
    ],
    created: '2026-06-05', updated: '2026-06-10',
  },
  {
    key: 'NX-132', summary: 'Customer Health Score Dashboard for CS Team', type: 'Story',
    status: 'In Progress', priority: 'Medium', assignee: 'Priya Sharma', reporter: 'Nina Kowalski',
    sprint: 'Sprint 15', labels: ['cs', 'analytics', 'churn'],
    description: `Build an internal dashboard for the CS team to monitor customer health and predict churn risk.

Health score formula (0-100):
| Signal | Weight | Measurement |
|--------|--------|-------------|
| Product usage | 30% | DAU/MAU ratio × events per user |
| Feature adoption | 20% | % of features used out of available |
| Support tickets | 15% | Inverse of ticket frequency + severity |
| NPS score | 15% | Last survey response (decays over 90 days) |
| Contract value trend | 10% | MoM change in usage-based charges |
| Engagement recency | 10% | Days since last login (inverse, capped at 30) |

Risk categories:
• 80-100: Healthy (green) — nurture, upsell opportunities
• 60-79: Neutral (yellow) — proactive check-in recommended
• 40-59: At Risk (orange) — CS manager assigns dedicated account rep
• 0-39: Critical (red) — escalate to VP CS, retention offer authorized

Data sources: product analytics (our own), Stripe (billing), Intercom (support), Delighted (NPS).

Dashboard views:
1. Portfolio overview (all customers, sortable by health score)
2. Individual customer deep-dive (score breakdown, trend, key events)
3. Cohort analysis (health by plan, industry, company size)
4. Predicted churn list (customers trending downward over 30 days)`,
    comments: [
      { author: 'Nina Kowalski', body: 'This is critical. We lost 3 enterprise customers last quarter that showed declining usage for weeks before churning. If we had this dashboard, CS could have intervened earlier.\n\nOne addition: can we add a "last CS touchpoint" field? I want to see which at-risk customers haven\'t heard from us recently.', created: '2026-06-20' },
      { author: 'Priya Sharma', body: 'Added "last CS touchpoint" from Intercom conversation data. Also adding: days until contract renewal (from Stripe subscription) — at-risk customers near renewal are highest priority.', created: '2026-06-21' },
    ],
    created: '2026-06-18', updated: '2026-06-22',
  },
  {
    key: 'NX-140', summary: 'Accessibility Audit — WCAG 2.1 AA Compliance', type: 'Task',
    status: 'To Do', priority: 'Medium', assignee: 'Lena Park', reporter: 'Lena Park',
    sprint: 'Sprint 16', labels: ['accessibility', 'compliance', 'ux'],
    description: `Full accessibility audit against WCAG 2.1 AA standards. Required for enterprise sales (SOC 2 customers often require VPAT).

Known issues from preliminary scan (Axe DevTools):
1. Dashboard charts have no alt text or data tables
2. Color contrast fails on 4 UI elements (gray text on light backgrounds)
3. Keyboard navigation broken in modal dialogs (focus trap missing)
4. Screen reader announces "button button" on icon-only buttons (duplicate roles)
5. Form error messages not linked to inputs via aria-describedby
6. Custom dropdown components not keyboard navigable
7. Live region updates (dashboard refresh) not announced
8. Skip navigation link missing

Estimated effort: 3-4 sprints for full compliance across all views.

Priority order:
1. Keyboard navigation (blocks all keyboard users)
2. Screen reader support (blocks all screen reader users)
3. Color contrast (affects low-vision users)
4. ARIA attributes (improves screen reader experience)
5. Chart accessibility (complex — needs data table alternatives)`,
    comments: [],
    created: '2026-06-22', updated: '2026-06-22',
  },
  {
    key: 'NX-145', summary: 'SOC 2 Type II Audit Preparation', type: 'Epic',
    status: 'To Do', priority: 'High', assignee: null, reporter: 'Sarah Chen',
    sprint: null, labels: ['security', 'compliance', 'soc2', 'enterprise'],
    description: `Prepare for SOC 2 Type II certification. Three enterprise prospects (Acme Corp $120K ARR, TechFlow $85K ARR, DataViz $65K ARR) have made SOC 2 a deal-breaker.

Combined pipeline value blocked by SOC 2: $270K ARR.

SOC 2 Trust Service Criteria to address:
| Criteria | Current status | Gap |
|----------|---------------|-----|
| Security | Partial | Need formal incident response plan, vulnerability scanning |
| Availability | Partial | Need SLA documentation, uptime monitoring, disaster recovery plan |
| Confidentiality | Weak | Need data classification policy, encryption audit, access reviews |
| Processing Integrity | Weak | Need change management process, code review policy |
| Privacy | Not started | Need privacy policy, data retention policy, DSAR process |

Key deliverables:
1. Information Security Policy (umbrella document)
2. Risk Assessment (annual)
3. Incident Response Plan
4. Business Continuity / Disaster Recovery Plan
5. Vendor Management Policy
6. Employee Security Awareness Training
7. Access Review Process (quarterly)
8. Vulnerability Management Program
9. Change Management Process
10. Data Classification Policy

Timeline: auditor engagement in October, observation period Nov-Jan, report by February.
Estimated cost: $15K-25K for auditor + $5K for tooling (Vanta or Drata for continuous monitoring).`,
    comments: [
      { author: 'Sarah Chen', body: 'Met with Vanta sales. Their platform automates ~70% of evidence collection. $6K/year. Drata is $8K/year but has better Jira integration. Leaning Vanta for cost.\n\nKey decision: do we want SOC 2 Type I first (point-in-time, faster, cheaper) or go straight for Type II (observation period, more valuable)? Type I takes ~2 months, Type II takes ~6 months. Enterprise buyers specifically ask for Type II.\n\nRecommendation: go straight for Type II. Type I doesn\'t satisfy our enterprise pipeline and we\'d just redo the work.', created: '2026-06-22' },
    ],
    created: '2026-06-20', updated: '2026-06-22',
  },
]

const SLACK_MESSAGES: Array<{
  channel: string; username: string; content: string; hasThread: boolean
  replies?: Array<{ username: string; content: string }>
  date: string
}> = [
  // ──── #product-decisions ────
  {
    channel: 'product-decisions', username: 'Sarah Chen', date: '2026-06-02',
    content: `Decision: We're going with usage-based pricing for Q3.

TL;DR: Moving from flat-rate tiers ($29/$99/custom) to usage-based model (platform fee + per-event + per-user). Keeping a $49/mo Pro plan with included usage as the "simple option."

Why:
1. 68% Starter→Growth churn is killing us — the $29→$99 jump is too steep
2. 40% of Growth customers hit event limits within 3 months
3. Enterprise pricing opacity slows sales (47-day avg cycle)
4. Competitors (Mixpanel, Amplitude) already moved to usage-based

What this means:
• Engineering: NX-107 (Stripe metered billing) starts Sprint 15
• Design: pricing page redesign needed
• CS: existing customers get 6-month grandfather period on current plans
• Sales: new pricing effective August 1 for new customers

Dissenting view from @Nina: some small teams just want a flat number to expense. Addressed by keeping $49/mo Pro plan with generous included usage.

Full details in the pricing spec: NX-106.`,
    hasThread: true,
    replies: [
      { username: 'Raj Patel', content: 'Engineering-wise, this means we need the Stripe metered billing integration (NX-107) done before August 1. That\'s tight but doable if Marcus starts now. Main risk: proration edge cases.' },
      { username: 'Nina Kowalski', content: 'Appreciate the Pro plan compromise. One more ask: can we add a real-time usage dashboard for customers? "You\'ve used 342K of 500K events this month" — like AWS billing dashboard. Prevents bill shock.' },
      { username: 'Sarah Chen', content: 'Yes, usage dashboard is in NX-107 scope. Good call on the AWS billing comparison — that\'s exactly the UX we want.' },
      { username: 'Marcus Johnson', content: 'Quick heads up: I found the proration bug (NX-110) while scoping NX-107. Current Stripe webhook handler doesn\'t process mid-cycle plan changes correctly. Need to fix this first or usage-based billing will have the same issue.' },
    ],
  },
  {
    channel: 'product-decisions', username: 'Sarah Chen', date: '2026-06-15',
    content: `Decision: Mobile v2 will be read-only. No dashboard editing on mobile.

After Lena's user research (8 PM interviews), the #1 mobile use case is "check metrics before a meeting." Nobody is creating dashboards on their phone.

This lets us:
1. Ship mobile v2 in 8 weeks instead of 14
2. Focus the UX on glanceable KPI cards (Lena's insight)
3. Skip the complexity of mobile drag-and-drop for dashboard builder
4. Avoid syncing edit conflicts between mobile and web

Dashboard editing stays web-only for v2. We'll revisit for v3 if user feedback demands it.

This aligns with our "mobile = consumption, desktop = creation" philosophy. Amplitude and Mixpanel try to cram desktop into mobile and it's terrible.`,
    hasThread: true,
    replies: [
      { username: 'Lena Park', content: 'From the interviews: 7 of 8 PMs said they\'ve never even tried to create a dashboard on their phone. The one who did said "it was painful and I gave up." Read-only is the right call.' },
      { username: 'Raj Patel', content: '+1. This also simplifies the offline-first architecture significantly. Read-only cache is much simpler than bidirectional sync.' },
    ],
  },
  {
    channel: 'product-decisions', username: 'Sarah Chen', date: '2026-06-20',
    content: `Decision: Going straight for SOC 2 Type II. Skipping Type I.

Context: $270K ARR pipeline blocked by SOC 2 (Acme, TechFlow, DataViz).

Options evaluated:
1. Type I first, then Type II — faster initial cert, but we'd redo work. ~$20K total.
2. Straight to Type II — 6 months, one audit. ~$20K total.
3. Skip SOC 2, pursue ISO 27001 instead — more global recognition but not what US enterprise buyers ask for.

Going with #2. Type I doesn't satisfy our enterprise pipeline and we'd just redo the work. Using Vanta ($6K/yr) for continuous monitoring.

Timeline: auditor engagement October, observation Nov-Jan, report February.`,
    hasThread: false,
    replies: [],
  },
  // ──── #engineering ────
  {
    channel: 'engineering', username: 'Raj Patel', date: '2026-06-08',
    content: `Architecture Decision Record: PostgreSQL Migration

We're migrating from MySQL 5.7 to PostgreSQL 15. This is final — I've evaluated the options and discussed with the team.

Why not just upgrade MySQL to 8.0?
• MySQL 8.0 JSON support is still inferior to PostgreSQL JSONB (no partial updates, weaker indexing)
• We'd still need a separate vector DB for AI features — pgvector eliminates this
• PostgreSQL full-text search (tsvector) is significantly better than MySQL FULLTEXT
• Most of our ORM queries are database-agnostic anyway (Prisma)

Migration approach: pgloader for schema + data, dual-write period, shadow reads, cutover.

Key risks:
1. GROUP_CONCAT → STRING_AGG differences in 14 queries (Marcus handling)
2. ENUM → CHECK constraint conversion (3 tables)
3. Auto-increment → SERIAL behavioral differences in concurrent inserts
4. Connection pooling config change (PgBouncer vs MySQL connection limits)

Expected downtime: zero (dual-write + read cutover). Rollback window: 30 days (MySQL replica stays hot).

Priya is leading. See NX-103 for full details.`,
    hasThread: true,
    replies: [
      { username: 'Marcus Johnson', content: '11 of 14 GROUP_CONCAT queries converted. The remaining 3 use ORDER BY inside GROUP_CONCAT which STRING_AGG handles differently. Working on those today.' },
      { username: 'Priya Sharma', content: 'pgloader dry run done. 44/47 tables clean. 3 need manual work (events JSON, user_preferences ENUM, api_keys binary). Full migration: ~45 min for 2.3M rows.' },
      { username: 'Alex Rivera', content: 'PgBouncer config ready for staging. Using transaction pooling mode. Connection limits: 100 per service (vs MySQL\'s 150 total). Should be fine for our scale.' },
    ],
  },
  {
    channel: 'engineering', username: 'Marcus Johnson', date: '2026-06-06',
    content: `PSA: Found the WebSocket memory leak (NX-105). Root cause: when a client disconnects during a data push, the interval timer isn't cleared. Orphaned intervals hold references to connection objects and data buffers. Memory grows linearly from 512MB to 4GB over ~18 hours.

Fix: clear all timers and listeners in the close handler. Also adding heartbeat ping/pong (30s) to detect zombie connections, and a max connection limit (1000 per server).

PR is up: #847. This was causing the OOM crashes — 3 incidents this week.

Lesson learned: always clean up timers in WebSocket close handlers. Adding this to our code review checklist.`,
    hasThread: true,
    replies: [
      { username: 'Tom Wilson', content: 'Load tested the fix: 200 concurrent connections for 6 hours, memory stable at 680MB (±30MB). Ship it.' },
      { username: 'Alex Rivera', content: 'Added Datadog alert: pod RSS > 2GB = page oncall. Previous threshold was 3.5GB which was too late.' },
      { username: 'Raj Patel', content: 'Good catch. Merging. Also: can we add a `ws.readyState` check before writing? Belt and suspenders against similar issues.' },
    ],
  },
  {
    channel: 'engineering', username: 'Priya Sharma', date: '2026-06-12',
    content: `Kafka vs RabbitMQ for the real-time pipeline (NX-116):

Evaluated both for our event streaming use case. Going with Kafka (Confluent Cloud).

Comparison:
• Throughput: Kafka wins handily at our scale (5K events/sec target). RabbitMQ would need complex clustering.
• Retention: Kafka stores events for replay (critical for our re-processing use case). RabbitMQ is fire-and-forget by default.
• Ordering: Kafka guarantees order within a partition. Perfect for per-workspace ordering.
• Consumer groups: Kafka's consumer group model fits our multiple-aggregation pattern. Each Flink job is a consumer group.
• Operational complexity: RabbitMQ is simpler for small scale, but Confluent Cloud abstracts Kafka ops.

Cost comparison:
• Confluent Cloud: $850/mo current, ~$2,100/mo at 100M events/day
• CloudAMQP (RabbitMQ): $500/mo current, but would need custom sharding at scale (~$3,000/mo)

Decision: Confluent Cloud. More expensive now but scales better and the replay capability is essential for data recovery (we learned this the hard way with the Unicode bug).`,
    hasThread: true,
    replies: [
      { username: 'Raj Patel', content: 'Agree with Kafka. The replay capability alone justifies the cost. When we had the Unicode bug (NX-120), if we had Kafka, recovery would have been "replay from offset" instead of "re-process from S3 archive."' },
      { username: 'Alex Rivera', content: 'Confluent Cloud provisioned. 3 brokers, multi-AZ, us-east-1. Topic created: nexus.events.raw (12 partitions, 7-day retention). Schema Registry set up for Avro event schema validation.' },
    ],
  },
  {
    channel: 'engineering', username: 'Alex Rivera', date: '2026-06-13',
    content: `Terraform modules deployed. Full infrastructure summary:

Staging: $342/mo
• EKS: 2x t3.medium nodes
• RDS PostgreSQL 15: single-AZ, db.t3.medium
• Redis: single node, cache.t3.small
• S3: 3 buckets (uploads, backups, assets)

Production (provisioned, not active yet): $1,847/mo
• EKS: 3x t3.large nodes (auto-scale to 6)
• RDS PostgreSQL 15: Multi-AZ, db.r6g.large
• Redis: cluster mode, 3x cache.r6g.large
• CloudFront + WAF
• 30-day backup retention

Safety: production terraform destroy requires TF_VAR_confirm_destroy=yes-i-am-sure. Sentinel policies block: public S3 buckets, unencrypted RDS, open security groups.

All state in S3 with DynamoDB locking. Separate state files per environment.`,
    hasThread: false,
    replies: [],
  },
  // ──── #design ────
  {
    channel: 'design', username: 'Lena Park', date: '2026-06-18',
    content: `Mobile v2 navigation structure (from user research):

Interviewed 8 PMs about mobile analytics usage. Key findings:
1. #1 use case: "Check numbers before a meeting" (7/8 mentioned this)
2. Average mobile session: 47 seconds
3. Nobody creates dashboards on mobile
4. Most wanted: KPI summary screen, not full dashboard view
5. Offline matters: "I check metrics in the elevator on the way to the meeting room"

Proposed nav:
• Home → KPI cards (4-6 configurable metrics, big numbers, sparkline trends)
• Dashboards → List of all dashboards → Dashboard detail (scroll, no edit)
• Search → Full-text search across dashboards and saved queries
• No settings on mobile — account management stays on web

Design system: extending our web component library to React Native. Shared design tokens (colors, spacing, typography). Native feel on each platform (iOS uses SF Pro, Android uses Roboto).

Figma link: https://figma.com/file/nexus-mobile-v2`,
    hasThread: true,
    replies: [
      { username: 'Sarah Chen', content: 'Love the KPI cards concept. That 47-second avg session stat is gold — design for that timeframe. If someone can\'t get their answer in under a minute, the mobile app has failed.' },
      { username: 'Tom Wilson', content: 'QA question: how do we test offline mode reliably? Airplane mode testing is flaky. Proposing we use Charles Proxy to simulate network conditions (slow 3G, intermittent, full offline).' },
    ],
  },
  {
    channel: 'design', username: 'Lena Park', date: '2026-06-22',
    content: `Accessibility audit — preliminary findings from Axe DevTools:

8 issues found across 12 pages scanned:

Critical (blocks users):
1. Dashboard charts: no alt text, no data table alternative. Screen reader users see nothing.
2. Modal dialogs: no focus trap. Tab key escapes the modal into background content.
3. Custom dropdowns: not keyboard navigable. Arrow keys don't work.

Serious:
4. Color contrast: 4 UI elements fail AA ratio (gray text on light bg, need 4.5:1, currently 3.2:1)
5. Icon-only buttons announce "button button" (duplicate ARIA roles)
6. Form errors not linked to inputs (missing aria-describedby)

Moderate:
7. Live data updates not announced (missing aria-live region)
8. No skip-navigation link

Estimate: 3-4 sprints for full WCAG 2.1 AA compliance.

Priority recommendation: keyboard navigation first (unblocks all keyboard users), then screen reader, then contrast. Charts are the hardest — needs data table alternatives for every chart type.`,
    hasThread: true,
    replies: [
      { username: 'Sarah Chen', content: 'This is important for SOC 2 and enterprise sales. Let\'s tackle the critical items (keyboard nav + screen reader) in Sprint 16. Contrast and charts can be Sprint 17.' },
      { username: 'Raj Patel', content: 'For chart accessibility: D3 has an a11y module that generates data tables from chart data. We could auto-generate a hidden table for each chart and make it screen-reader accessible via aria-describedby.' },
    ],
  },
  // ──── #incidents ────
  {
    channel: 'incidents', username: 'Alex Rivera', date: '2026-06-06',
    content: `🔴 INCIDENT: Production OOM — 3rd occurrence this week

Timeline:
• 14:22 UTC — Datadog alert: pod nexus-api-7f8d (RSS > 3.5GB)
• 14:23 UTC — Pod OOM killed by K8s
• 14:24 UTC — Load balancer routes to remaining 2 pods
• 14:25 UTC — Cascading: second pod hits 3.2GB (absorbing redirected connections)
• 14:27 UTC — Second pod OOM killed
• 14:28 UTC — Single pod serving all traffic, degraded performance
• 14:30 UTC — Marcus identifies WebSocket memory leak (NX-105)
• 14:32 UTC — Manual pod restart, 3 pods healthy
• 14:45 UTC — Root cause confirmed, hotfix PR opened

Impact:
• 8 minutes of degraded performance
• ~200 affected users (dashboard live updates frozen)
• No data loss

Root cause: WebSocket close handler doesn't clear interval timers. See NX-105.
Fix: PR #847, merged and deployed by 15:30 UTC.

Action items:
• [DONE] Lower Datadog memory alert threshold from 3.5GB to 2GB
• [DONE] Add WebSocket connection count metric
• [DONE] Add timer cleanup to close handler
• [TODO] Add connection limit per pod (1000 max)
• [TODO] Add graceful shutdown handler (SIGTERM → close all WS connections)`,
    hasThread: true,
    replies: [
      { username: 'Tom Wilson', content: 'Confirmed: post-fix, 6-hour load test with 200 concurrent WS connections shows stable memory at 680MB. No leak.' },
      { username: 'Sarah Chen', content: 'Third OOM in a week is not acceptable. Can we add this to our sprint retro? Process question: why wasn\'t the memory leak caught in staging?' },
      { username: 'Raj Patel', content: 'Staging doesn\'t run long enough with enough connections to trigger it. Adding a nightly soak test to CI: 100 WS connections for 4 hours. If memory grows >1.5GB, fail the build.' },
    ],
  },
  {
    channel: 'incidents', username: 'Priya Sharma', date: '2026-06-16',
    content: `🟡 INCIDENT: ETL dropping Unicode records (NX-120)

Not a production outage but a data integrity issue.

Discovery: Customer "Würzburg Analytics GmbH" reported ~15% lower event counts than expected. Investigation revealed our ETL aggregation script strips non-ASCII characters via regex, dropping entire records where property values contain Unicode.

Scope:
• ~3.2% of all events affected
• 14 workspaces with international users
• ~180K events lost over 90 days
• $4,200 in overcharges from incorrect usage metering (refunded)

Root cause: Overly aggressive regex sanitizer in aggregation script. Leftover from early prototype that used string concatenation for SQL. We switched to parameterized queries months ago but never removed the sanitizer.

Fix: Remove regex sanitizer. Already using parameterized queries.
Recovery: Re-process 90 days of raw event logs from S3 archive (6 hours).

Lesson: code archaeology — legacy "safety" code can become a hazard when the system it was protecting against (string concatenation SQL) no longer exists.`,
    hasThread: true,
    replies: [
      { username: 'Nina Kowalski', content: 'All 14 affected customers notified. Würzburg Analytics is satisfied. Two customers want written incident reports — will send by EOD.' },
      { username: 'Sarah Chen', content: 'This impacted our usage-based billing accuracy. Adding a data integrity check to the billing pipeline: compare raw event counts (S3) vs aggregated counts (DB) daily. If delta > 0.5%, alert.' },
    ],
  },
  // ──── #general ────
  {
    channel: 'general', username: 'Sarah Chen', date: '2026-06-01',
    content: `Q3 OKRs — final version after leadership review:

O1: Ship microservices architecture
• KR1: Deploy 3 core services (Auth, Analytics, Billing) to production by Sep 15
• KR2: Reduce deploy time from 4 hours to 15 minutes
• KR3: Achieve 99.9% uptime (currently 99.2%)

O2: Launch usage-based pricing
• KR1: New pricing live for all new customers by Aug 1
• KR2: 50% of existing customers migrated by Sep 30
• KR3: Average revenue per customer increases 15% (baseline: $67/mo)

O3: Mobile app v2
• KR1: Ship to App Store by Sep 15 (currently 2.1 stars, target 4.0)
• KR2: 30% of active users adopt mobile within 60 days of launch
• KR3: Offline mode works for top 3 use cases (KPI check, dashboard view, search)

O4: SOC 2 Type II preparation
• KR1: All 10 policy documents drafted by Aug 31
• KR2: Vanta continuous monitoring operational by Sep 15
• KR3: Auditor engagement signed by Oct 1`,
    hasThread: false,
    replies: [],
  },
  {
    channel: 'general', username: 'Sarah Chen', date: '2026-06-10',
    content: `All-hands recap — key announcements:

1. New hire: Priya Sharma joins as Data Engineer. She'll lead the real-time pipeline overhaul (NX-116). Previously at Datadog — knows event streaming at scale.

2. Q2 results: $48K MRR (up 12% QoQ). 847 active workspaces. NPS: 42 (up from 38). Churn: 5.2% monthly (target: <4%).

3. Enterprise pipeline: $270K ARR in late-stage deals, all blocked by SOC 2. Starting audit prep now (NX-145).

4. Product direction: Q3 is about platform maturity — microservices, usage-based pricing, mobile v2, SOC 2. Fewer new features, more infrastructure. "Build the foundation so Q4 features can ship 3x faster."

5. Team offsite: July 18-19 in Brooklyn. Strategy session + team building. Details from @Nina next week.`,
    hasThread: false,
    replies: [],
  },
  {
    channel: 'general', username: 'Nina Kowalski', date: '2026-06-18',
    content: `CS team update — top customer issues this month:

1. Proration bug on plan downgrades (NX-110) — 5 customers affected, $4,200 refunded. Fix in progress.
2. Dashboard load times (>10s for complex dashboards with 8+ charts). Engineering aware, tied to NX-116 pipeline overhaul.
3. "Can I share a dashboard with someone outside my workspace?" — No, not yet. Added to stretch roadmap.
4. Mobile app feedback: "I'd rather have no app than the current WebView." — v2 (NX-111) will address this.
5. Data accuracy concerns from international customers (Unicode bug, NX-120) — fix deployed, data recovery in progress.

Overall sentiment: customers are patient with us because they love the product, but the infrastructure issues (speed, billing accuracy, mobile quality) are eroding trust. Q3 priorities are exactly right.`,
    hasThread: true,
    replies: [
      { username: 'Sarah Chen', content: 'Thanks Nina. The "I\'d rather have no app" quote is painful but motivating. Adding it to the mobile v2 kickoff deck.' },
    ],
  },
  // ──── #standup ────
  {
    channel: 'standup', username: 'Raj Patel', date: '2026-06-20',
    content: `Standup — June 20

@Marcus: Auth migration (NX-102) — PR up for review. OAuth 2.0 + JWT flow working end-to-end. RBAC middleware passing all 23 test cases. MFA deferred to NX-135. Need: someone to review the refresh token rotation logic.

@Priya: PostgreSQL migration (NX-103) — 14/14 query conversions done. Testing dual-write setup. Unicode bug fix (NX-120) deployed, data recovery running (4 hours remaining).

@Alex: Monitoring dashboards for new K8s services done. Nightly soak test added to CI. Working on: production Terraform provisioning for Phase 2.

@Lena: Mobile v2 wireframes in Figma — ready for design review Monday. Accessibility audit results shared in #design — 8 issues found.

@Tom: QA test suites for auth migration — 23 test cases covering token expiry, refresh rotation, concurrent sessions, SSO. Staging environment request submitted.

Blockers:
• Need staging Google Workspace for SSO testing (Tom)
• Confluent Cloud Flink cluster needs upgrade for stream processing (Priya)`,
    hasThread: false,
    replies: [],
  },
]

function formatJiraContent(issue: typeof JIRA_ISSUES[0]): string {
  const parts: string[] = []
  parts.push(`Status: ${issue.status}`)
  parts.push(`Type: ${issue.type}`)
  parts.push(`Priority: ${issue.priority}`)
  if (issue.assignee) parts.push(`Assignee: ${issue.assignee}`)
  parts.push(`Reporter: ${issue.reporter}`)
  if (issue.labels.length) parts.push(`Labels: ${issue.labels.join(', ')}`)
  if (issue.sprint) parts.push(`Sprint: ${issue.sprint}`)

  let content = parts.join('\n') + '\n\n'
  content += `Description:\n${issue.description}\n\n`

  if (issue.comments.length) {
    content += 'Comments:\n'
    for (const c of issue.comments) {
      content += `[${c.author}]: ${c.body}\n\n`
    }
  }

  return content.trim()
}

function formatSlackContent(msg: typeof SLACK_MESSAGES[0]): string {
  let content = msg.content
  if (msg.hasThread && msg.replies && msg.replies.length > 0) {
    for (const reply of msg.replies) {
      content += `\n\n[Reply — ${reply.username}]: ${reply.content}`
    }
  }
  return content
}

export async function POST() {
  const userId = await getSession()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Create synthetic connections
  const { data: existingJira } = await supabaseServer
    .from('connection')
    .select('id')
    .eq('user_id', userId)
    .eq('source_type', 'jira')
    .eq('status', 'active')
    .single()

  const { data: existingSlack } = await supabaseServer
    .from('connection')
    .select('id')
    .eq('user_id', userId)
    .eq('source_type', 'slack')
    .eq('status', 'active')
    .single()

  let jiraConnId = existingJira?.id
  let slackConnId = existingSlack?.id

  if (!jiraConnId) {
    const { data } = await supabaseServer
      .from('connection')
      .insert({ user_id: userId, source_type: 'jira', status: 'active', oauth_token: 'synthetic', last_synced_at: new Date().toISOString() })
      .select('id')
      .single()
    jiraConnId = data?.id
  }

  if (!slackConnId) {
    const { data } = await supabaseServer
      .from('connection')
      .insert({ user_id: userId, source_type: 'slack', status: 'active', oauth_token: 'synthetic', last_synced_at: new Date().toISOString() })
      .select('id')
      .single()
    slackConnId = data?.id
  }

  if (!jiraConnId || !slackConnId) {
    return NextResponse.json({ error: 'Failed to create connections' }, { status: 500 })
  }

  let jiraDocs = 0
  let slackDocs = 0

  // Seed Jira issues
  for (const issue of JIRA_ISSUES) {
    const content = formatJiraContent(issue)
    const contentHash = hashContent(content)

    const { error } = await supabaseServer
      .from('document')
      .upsert(
        {
          connection_id: jiraConnId,
          source_type: 'jira',
          source_id: issue.key,
          source_url: `https://nexus-team.atlassian.net/browse/${issue.key}`,
          title: `${issue.key}: ${issue.summary}`,
          content,
          author: issue.reporter,
          doc_type: 'jira_issue',
          content_hash: contentHash,
          document_date: issue.updated,
        },
        { onConflict: 'connection_id,source_id' }
      )
    if (error) {
      console.error(`Jira seed error for ${issue.key}:`, error.message)
    } else {
      jiraDocs++
    }
  }

  // Seed Slack messages
  for (let i = 0; i < SLACK_MESSAGES.length; i++) {
    const msg = SLACK_MESSAGES[i]
    const content = formatSlackContent(msg)
    const sourceId = `${msg.channel}:${msg.date}:${i}`
    const contentHash = hashContent(content)

    const { error } = await supabaseServer
      .from('document')
      .upsert(
        {
          connection_id: slackConnId,
          source_type: 'slack',
          source_id: sourceId,
          source_url: `https://nexus-team.slack.com/archives/${msg.channel}/p${Date.parse(msg.date)}`,
          title: `#${msg.channel}`,
          content,
          author: msg.username,
          doc_type: 'slack_message',
          content_hash: contentHash,
          document_date: new Date(msg.date).toISOString(),
        },
        { onConflict: 'connection_id,source_id' }
      )
    if (!error) slackDocs++
  }

  // Update last_synced_at
  await supabaseServer.from('connection').update({ last_synced_at: new Date().toISOString() }).eq('id', jiraConnId)
  await supabaseServer.from('connection').update({ last_synced_at: new Date().toISOString() }).eq('id', slackConnId)

  return NextResponse.json({
    jira: { connectionId: jiraConnId, documents: jiraDocs },
    slack: { connectionId: slackConnId, documents: slackDocs },
  })
}
