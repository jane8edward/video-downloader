/**
 * Shared react-markdown component overrides for dark theme styling.
 * Used by SummaryTab and OutlineTab to ensure consistent rendering.
 */
export const markdownComponents = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-white mb-4 mt-2">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-white mb-3 mt-5">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-medium text-white mb-2 mt-4">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-medium text-gray-200 mb-2 mt-3">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-gray-300 mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="text-gray-300 leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="text-white font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="text-purple-300">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-purple-500/50 pl-4 my-3 text-gray-400 italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-white/10 rounded px-1.5 py-0.5 text-sm text-purple-300 font-mono">
      {children}
    </code>
  ),
  hr: () => <hr className="border-white/10 my-4" />,
}
