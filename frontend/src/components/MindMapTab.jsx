import { useRef, useEffect, useState } from 'react'
import { Loader2, GitBranch } from 'lucide-react'

export default function MindMapTab({ markdown }) {
  const svgRef = useRef(null)
  const markmapRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!markdown || !svgRef.current) return

    let cancelled = false
    setLoading(true)
    setError('')

    const renderMap = async () => {
      try {
        const { Transformer } = await import('markmap-lib')
        const { Markmap } = await import('markmap-view')

        if (cancelled) return

        const transformer = new Transformer()
        const { root } = transformer.transform(markdown)

        if (markmapRef.current) {
          markmapRef.current.setData(root)
          markmapRef.current.fit()
        } else {
          svgRef.current.innerHTML = ''
          markmapRef.current = Markmap.create(svgRef.current, {
            colorFreezeLevel: 2,
            initialExpandLevel: 3,
            paddingX: 20,
          }, root)
        }
        setLoading(false)
      } catch (err) {
        console.error('Mindmap render error:', err)
        setError('思维导图渲染失败')
        setLoading(false)
      }
    }

    renderMap()

    return () => {
      cancelled = true
    }
  }, [markdown])

  if (!markdown) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <GitBranch className="w-10 h-10 mb-3 text-gray-600" />
        <p>等待 AI 生成思维导图数据...</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      )}
      {error && (
        <div className="text-center py-8 text-red-400 text-sm">{error}</div>
      )}
      <svg
        ref={svgRef}
        className="w-full rounded-lg"
        style={{
          height: '500px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      />
    </div>
  )
}
