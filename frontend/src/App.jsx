import { useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import VideoResult from './components/VideoResult'
import Platforms from './components/Platforms'
import Features from './components/Features'
import Pricing from './components/Pricing'
import Footer from './components/Footer'
import AISummary from './components/AISummary'

function App() {
  const [videoInfo, setVideoInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleParse = async (url) => {
    setIsLoading(true)
    setError('')
    setVideoInfo(null)

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || '解析失败')
      }

      const data = await res.json()
      setVideoInfo(data)
    } catch (err) {
      setError(err.message || '解析失败，请检查链接是否正确')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-dark">
      <Header />
      <Hero onParse={handleParse} isLoading={isLoading} error={error} />
      {videoInfo && <VideoResult videoInfo={videoInfo} />}
      {videoInfo && <AISummary videoInfo={videoInfo} />}
      <Platforms />
      <Features />
      <Pricing />
      <Footer />
    </div>
  )
}

export default App
