'use client'

const ALL_TOOLS = [
  { key: 'google_drive', name: 'Google Drive', authUrl: '/api/auth/google-drive' },
  { key: 'slack', name: 'Slack', authUrl: null },
  { key: 'notion', name: 'Notion', authUrl: null },
  { key: 'jira', name: 'Jira', authUrl: null },
  { key: 'gmail', name: 'Gmail', authUrl: null },
  { key: 'figma', name: 'Figma', authUrl: null },
]

interface Connection {
  id: string
  source_type: string
  status: string
  last_synced_at: string | null
}

interface SettingsViewProps {
  user: { id: string; email: string; name: string; avatar_url?: string }
  connections: Connection[]
}

export default function SettingsView({ user, connections }: SettingsViewProps) {
  const connMap = new Map(connections.map((c) => [c.source_type, c]))

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <a href="/" className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors">
          Converge
        </a>
        <span className="text-sm text-gray-500">Settings</span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Profile</h2>
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-lg font-medium text-white">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Connected Tools</h2>
          <div className="space-y-3">
            {ALL_TOOLS.map((tool) => {
              const conn = connMap.get(tool.key)
              const isConnected = conn?.status === 'active'

              return (
                <div key={tool.key} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-600' : 'bg-gray-200'}`} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{tool.name}</p>
                      {isConnected && conn?.last_synced_at && (
                        <p className="text-xs text-gray-500">
                          Last synced: {new Date(conn.last_synced_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>

                  {isConnected ? (
                    <span className="rounded-md bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                      Connected
                    </span>
                  ) : tool.authUrl ? (
                    <a
                      href={tool.authUrl}
                      className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      Connect
                    </a>
                  ) : (
                    <span className="rounded-md bg-gray-50 px-3 py-1 text-xs text-gray-400">
                      Coming soon
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <button
          onClick={handleLogout}
          className="rounded-lg border border-red-600 px-4 py-2 text-sm text-red-600 transition-colors hover:bg-red-600 hover:text-white"
        >
          Sign out
        </button>
      </main>
    </div>
  )
}
