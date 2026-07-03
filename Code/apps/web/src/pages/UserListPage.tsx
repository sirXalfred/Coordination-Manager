import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiClient } from '../lib/api-client'
import { getPrimaryTimezone, formatDateInTimezone } from '../lib/timezone-data'
import {
  Users,
  Search,
  X,
  Shield,
  Eye,
  Globe,
  UserCircle,
  Mail,
  Wallet,
  VolumeX,
  Volume2,
  Loader2,
  AlertTriangle,
  CheckSquare,
  Square,
  Filter,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface UserRecord {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  roles: string[] | null
  account_type: string | null
  wallet_address: string | null
  stake_address: string | null
  traveler_name: string | null
  theme_preferences: { aiSettings?: { sentimentToolEnabled?: boolean } } | null
  is_silenced: boolean
  silenced_at: string | null
  silenced_by: string | null
  created_at: string
  last_login_at: string | null
  signup_source: string | null
}

type RoleValue = 'admin' | 'moderator' | 'user' | 'traveler' | 'oversight'
type StatusValue = 'active' | 'silenced'
type AccountValue = 'google' | 'cardano' | 'traveler' | 'linked'
type SourceValue = 'localhost' | 'production' | 'unknown'

export default function UserListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, session } = useAuth()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [roleFilters, setRoleFilters] = useState<Set<RoleValue>>(new Set())
  const [statusFilters, setStatusFilters] = useState<Set<StatusValue>>(new Set())
  const [accountFilters, setAccountFilters] = useState<Set<AccountValue>>(new Set())
  const [sourceFilters, setSourceFilters] = useState<Set<SourceValue>>(new Set(['production', 'unknown']))

  const toggleFilter = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter(prev => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [actionLoading, setActionLoading] = useState(false)
  const [showSilenceConfirm, setShowSilenceConfirm] = useState(false)
  const [silenceAction, setSilenceAction] = useState<'silence' | 'unsilence'>('silence')
  const [moderatorToggling, setModeratorToggling] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 20

  const isAdmin = user?.roles?.includes('admin')

  // Redirect non-admins or if block power isn't active
  useEffect(() => {
    if (!isAdmin) {
      navigate('/settings?tab=profile')
      return
    }
    try {
      const stored = localStorage.getItem('adminPowers')
      if (!stored || !JSON.parse(stored).blockPower) {
        navigate('/settings?tab=profile')
      }
    } catch {
      navigate('/settings?tab=profile')
    }
  }, [isAdmin, navigate])

  const fetchUsers = useCallback(async () => {
    if (!session?.access_token) return
    setLoading(true)
    setError(null)
    try {
      const res = await apiClient.get('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setUsers(res.data.users || [])
    } catch (err) {
      setError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const getUserRoles = (u: UserRecord): string[] => {
    const rolesArr = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ['user']
    const merged = new Set([...rolesArr])
    // Add oversight if user has sentimentToolEnabled in their AI settings
    if (u.theme_preferences?.aiSettings?.sentimentToolEnabled) {
      merged.add('oversight')
    }
    return Array.from(merged)
  }

  const getDisplayName = (u: UserRecord): string => {
    return u.display_name || u.traveler_name || u.email || u.id.slice(0, 8)
  }

  const hasLinkedWallet = (u: UserRecord): boolean => {
    return u.account_type === 'google' && !!u.wallet_address
  }

  const getAccountTypeLabel = (u: UserRecord): string => {
    if (hasLinkedWallet(u)) return 'Google + Cardano'
    if (u.account_type === 'traveler') return 'Traveler'
    if (u.account_type === 'cardano') return 'Cardano'
    if (u.account_type === 'google') return 'Google'
    return u.account_type || 'Unknown'
  }

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search filter: match against display name, email, ID, traveler name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const searchable = [
          u.display_name,
          u.email,
          u.id,
          u.traveler_name,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchable.includes(q)) return false
      }

      // Role filter (multi-select: user must have at least one of the selected roles)
      if (roleFilters.size > 0) {
        const roles = getUserRoles(u)
        if (!roles.some(r => roleFilters.has(r as RoleValue))) return false
      }

      // Account filter (multi-select: user must match at least one selected account type)
      if (accountFilters.size > 0) {
        const matchesAny = Array.from(accountFilters).some(f => {
          if (f === 'linked') return hasLinkedWallet(u)
          if (f === 'google') return u.account_type === 'google' && !hasLinkedWallet(u)
          return u.account_type === f
        })
        if (!matchesAny) return false
      }

      // Status filter (multi-select)
      if (statusFilters.size > 0) {
        const matchesAny = Array.from(statusFilters).some(f => {
          if (f === 'active') return !u.is_silenced
          if (f === 'silenced') return u.is_silenced
          return false
        })
        if (!matchesAny) return false
      }

      // Source filter (multi-select)
      if (sourceFilters.size > 0) {
        const src = u.signup_source || 'unknown'
        if (!sourceFilters.has(src as SourceValue)) return false
      }

      return true
    })
  }, [users, searchQuery, roleFilters, accountFilters, statusFilters, sourceFilters])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, roleFilters, accountFilters, statusFilters, sourceFilters])

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredUsers.slice(start, start + PAGE_SIZE)
  }, [filteredUsers, currentPage])

  const toggleSelect = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(paginatedUsers.map(u => u.id)))
    }
  }

  const handleSilenceAction = async () => {
    if (!session?.access_token || selectedUsers.size === 0) return
    setActionLoading(true)
    try {
      const endpoint = silenceAction === 'silence' ? '/api/admin/users/silence' : '/api/admin/users/unsilence'
      await apiClient.post(endpoint, {
        userIds: Array.from(selectedUsers),
      }, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      setShowSilenceConfirm(false)
      setSelectedUsers(new Set())
      await fetchUsers()
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || `Failed to ${silenceAction} users`)
    } finally {
      setActionLoading(false)
    }
  }

  const selectedContainsAdmin = useMemo(() => {
    return users.some(u => selectedUsers.has(u.id) && getUserRoles(u).includes('admin'))
  }, [users, selectedUsers])

  const selectedContainsSelf = selectedUsers.has(user?.id || '')

  const toggleModeratorRole = async (targetUser: UserRecord) => {
    if (!session?.access_token) return
    setModeratorToggling(targetUser.id)
    try {
      const currentRoles = getUserRoles(targetUser)
      const hasMod = currentRoles.includes('moderator')
      await apiClient.post('/api/admin/users/moderator', {
        userId: targetUser.id,
        enabled: !hasMod,
      }, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      await fetchUsers()
    } catch (err) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to update moderator role')
    } finally {
      setModeratorToggling(null)
    }
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'Never'
    return formatDateInTimezone(dateStr, getPrimaryTimezone())
  }

  if (!isAdmin) return null

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-7 w-7 text-red-500" />
        <h1 className="text-2xl font-bold">User List</h1>
        <span className="text-sm text-muted-foreground">({users.length} total)</span>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by name, email, or user ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-8 py-2 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex flex-col gap-3 mb-6">
        {/* Role Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Role</span>
          <button
            onClick={() => setRoleFilters(new Set())}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              roleFilters.size === 0
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            All
          </button>
          {([['admin', 'Admin'], ['moderator', 'Moderator'], ['oversight', 'Oversight'], ['user', 'User'], ['traveler', 'Traveler']] as [RoleValue, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => toggleFilter(setRoleFilters, value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                roleFilters.has(value)
                  ? value === 'admin'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-700'
                    : value === 'moderator'
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-300 dark:ring-indigo-700'
                    : value === 'oversight'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700'
                    : value === 'traveler'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                    : 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {value === 'admin' && <Shield className="w-3 h-3" />}
              {value === 'moderator' && <Shield className="w-3 h-3" />}
              {value === 'oversight' && <Eye className="w-3 h-3" />}
              {value === 'user' && <UserCircle className="w-3 h-3" />}
              {value === 'traveler' && <Globe className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>

        {/* Account Type Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Account</span>
          <button
            onClick={() => setAccountFilters(new Set())}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              accountFilters.size === 0
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            All
          </button>
          {([['google', 'Google'], ['linked', 'Google + Cardano'], ['cardano', 'Cardano'], ['traveler', 'Traveler']] as [AccountValue, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => toggleFilter(setAccountFilters, value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                accountFilters.has(value)
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {value === 'google' && <Mail className="w-3 h-3" />}
              {value === 'linked' && <><Mail className="w-3 h-3" /><Wallet className="w-3 h-3" /></>}
              {value === 'cardano' && <Wallet className="w-3 h-3" />}
              {value === 'traveler' && <Globe className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>

        {/* Source Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Source</span>
          <button
            onClick={() => setSourceFilters(new Set())}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              sourceFilters.size === 0
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            All
          </button>
          {([['localhost', 'Localhost'], ['production', 'Production'], ['unknown', 'Unknown']] as [SourceValue, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => toggleFilter(setSourceFilters, value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                sourceFilters.has(value)
                  ? value === 'localhost'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 ring-1 ring-orange-300 dark:ring-orange-700'
                    : value === 'production'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300 ring-1 ring-gray-300 dark:ring-gray-700'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Status</span>
          <button
            onClick={() => setStatusFilters(new Set())}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              statusFilters.size === 0
                ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            All
          </button>
          {([['active', 'Active'], ['silenced', 'Silenced']] as [StatusValue, string][]).map(([value, label]) => (
            <button
              key={value}
              onClick={() => toggleFilter(setStatusFilters, value)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                statusFilters.has(value)
                  ? value === 'silenced'
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 ring-1 ring-red-300 dark:ring-red-700'
                    : 'bg-primary/10 text-primary ring-1 ring-primary/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {value === 'silenced' && <VolumeX className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Selection Actions */}
      {selectedUsers.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
          <span className="text-sm font-medium text-red-700 dark:text-red-300">
            {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => {
                setSilenceAction('silence')
                setShowSilenceConfirm(true)
              }}
              disabled={selectedContainsAdmin || selectedContainsSelf}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title={selectedContainsAdmin ? 'Cannot silence admin accounts' : selectedContainsSelf ? 'Cannot silence yourself' : 'Silence selected users'}
            >
              <VolumeX className="w-3.5 h-3.5" />
              Silence
            </button>
            <button
              onClick={() => {
                setSilenceAction('unsilence')
                setShowSilenceConfirm(true)
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 border border-border rounded-lg transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Unsilence
            </button>
            <button
              onClick={() => setSelectedUsers(new Set())}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading users...</span>
        </div>
      )}

      {/* Results Summary */}
      {!loading && !error && (
        <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
          <Filter className="w-3.5 h-3.5" />
          Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredUsers.length)}-{Math.min(currentPage * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users
          {filteredUsers.length !== users.length && ` (${users.length} total)`}
        </div>
      )}

      {/* User Table */}
      {!loading && !error && filteredUsers.length > 0 && (
        <div className="border border-border rounded-lg overflow-clip">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted/95 dark:bg-muted/95 backdrop-blur-sm border-b border-border">
                  <th className="px-3 py-3 text-left w-10">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground">
                      {selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0 ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left font-medium">User</th>
                  <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Account</th>
                  <th className="px-3 py-3 text-left font-medium">Roles</th>
                  <th className="px-3 py-3 text-left font-medium hidden md:table-cell">Source</th>
                  <th className="px-3 py-3 text-left font-medium hidden lg:table-cell">Created</th>
                  <th className="px-3 py-3 text-left font-medium hidden lg:table-cell">Last Login</th>
                  <th className="px-3 py-3 text-left font-medium w-24">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors ${
                      u.is_silenced ? 'bg-red-50/50 dark:bg-red-950/10' : ''
                    } ${selectedUsers.has(u.id) ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <button onClick={() => toggleSelect(u.id)} className="text-muted-foreground hover:text-foreground">
                        {selectedUsers.has(u.id) ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium overflow-hidden shrink-0 bg-gradient-to-br from-blue-500 to-purple-500">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            getDisplayName(u).charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{getDisplayName(u)}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={u.id}>{u.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        {hasLinkedWallet(u) ? (
                          <><Mail className="w-3 h-3" /><Wallet className="w-3 h-3" /></>
                        ) : (
                          <>
                            {u.account_type === 'google' && <Mail className="w-3 h-3" />}
                            {u.account_type === 'traveler' && <Globe className="w-3 h-3" />}
                            {u.account_type === 'cardano' && <Wallet className="w-3 h-3" />}
                          </>
                        )}
                        {getAccountTypeLabel(u)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1 items-center">
                        {getUserRoles(u).map((r) => (
                          <span key={r} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            r === 'admin'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                              : r === 'moderator'
                              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                              : r === 'oversight'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : r === 'traveler'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          }`}>
                            {r === 'admin' && <Shield className="w-2.5 h-2.5" />}
                            {r === 'moderator' && <Shield className="w-2.5 h-2.5" />}
                            {r === 'oversight' && <Eye className="w-2.5 h-2.5" />}
                            {r === 'traveler' && <Globe className="w-2.5 h-2.5" />}
                            {r === 'user' && <UserCircle className="w-2.5 h-2.5" />}
                            {r}
                          </span>
                        ))}
                        {/* Moderator toggle button */}
                        {!getUserRoles(u).includes('admin') && (
                          <button
                            onClick={() => toggleModeratorRole(u)}
                            disabled={moderatorToggling === u.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                              getUserRoles(u).includes('moderator')
                                ? 'border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                            } disabled:opacity-50`}
                            title={getUserRoles(u).includes('moderator') ? 'Remove moderator role' : 'Grant moderator role'}
                          >
                            <Shield className="w-2.5 h-2.5" />
                            {moderatorToggling === u.id ? '...' : getUserRoles(u).includes('moderator') ? 'Remove Mod' : '+ Mod'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {u.signup_source === 'localhost' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                          Localhost
                        </span>
                      ) : u.signup_source === 'production' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                          Production
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400">
                          Unknown
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">
                      {formatDate(u.last_login_at)}
                    </td>
                    <td className="px-3 py-3">
                      {u.is_silenced ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          <VolumeX className="w-3 h-3" />
                          Silenced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center px-2 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .reduce<(number | 'ellipsis')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('ellipsis')
                acc.push(p)
                return acc
              }, [])
              .map((item, i) =>
                item === 'ellipsis' ? (
                  <span key={`e${i}`} className="px-1.5 text-muted-foreground">...</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item as number)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      currentPage === item
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    {item}
                  </button>
                )
              )}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center px-2 py-1.5 rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-border bg-background hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No users match your filters.</p>
        </div>
      )}

      {/* Silence Confirmation Modal */}
      {showSilenceConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground rounded-lg p-6 max-w-md mx-4 shadow-xl border border-border">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className={`w-5 h-5 ${silenceAction === 'silence' ? 'text-red-500' : 'text-amber-500'}`} />
              <h2 className="text-lg font-bold">
                {silenceAction === 'silence' ? 'Silence Users?' : 'Unsilence Users?'}
              </h2>
            </div>
            {silenceAction === 'silence' ? (
              <div className="text-sm text-muted-foreground space-y-2 mb-6">
                <p>
                  You are about to silence <strong>{selectedUsers.size}</strong> user{selectedUsers.size !== 1 ? 's' : ''}.
                </p>
                <p>Silenced users will:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Lose access to key platform features</li>
                  <li>Have all public calendars set to unlisted</li>
                  <li>Not be able to create new public content</li>
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-6">
                Restore access for <strong>{selectedUsers.size}</strong> user{selectedUsers.size !== 1 ? 's' : ''}?
                Their account restrictions will be removed.
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSilenceConfirm(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-muted-foreground bg-muted rounded-lg hover:bg-muted/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSilenceAction}
                disabled={actionLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  silenceAction === 'silence' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  silenceAction === 'silence' ? 'Silence' : 'Unsilence'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
