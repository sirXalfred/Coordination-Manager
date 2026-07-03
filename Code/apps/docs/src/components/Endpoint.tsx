import { ReactNode } from 'react'

interface EndpointProps {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  scope?: string
  children?: ReactNode
}

export function Endpoint({ method, path, description, scope, children }: EndpointProps) {
  const methodClass = method === 'GET' ? 'method-get' : 'method-post'

  return (
    <div className="endpoint">
      <div className="endpoint-header">
        <span className={methodClass}>{method}</span>
        <code className="text-sm font-mono text-gray-200">{path}</code>
        {scope && (
          <span className="ml-auto text-xs text-gray-500 font-mono">scope: {scope}</span>
        )}
      </div>
      <div className="endpoint-body">
        <p className="text-sm text-gray-300 mb-3">{description}</p>
        {children}
      </div>
    </div>
  )
}

interface ParamTableProps {
  params: { name: string; type: string; required: boolean; description: string }[]
}

export function ParamTable({ params }: ParamTableProps) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-700">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Parameter</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Type</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Required</th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p) => (
            <tr key={p.name} className="border-b border-surface-700/50">
              <td className="py-2 px-3 font-mono text-brand-300">{p.name}</td>
              <td className="py-2 px-3 text-gray-400 font-mono">{p.type}</td>
              <td className="py-2 px-3">
                {p.required ? (
                  <span className="text-red-400 text-xs font-medium">Required</span>
                ) : (
                  <span className="text-gray-500 text-xs">Optional</span>
                )}
              </td>
              <td className="py-2 px-3 text-gray-300">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ResponseExampleProps {
  status: number
  body: string
}

export function ResponseExample({ status, body }: ResponseExampleProps) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold text-gray-400 mb-1">
        Response <span className="text-emerald-400">{status}</span>
      </p>
      <pre className="bg-surface-900 border border-surface-700 rounded p-3 overflow-x-auto">
        <code className="text-xs font-mono text-gray-300">{body}</code>
      </pre>
    </div>
  )
}
