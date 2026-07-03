import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, Loader2, Network, Sparkles, Palette } from 'lucide-react'
import { apiClient } from '../lib/api-client'
import { useToast } from '../components/Toast'

// ─── Types ──────────────────────────────────────────────────

interface NetworkDef {
  id: string
  name: string
  color: string
  description: string | null
}

interface NetworkMapping {
  id: string
  network_id: string
  source_string: string
  source_type: 'calendar_title' | 'meeting_title' | 'description'
}

interface NetworkRule {
  id: string
  network_id: string
  pattern: string
  match_type: 'contains' | 'starts_with' | 'exact' | 'regex'
  match_field: 'calendar_title' | 'meeting_title' | 'description'
  priority: number
  is_active: boolean
}

const COLOR_PRESETS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#14B8A6',
  '#6366F1', '#D946EF', '#0EA5E9', '#22C55E', '#A855F7',
]

// ─── Component ──────────────────────────────────────────────

export default function NetworkRelationsPage() {
  const { showToast } = useToast()
  const [networks, setNetworks] = useState<NetworkDef[]>([])
  const [mappings, setMappings] = useState<NetworkMapping[]>([])
  const [rules, setRules] = useState<NetworkRule[]>([])
  const [loading, setLoading] = useState(true)

  // New network form
  const [showNewNetwork, setShowNewNetwork] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3B82F6')
  const [newDesc, setNewDesc] = useState('')

  // Edit network
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // New mapping form
  const [showNewMapping, setShowNewMapping] = useState<string | null>(null) // network_id
  const [newMappingString, setNewMappingString] = useState('')
  const [newMappingType, setNewMappingType] = useState<'calendar_title' | 'meeting_title' | 'description'>('calendar_title')

  // New rule form
  const [showNewRule, setShowNewRule] = useState<string | null>(null) // network_id
  const [newRulePattern, setNewRulePattern] = useState('')
  const [newRuleMatchType, setNewRuleMatchType] = useState<'contains' | 'starts_with' | 'exact' | 'regex'>('contains')
  const [newRuleMatchField, setNewRuleMatchField] = useState<'calendar_title' | 'meeting_title' | 'description'>('calendar_title')
  const [newRulePriority, setNewRulePriority] = useState(0)

  // Expanded network sections
  const [expandedNetworks, setExpandedNetworks] = useState<Set<string>>(new Set())

  const fetchAll = useCallback(async () => {
    try {
      const [nRes, mRes, rRes] = await Promise.all([
        apiClient.get('/api/network-relations/networks'),
        apiClient.get('/api/network-relations/mappings'),
        apiClient.get('/api/network-relations/rules'),
      ])
      setNetworks(nRes.data.networks || [])
      setMappings(mRes.data.mappings || [])
      setRules(rRes.data.rules || [])
    } catch (err) {
      console.error('Failed to fetch network data:', err)
      showToast('Failed to load network data', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggleExpand = (id: string) => {
    setExpandedNetworks(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ─── Network CRUD ──────────────────────────────────────

  const createNetwork = async () => {
    if (!newName.trim()) return showToast('Name is required', 'error')
    try {
      await apiClient.post('/api/network-relations/networks', {
        name: newName.trim(),
        color: newColor,
        description: newDesc.trim() || null,
      })
      showToast('Network created')
      setShowNewNetwork(false)
      setNewName('')
      setNewColor('#3B82F6')
      setNewDesc('')
      fetchAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create network'
      showToast(msg, 'error')
    }
  }

  const startEdit = (net: NetworkDef) => {
    setEditingId(net.id)
    setEditName(net.name)
    setEditColor(net.color)
    setEditDesc(net.description || '')
  }

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return
    try {
      await apiClient.put(`/api/network-relations/networks/${editingId}`, {
        name: editName.trim(),
        color: editColor,
        description: editDesc.trim() || null,
      })
      showToast('Network updated')
      setEditingId(null)
      fetchAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update'
      showToast(msg, 'error')
    }
  }

  const deleteNetwork = async (id: string, name: string) => {
    if (!confirm(`Delete network "${name}" and all its mappings/rules?`)) return
    try {
      await apiClient.delete(`/api/network-relations/networks/${id}`)
      showToast('Network deleted')
      fetchAll()
    } catch {
      showToast('Failed to delete', 'error')
    }
  }

  // ─── Mapping CRUD ──────────────────────────────────────

  const createMapping = async (networkId: string) => {
    if (!newMappingString.trim()) return showToast('Source string is required', 'error')
    try {
      await apiClient.post('/api/network-relations/mappings', {
        network_id: networkId,
        source_string: newMappingString.trim(),
        source_type: newMappingType,
      })
      showToast('Mapping added')
      setShowNewMapping(null)
      setNewMappingString('')
      fetchAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create mapping'
      showToast(msg, 'error')
    }
  }

  const deleteMapping = async (id: string) => {
    try {
      await apiClient.delete(`/api/network-relations/mappings/${id}`)
      showToast('Mapping deleted')
      fetchAll()
    } catch {
      showToast('Failed to delete mapping', 'error')
    }
  }

  // ─── Rule CRUD ─────────────────────────────────────────

  const createRule = async (networkId: string) => {
    if (!newRulePattern.trim()) return showToast('Pattern is required', 'error')
    try {
      await apiClient.post('/api/network-relations/rules', {
        network_id: networkId,
        pattern: newRulePattern.trim(),
        match_type: newRuleMatchType,
        match_field: newRuleMatchField,
        priority: newRulePriority,
      })
      showToast('Rule added')
      setShowNewRule(null)
      setNewRulePattern('')
      setNewRulePriority(0)
      fetchAll()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create rule'
      showToast(msg, 'error')
    }
  }

  const deleteRule = async (id: string) => {
    try {
      await apiClient.delete(`/api/network-relations/rules/${id}`)
      showToast('Rule deleted')
      fetchAll()
    } catch {
      showToast('Failed to delete rule', 'error')
    }
  }

  const toggleRuleActive = async (rule: NetworkRule) => {
    try {
      await apiClient.put(`/api/network-relations/rules/${rule.id}`, {
        is_active: !rule.is_active,
      })
      fetchAll()
    } catch {
      showToast('Failed to toggle rule', 'error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/events-calendar" className="p-1.5 rounded-md hover:bg-accent/50 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Network className="w-5 h-5 text-sky-600" />
              Network Relations
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Map calendars and meetings to networks for consistent coloring and grouping.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowNewNetwork(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Network
        </button>
      </div>

      {/* New Network Form */}
      {showNewNetwork && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-card">
          <h3 className="text-sm font-semibold mb-3">Create Network</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Cardano Governance"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Color</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: c,
                      borderColor: newColor === c ? 'var(--foreground)' : 'transparent',
                      transform: newColor === c ? 'scale(1.15)' : 'scale(1)',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                  title="Custom color"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description (optional)</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={createNetwork} className="px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                Create
              </button>
              <button onClick={() => setShowNewNetwork(false)} className="px-4 py-2 rounded-md text-sm font-medium bg-muted hover:bg-muted/80 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Networks List */}
      {networks.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Network className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No networks defined yet</p>
          <p className="text-xs mt-1">Create a network to start grouping calendars and meetings.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {networks.map(net => {
            const isExpanded = expandedNetworks.has(net.id)
            const netMappings = mappings.filter(m => m.network_id === net.id)
            const netRules = rules.filter(r => r.network_id === net.id)
            const isEditing = editingId === net.id

            return (
              <div key={net.id} className="border border-border rounded-lg bg-card overflow-hidden">
                {/* Network header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => toggleExpand(net.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: net.color }} />
                    {isEditing ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-1 text-sm border border-border rounded bg-background w-40"
                          autoFocus
                        />
                        <div className="flex gap-1">
                          {COLOR_PRESETS.slice(0, 6).map(c => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className="w-5 h-5 rounded-full border transition-all"
                              style={{
                                backgroundColor: c,
                                borderColor: editColor === c ? 'var(--foreground)' : 'transparent',
                              }}
                            />
                          ))}
                        </div>
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="Description"
                          className="px-2 py-1 text-sm border border-border rounded bg-background w-48"
                        />
                        <button onClick={saveEdit} className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/30">
                          <Save className="w-4 h-4 text-green-600" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1 rounded hover:bg-muted">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <span className="font-semibold text-sm">{net.name}</span>
                        {net.description && (
                          <span className="text-xs text-muted-foreground ml-2">{net.description}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-muted-foreground">
                      {netMappings.length} mapping{netMappings.length !== 1 ? 's' : ''} &middot; {netRules.length} rule{netRules.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={() => startEdit(net)} className="p-1 rounded hover:bg-accent/50" title="Edit">
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => deleteNetwork(net.id, net.name)} className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30" title="Delete">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border p-3 space-y-4">
                    {/* Mappings section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5" />
                          Direct Mappings
                        </h4>
                        <button
                          onClick={() => { setShowNewMapping(net.id); setNewMappingString(''); setNewMappingType('calendar_title') }}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add mapping
                        </button>
                      </div>

                      {netMappings.length === 0 && !showNewMapping ? (
                        <p className="text-xs text-muted-foreground italic">No direct mappings yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {netMappings.map(m => (
                            <div key={m.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-accent/20">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">{m.source_type.replace('_', ' ')}</span>
                                <span className="truncate font-mono">{m.source_string}</span>
                              </div>
                              <button onClick={() => deleteMapping(m.id)} className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 shrink-0">
                                <Trash2 className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {showNewMapping === net.id && (
                        <div className="mt-2 flex items-center gap-2">
                          <select
                            value={newMappingType}
                            onChange={(e) => setNewMappingType(e.target.value as typeof newMappingType)}
                            className="px-2 py-1.5 text-xs border border-border rounded bg-background"
                          >
                            <option value="calendar_title">Calendar title</option>
                            <option value="meeting_title">Meeting title</option>
                            <option value="description">Description</option>
                          </select>
                          <input
                            value={newMappingString}
                            onChange={(e) => setNewMappingString(e.target.value)}
                            placeholder="Exact source string..."
                            className="flex-1 px-2 py-1.5 text-xs border border-border rounded bg-background"
                            autoFocus
                          />
                          <button onClick={() => createMapping(net.id)} className="px-2 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
                            Add
                          </button>
                          <button onClick={() => setShowNewMapping(null)} className="p-1 rounded hover:bg-muted">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Rules section */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Auto-Match Rules
                        </h4>
                        <button
                          onClick={() => { setShowNewRule(net.id); setNewRulePattern(''); setNewRuleMatchType('contains'); setNewRuleMatchField('calendar_title'); setNewRulePriority(0) }}
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add rule
                        </button>
                      </div>

                      {netRules.length === 0 && !showNewRule ? (
                        <p className="text-xs text-muted-foreground italic">No auto-match rules yet.</p>
                      ) : (
                        <div className="space-y-1">
                          {netRules.map(r => (
                            <div key={r.id} className={`flex items-center justify-between text-xs py-1 px-2 rounded ${r.is_active ? 'bg-accent/20' : 'bg-muted/30 opacity-60'}`}>
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">{r.match_type}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted">{r.match_field.replace('_', ' ')}</span>
                                <span className="truncate font-mono">{r.pattern}</span>
                                <span className="text-muted-foreground">p:{r.priority}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => toggleRuleActive(r)}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${r.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-muted text-muted-foreground'}`}
                                >
                                  {r.is_active ? 'Active' : 'Inactive'}
                                </button>
                                <button onClick={() => deleteRule(r.id)} className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30">
                                  <Trash2 className="w-3 h-3 text-red-500" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {showNewRule === net.id && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={newRuleMatchType}
                              onChange={(e) => setNewRuleMatchType(e.target.value as typeof newRuleMatchType)}
                              className="px-2 py-1.5 text-xs border border-border rounded bg-background"
                            >
                              <option value="contains">Contains</option>
                              <option value="starts_with">Starts with</option>
                              <option value="exact">Exact match</option>
                              <option value="regex">Regex</option>
                            </select>
                            <select
                              value={newRuleMatchField}
                              onChange={(e) => setNewRuleMatchField(e.target.value as typeof newRuleMatchField)}
                              className="px-2 py-1.5 text-xs border border-border rounded bg-background"
                            >
                              <option value="calendar_title">Calendar title</option>
                              <option value="meeting_title">Meeting title</option>
                              <option value="description">Description</option>
                            </select>
                            <input
                              value={newRulePattern}
                              onChange={(e) => setNewRulePattern(e.target.value)}
                              placeholder="Pattern..."
                              className="flex-1 min-w-[120px] px-2 py-1.5 text-xs border border-border rounded bg-background"
                              autoFocus
                            />
                            <input
                              type="number"
                              value={newRulePriority}
                              onChange={(e) => setNewRulePriority(parseInt(e.target.value) || 0)}
                              className="w-16 px-2 py-1.5 text-xs border border-border rounded bg-background"
                              placeholder="Priority"
                              title="Priority (higher = checked first)"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => createRule(net.id)} className="px-2 py-1.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700">
                              Add Rule
                            </button>
                            <button onClick={() => setShowNewRule(null)} className="px-2 py-1.5 text-xs rounded bg-muted hover:bg-muted/80">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
