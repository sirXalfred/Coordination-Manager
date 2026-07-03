import licenseText from '../content/legal/mit-license.txt?raw'

export function LegalLicensePage() {
  return (
    <div className="prose-docs">
      <h1>MIT License</h1>
      <p className="text-gray-400 mb-4">
        The Coordination Manager source code is licensed under the MIT License.
      </p>
      <pre className="text-xs leading-6 text-gray-200 whitespace-pre-wrap">{licenseText}</pre>
    </div>
  )
}
