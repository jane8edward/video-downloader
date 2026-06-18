import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, GitBranch, Maximize2, Minimize2, Download } from 'lucide-react'

export default function MindMapTab({ markdown }) {
  const svgRef = useRef(null)
  const markmapRef = useRef(null)
  const fullscreenSvgRef = useRef(null)
  const fullscreenMarkmapRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Force text color on all <text> elements (attribute + inline style for max specificity)
  const forceTextColor = (svgEl, color = '#2D1B69') => {
    if (!svgEl) return
    svgEl.querySelectorAll('text').forEach((t) => {
      t.setAttribute('fill', color)
      t.style.fill = color
    })
  }

  // Render markmap into the normal SVG
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
        setTimeout(() => forceTextColor(svgRef.current, '#2D1B69'), 100)
        setLoading(false)
      } catch (err) {
        console.error('Mindmap render error:', err)
        setError('思维导图渲染失败')
        setLoading(false)
      }
    }
    renderMap()
    return () => { cancelled = true }
  }, [markdown])

  // MutationObserver: re-apply text color when markmap updates DOM (expand/collapse nodes)
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl || !markdown) return
    const observer = new MutationObserver(() => forceTextColor(svgEl, '#2D1B69'))
    observer.observe(svgEl, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [markdown])

  // Render markmap into the fullscreen SVG (separate instance)
  useEffect(() => {
    if (!isFullscreen || !fullscreenSvgRef.current || !markdown) return
    let cancelled = false

    const timer = setTimeout(async () => {
      try {
        const { Transformer } = await import('markmap-lib')
        const { Markmap } = await import('markmap-view')
        if (cancelled) return

        const transformer = new Transformer()
        const { root } = transformer.transform(markdown)

        fullscreenSvgRef.current.innerHTML = ''
        fullscreenMarkmapRef.current = Markmap.create(fullscreenSvgRef.current, {
          colorFreezeLevel: 2,
          initialExpandLevel: 3,
          paddingX: 20,
        }, root)
        setTimeout(() => forceTextColor(fullscreenSvgRef.current, '#2D1B69'), 100)
      } catch (err) {
        console.error('Fullscreen mindmap error:', err)
      }
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(timer)
      fullscreenMarkmapRef.current = null
    }
  }, [isFullscreen, markdown])

  // MutationObserver for fullscreen SVG text color
  useEffect(() => {
    const svgEl = fullscreenSvgRef.current
    if (!svgEl || !isFullscreen) return
    const observer = new MutationObserver(() => forceTextColor(svgEl, '#2D1B69'))
    observer.observe(svgEl, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [isFullscreen])

  // Lock body scroll + ESC to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return
    document.body.style.overflow = 'hidden'
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false)
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isFullscreen])

  // Get the currently active SVG element
  const getActiveSvg = () =>
    isFullscreen && fullscreenSvgRef.current ? fullscreenSvgRef.current : svgRef.current

  // Prepare SVG clone for export: add background rect + force white text via attribute
  const prepareSvgForExport = (svg) => {
    const clone = svg.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')

    const w = svg.clientWidth || svg.getBoundingClientRect().width || 800
    const h = svg.clientHeight || svg.getBoundingClientRect().height || 600
    clone.setAttribute('width', w)
    clone.setAttribute('height', h)

    // Add background rect (reliable in SVG-as-image context, unlike CSS background)
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    const viewBox = clone.getAttribute('viewBox')
    if (viewBox) {
      const [vx, vy, vw, vh] = viewBox.split(/[\s,]+/).map(Number)
      bgRect.setAttribute('x', vx)
      bgRect.setAttribute('y', vy)
      bgRect.setAttribute('width', vw)
      bgRect.setAttribute('height', vh)
    } else {
      bgRect.setAttribute('width', '100%')
      bgRect.setAttribute('height', '100%')
    }
    bgRect.setAttribute('fill', '#F0EDFF')
    clone.insertBefore(bgRect, clone.firstChild)

    // Force dark purple text for light background export
    clone.querySelectorAll('text').forEach((t) => {
      t.setAttribute('fill', '#2D1B69')
    })

    return { clone, w, h }
  }

  // Download as PNG (2x retina)
  const handleDownloadPng = () => {
    const svg = getActiveSvg()
    if (!svg) return
    try {
      const { clone, w, h } = prepareSvgForExport(svg)
      const svgData = new XMLSerializer().serializeToString(clone)
      const base64 = btoa(unescape(encodeURIComponent(svgData)))

      const img = new Image()
      img.onload = () => {
        const scale = 2
        const canvas = document.createElement('canvas')
        canvas.width = w * scale
        canvas.height = h * scale
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#F0EDFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          if (!blob) return
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `mindmap-${Date.now()}.png`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(a.href)
        }, 'image/png')
      }
      img.onerror = () => console.error('PNG export failed')
      img.src = `data:image/svg+xml;base64,${base64}`
    } catch (err) {
      console.error('PNG download error:', err)
    }
  }

  // Download as SVG (background rect + white text + CSS backup)
  const handleDownloadSvg = () => {
    const svg = getActiveSvg()
    if (!svg) return
    try {
      const { clone } = prepareSvgForExport(svg)

      // Also add CSS style as backup for SVG viewers that support it
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      style.textContent = 'text { fill: #2D1B69 !important; }'
      clone.insertBefore(style, clone.firstChild)

      const svgData = new XMLSerializer().serializeToString(clone)
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `mindmap-${Date.now()}.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch (err) {
      console.error('SVG download error:', err)
    }
  }

  if (!markdown) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <GitBranch className="w-10 h-10 mb-3 text-gray-600" />
        <p>等待 AI 生成思维导图数据...</p>
      </div>
    )
  }

  // Reusable toolbar for normal and fullscreen views
  const renderToolbar = (inFullscreen) => (
    <div className={`flex items-center gap-2 ${inFullscreen ? 'justify-between px-6 py-3 border-b border-purple-200' : 'justify-end mb-2'}`}>
      {inFullscreen && (
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-semibold text-[#2D1B69]">思维导图</span>
          <span className="text-xs text-purple-400 ml-2">按 ESC 退出</span>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDownloadPng}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-40 ${
            inFullscreen
              ? 'text-purple-500 hover:text-purple-700 bg-purple-100 hover:bg-purple-200'
              : 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10'
          }`}
          title="下载 PNG 图片"
        >
          <Download className="w-3.5 h-3.5" />
          PNG
        </button>
        <button
          onClick={handleDownloadSvg}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors disabled:opacity-40 ${
            inFullscreen
              ? 'text-purple-500 hover:text-purple-700 bg-purple-100 hover:bg-purple-200'
              : 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10'
          }`}
          title="下载 SVG 矢量图"
        >
          <Download className="w-3.5 h-3.5" />
          SVG
        </button>
        <button
          onClick={() => setIsFullscreen((f) => !f)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            inFullscreen
              ? 'text-purple-500 hover:text-purple-700 bg-purple-100 hover:bg-purple-200'
              : 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10'
          }`}
          title={inFullscreen ? '退出全屏' : '全屏查看'}
        >
          {inFullscreen ? (
            <>
              <Minimize2 className="w-3.5 h-3.5" />
              退出全屏
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5" />
              全屏
            </>
          )}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Normal view */}
      <div className="relative">
        {renderToolbar(false)}
        <div className="relative markmap-wrapper">
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
              background: '#F0EDFF',
              border: '1px solid rgba(124,58,237,0.15)',
            }}
          />
        </div>
      </div>

      {/* Fullscreen Portal — rendered into document.body to escape ancestor backdrop-filter/transform */}
      {isFullscreen && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: '#F0EDFF' }}>
          {renderToolbar(true)}
          <div className="flex-1 relative markmap-wrapper">
            <svg
              ref={fullscreenSvgRef}
              className="w-full h-full"
              style={{ background: '#F0EDFF' }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
