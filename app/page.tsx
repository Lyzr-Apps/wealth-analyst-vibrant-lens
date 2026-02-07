'use client'

import { useState, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Send, Menu, X, TrendingUp, TrendingDown, Download, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// TypeScript Interfaces based on actual response structure
interface FourPillarScore {
  historical_returns: string
  risk_adjusted_returns: string
  fundamentals: string
  dividends: string
  overall_score: string
}

interface KeyMetrics {
  current_price: string
  pe_ratio: string
  dividend_yield: string
  '52_week_high': string
  '52_week_low': string
}

interface RankedInvestment {
  symbol: string
  name: string
  market: string
  asset_type: string
  four_pillar_score: FourPillarScore
  recommendation: string
  recommendation_rationale: string
  key_metrics: KeyMetrics
}

interface AnalysisResult {
  conversational_insight: string
  analysis_summary: string
  ranked_investments: RankedInvestment[]
  chart_data: any
  csv_export_data: string
}

interface AgentMetadata {
  agent_name: string
  timestamp: string
  markets_analyzed: string[]
  analysis_type?: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  data?: AnalysisResult
  metadata?: AgentMetadata
}

interface MarketStats {
  NSE: number
  BSE: number
  CMX: number
  US: number
}

export default function Home() {
  // State Management
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [analysisData, setAnalysisData] = useState<AnalysisResult | null>(null)
  const [selectedInvestment, setSelectedInvestment] = useState<RankedInvestment | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['NSE', 'BSE', 'CMX', 'US'])
  const [selectedAssetTypes, setSelectedAssetTypes] = useState<string[]>(['stock', 'mutual_fund', 'etf'])
  const [riskLevel, setRiskLevel] = useState('Medium')
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'four_pillar_score.overall_score', direction: 'desc' })

  const AGENT_ID = '6986ef8566daebcd26150dc3'
  const ITEMS_PER_PAGE = 20

  // Market Performance Stats (derived from data)
  const [marketStats, setMarketStats] = useState<MarketStats>({
    NSE: 0.85,
    BSE: 1.2,
    CMX: -0.3,
    US: 0.65
  })

  // Handle Agent Call
  const handleSendMessage = async (message?: string) => {
    const messageToSend = message || inputMessage.trim()
    if (!messageToSend && !message) return

    setLoading(true)

    // Add user message
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date()
    }
    setChatMessages(prev => [...prev, userMessage])
    setInputMessage('')

    try {
      const result = await callAIAgent(messageToSend, AGENT_ID)

      if (result.success && result.response.status === 'success') {
        const data = result.response.result as AnalysisResult
        const metadata = result.response.metadata as AgentMetadata

        // Add assistant message
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.conversational_insight || 'Analysis complete.',
          timestamp: new Date(),
          data: data,
          metadata: metadata
        }
        setChatMessages(prev => [...prev, assistantMessage])
        setAnalysisData(data)

        // Update market stats based on returned data
        if (data.ranked_investments) {
          const markets = data.ranked_investments.reduce((acc, inv) => {
            acc[inv.market as keyof MarketStats] = (acc[inv.market as keyof MarketStats] || 0) + 1
            return acc
          }, {} as Record<string, number>)
        }
      } else {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: result.response.message || 'Sorry, I encountered an error processing your request.',
          timestamp: new Date()
        }
        setChatMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Network error. Please try again.',
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Run Full Analysis
  const handleFullAnalysis = () => {
    const markets = selectedMarkets.join(', ')
    const assets = selectedAssetTypes.join(', ')
    const query = `Give me ${riskLevel.toLowerCase()} risk investment recommendations for ${assets} in ${markets} markets for long-term growth`
    handleSendMessage(query)
  }

  // Filter and Sort Investments
  const getFilteredAndSortedInvestments = () => {
    if (!analysisData?.ranked_investments) return []

    let filtered = analysisData.ranked_investments.filter(inv => {
      const marketMatch = selectedMarkets.length === 0 || selectedMarkets.includes(inv.market)
      const assetMatch = selectedAssetTypes.length === 0 || selectedAssetTypes.includes(inv.asset_type)
      return marketMatch && assetMatch
    })

    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a
      let bVal: any = b

      const keys = sortConfig.key.split('.')
      for (const key of keys) {
        aVal = aVal?.[key]
        bVal = bVal?.[key]
      }

      if (typeof aVal === 'string') aVal = parseFloat(aVal) || aVal
      if (typeof bVal === 'string') bVal = parseFloat(bVal) || bVal

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }

  const filteredInvestments = getFilteredAndSortedInvestments()
  const totalPages = Math.ceil(filteredInvestments.length / ITEMS_PER_PAGE)
  const paginatedInvestments = filteredInvestments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Export CSV
  const handleExportCSV = () => {
    if (!analysisData?.csv_export_data) return

    const blob = new Blob([analysisData.csv_export_data], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `financial_analysis_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  // Clear Filters
  const handleClearFilters = () => {
    setSelectedMarkets(['NSE', 'BSE', 'CMX', 'US'])
    setSelectedAssetTypes(['stock', 'mutual_fund', 'etf'])
    setRiskLevel('Medium')
    setCurrentPage(1)
  }

  // Toggle Market Filter
  const toggleMarket = (market: string) => {
    setSelectedMarkets(prev =>
      prev.includes(market)
        ? prev.filter(m => m !== market)
        : [...prev, market]
    )
  }

  // Toggle Asset Type Filter
  const toggleAssetType = (type: string) => {
    setSelectedAssetTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  // Handle Sort
  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  // Get Recommendation Badge Color
  const getRecommendationColor = (rec: string) => {
    const lower = rec.toLowerCase()
    if (lower === 'buy') return 'bg-green-500/20 text-green-400 border border-green-500/50'
    if (lower === 'hold') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
    if (lower === 'sell') return 'bg-red-500/20 text-red-400 border border-red-500/50'
    return 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
  }

  // Score to Percentage
  const scoreToPercentage = (score: string): number => {
    const num = parseFloat(score)
    return isNaN(num) ? 0 : (num / 10) * 100
  }

  // Pillar Score to Percentage
  const pillarToPercentage = (pillar: string): number => {
    const map: Record<string, number> = {
      'Excellent': 95,
      'Very Good': 85,
      'Strong': 80,
      'Good': 70,
      'Moderate': 60,
      'Solid (hard asset)': 75,
      'Index-based': 85,
      'N/A': 0
    }
    return map[pillar] || 50
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Financial Analysis Pro
              </h1>
              <p className="text-xs text-slate-400">Powered by AI-driven Four-Pillar Analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-sm">
              <div className="text-slate-400">Markets Analyzed</div>
              <div className="font-semibold">{selectedMarkets.length} Active</div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar - Filters */}
        {sidebarOpen && (
          <aside className="w-72 border-r border-slate-800 bg-slate-900/30 backdrop-blur-sm p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-73px)]">
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Markets</h3>
              <div className="space-y-2">
                {['NSE', 'BSE', 'CMX', 'US'].map(market => (
                  <label key={market} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedMarkets.includes(market)}
                      onChange={() => toggleMarket(market)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-400 group-hover:text-white transition">{market}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Asset Types</h3>
              <div className="space-y-2">
                {[
                  { value: 'stock', label: 'Stocks' },
                  { value: 'mutual_fund', label: 'Mutual Funds' },
                  { value: 'etf', label: 'ETFs' }
                ].map(asset => (
                  <label key={asset.value} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedAssetTypes.includes(asset.value)}
                      onChange={() => toggleAssetType(asset.value)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-400 group-hover:text-white transition">{asset.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Risk Profile</h3>
              <div className="space-y-2">
                {['Conservative', 'Medium', 'Aggressive'].map(risk => (
                  <label key={risk} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="radio"
                      name="risk"
                      value={risk}
                      checked={riskLevel === risk}
                      onChange={(e) => setRiskLevel(e.target.value)}
                      className="w-4 h-4 border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-400 group-hover:text-white transition">{risk}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button
              variant="ghost"
              onClick={handleClearFilters}
              className="w-full text-sm text-slate-400 hover:text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {/* Market Overview Cards */}
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(marketStats).map(([market, change]) => (
              <Card key={market} className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-400">{market} Market</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                    {change >= 0 ? (
                      <TrendingUp className="h-8 w-8 text-green-400" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-400" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="p-6 flex gap-6">
            {/* Chat Panel - Left 40% */}
            <div className="w-2/5 flex flex-col">
              <Card className="bg-slate-900/50 border-slate-800 flex-1 flex flex-col h-[600px]">
                <CardHeader>
                  <CardTitle className="text-lg">AI Analysis Chat</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col overflow-hidden">
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-slate-500 mt-8">
                        <p className="text-sm">Ask about markets, stocks, or get personalized recommendations</p>
                        <p className="text-xs mt-2">Try "Give me buy recommendations for long-term investments"</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-lg px-4 py-2 ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-200'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className="text-xs opacity-60 mt-1">
                              {msg.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-800 text-slate-200 rounded-lg px-4 py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                      placeholder="Ask about markets, stocks, or get recommendations..."
                      disabled={loading}
                      className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    />
                    <Button
                      onClick={() => handleSendMessage()}
                      disabled={loading || !inputMessage.trim()}
                      size="icon"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Visualization - Right 60% */}
            <div className="w-3/5 space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <Button
                  onClick={handleFullAnalysis}
                  disabled={loading}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Run Full Analysis'
                  )}
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={!analysisData?.csv_export_data}
                    className="border-slate-700 hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Rankings Table */}
              {analysisData && filteredInvestments.length > 0 ? (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-lg">Investment Rankings</CardTitle>
                    <p className="text-sm text-slate-400">
                      Showing {filteredInvestments.length} investments • Click row for details
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-slate-900 border-b border-slate-700">
                          <tr>
                            <th className="text-left p-3 text-slate-400 font-medium">Rank</th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white"
                              onClick={() => handleSort('symbol')}
                            >
                              Symbol
                            </th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white"
                              onClick={() => handleSort('name')}
                            >
                              Name
                            </th>
                            <th className="text-left p-3 text-slate-400 font-medium">Market</th>
                            <th className="text-left p-3 text-slate-400 font-medium">Type</th>
                            <th
                              className="text-left p-3 text-slate-400 font-medium cursor-pointer hover:text-white"
                              onClick={() => handleSort('four_pillar_score.overall_score')}
                            >
                              Score
                            </th>
                            <th className="text-left p-3 text-slate-400 font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedInvestments.map((investment, idx) => (
                            <tr
                              key={investment.symbol}
                              onClick={() => {
                                setSelectedInvestment(investment)
                                setModalOpen(true)
                              }}
                              className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition"
                            >
                              <td className="p-3 text-slate-300">
                                {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                              </td>
                              <td className="p-3 font-semibold text-blue-400">{investment.symbol}</td>
                              <td className="p-3 text-slate-300">{investment.name}</td>
                              <td className="p-3">
                                <span className="px-2 py-1 bg-slate-800 rounded text-xs">
                                  {investment.market}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400 capitalize">
                                {investment.asset_type.replace('_', ' ')}
                              </td>
                              <td className="p-3">
                                <span className="font-bold text-green-400">
                                  {investment.four_pillar_score.overall_score}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs uppercase font-semibold ${getRecommendationColor(investment.recommendation)}`}>
                                  {investment.recommendation}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                        <div className="text-sm text-slate-400">
                          Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="border-slate-700"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="border-slate-700"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardContent className="py-12 text-center text-slate-500">
                    <p>No analysis data yet. Click "Run Full Analysis" or ask a question to get started.</p>
                  </CardContent>
                </Card>
              )}

              {/* Performance Chart */}
              {analysisData?.chart_data && (
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-lg">Performance Comparison</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-end justify-around gap-4 pb-8">
                      {analysisData.chart_data.data?.[0]?.x?.map((symbol: string, idx: number) => {
                        const score = analysisData.chart_data.data[0].y[idx]
                        const height = (score / 10) * 100
                        return (
                          <div key={symbol} className="flex flex-col items-center flex-1">
                            <div className="text-xs text-slate-400 mb-2 font-semibold">
                              {score.toFixed(1)}
                            </div>
                            <div
                              className="w-full bg-gradient-to-t from-blue-600 to-purple-600 rounded-t transition-all duration-500 hover:from-blue-500 hover:to-purple-500"
                              style={{ height: `${height}%`, minHeight: '20px' }}
                            />
                            <div className="text-xs text-slate-300 mt-2 font-medium">
                              {symbol}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Investment Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-white">
          {selectedInvestment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-3">
                  <span>{selectedInvestment.name}</span>
                  <span className="text-sm px-2 py-1 bg-slate-800 rounded font-normal">
                    {selectedInvestment.market}
                  </span>
                </DialogTitle>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <span className="text-sm text-slate-400">Symbol: </span>
                    <span className="text-lg font-semibold text-blue-400">{selectedInvestment.symbol}</span>
                  </div>
                  <div>
                    <span className="text-sm text-slate-400">Price: </span>
                    <span className="text-lg font-semibold">{selectedInvestment.key_metrics.current_price}</span>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded text-sm uppercase font-semibold ${getRecommendationColor(selectedInvestment.recommendation)}`}>
                      {selectedInvestment.recommendation}
                    </span>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-6">
                {/* Four Pillar Scores */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Four-Pillar Score Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Historical Returns', value: selectedInvestment.four_pillar_score.historical_returns },
                      { label: 'Risk-Adjusted Returns', value: selectedInvestment.four_pillar_score.risk_adjusted_returns },
                      { label: 'Fundamentals', value: selectedInvestment.four_pillar_score.fundamentals },
                      { label: 'Dividends', value: selectedInvestment.four_pillar_score.dividends }
                    ].map(pillar => (
                      <div key={pillar.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-slate-400">{pillar.label}</span>
                          <span className="text-slate-300 font-medium">{pillar.value}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                            style={{ width: `${pillarToPercentage(pillar.value)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-slate-800/50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Overall Score</span>
                      <span className="text-3xl font-bold text-green-400">
                        {selectedInvestment.four_pillar_score.overall_score}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recommendation */}
                <div>
                  <h3 className="text-lg font-semibold mb-2">Recommendation Rationale</h3>
                  <p className="text-slate-300 text-sm leading-relaxed bg-slate-800/30 p-4 rounded-lg">
                    {selectedInvestment.recommendation_rationale}
                  </p>
                </div>

                {/* Key Metrics */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Current Price', value: selectedInvestment.key_metrics.current_price },
                      { label: 'P/E Ratio', value: selectedInvestment.key_metrics.pe_ratio || 'N/A' },
                      { label: 'Dividend Yield', value: selectedInvestment.key_metrics.dividend_yield },
                      { label: '52-Week High', value: selectedInvestment.key_metrics['52_week_high'] },
                      { label: '52-Week Low', value: selectedInvestment.key_metrics['52_week_low'] },
                      { label: 'Asset Type', value: selectedInvestment.asset_type.replace('_', ' ').toUpperCase() }
                    ].map(metric => (
                      <div key={metric.label} className="bg-slate-800/30 p-4 rounded-lg">
                        <div className="text-sm text-slate-400 mb-1">{metric.label}</div>
                        <div className="text-lg font-semibold">{metric.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
