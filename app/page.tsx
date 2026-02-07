'use client'

import { useState, useRef, useEffect } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  FiSend,
  FiMenu,
  FiX,
  FiTrendingUp,
  FiTrendingDown,
  FiDownload,
  FiRefreshCw,
  FiChevronLeft,
  FiChevronRight,
  FiBarChart2,
  FiPieChart,
  FiActivity,
  FiDollarSign,
  FiFilter,
  FiMessageSquare
} from 'react-icons/fi'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'

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
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'four_pillar_score.overall_score',
    direction: 'desc'
  })

  const chatEndRef = useRef<HTMLDivElement>(null)
  const AGENT_ID = '6986ef8566daebcd26150dc3'
  const ITEMS_PER_PAGE = 10

  // Market Performance Stats
  const [marketStats, setMarketStats] = useState<MarketStats>({
    NSE: 0.85,
    BSE: 1.2,
    CMX: -0.3,
    US: 0.65
  })

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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
          content: data.conversational_insight || data.analysis_summary || 'Analysis complete.',
          timestamp: new Date(),
          data: data,
          metadata: metadata
        }
        setChatMessages(prev => [...prev, assistantMessage])
        setAnalysisData(data)
        setCurrentPage(1) // Reset to first page
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
    const assets = selectedAssetTypes.map(a => a.replace('_', ' ')).join(', ')
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

  // Get Recommendation Badge Style
  const getRecommendationStyle = (rec: string) => {
    const lower = rec.toLowerCase()
    if (lower === 'buy') return 'default'
    if (lower === 'hold') return 'secondary'
    if (lower === 'sell') return 'destructive'
    return 'outline'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                {sidebarOpen ? <FiX className="h-5 w-5" /> : <FiMenu className="h-5 w-5" />}
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <FiBarChart2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Financial Analysis Pro
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                    AI-Powered Four-Pillar Investment Analysis
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="hidden sm:flex gap-2">
                <FiActivity className="h-3 w-3" />
                {selectedMarkets.length} Markets Active
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Left Sidebar - Filters */}
        <aside className={`${sidebarOpen ? 'w-72' : 'w-0'} transition-all duration-300 overflow-hidden border-r bg-white dark:bg-slate-900/50 h-[calc(100vh-73px)] sticky top-[73px]`}>
          <div className="p-6 space-y-6 overflow-y-auto h-full">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FiFilter className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filters</h3>
              </div>

              {/* Markets */}
              <div className="mb-6">
                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                  Markets
                </h4>
                <div className="space-y-2">
                  {['NSE', 'BSE', 'CMX', 'US'].map(market => (
                    <label key={market} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                      <input
                        type="checkbox"
                        checked={selectedMarkets.includes(market)}
                        onChange={() => toggleMarket(market)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {market}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Asset Types */}
              <div className="mb-6">
                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                  Asset Types
                </h4>
                <div className="space-y-2">
                  {[
                    { value: 'stock', label: 'Stocks', icon: FiTrendingUp },
                    { value: 'mutual_fund', label: 'Mutual Funds', icon: FiPieChart },
                    { value: 'etf', label: 'ETFs', icon: FiActivity }
                  ].map(asset => (
                    <label key={asset.value} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                      <input
                        type="checkbox"
                        checked={selectedAssetTypes.includes(asset.value)}
                        onChange={() => toggleAssetType(asset.value)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <asset.icon className="h-4 w-4 text-slate-500" />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {asset.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Risk Profile */}
              <div className="mb-6">
                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
                  Risk Profile
                </h4>
                <div className="space-y-2">
                  {['Conservative', 'Medium', 'Aggressive'].map(risk => (
                    <label key={risk} className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                      <input
                        type="radio"
                        name="risk"
                        value={risk}
                        checked={riskLevel === risk}
                        onChange={(e) => setRiskLevel(e.target.value)}
                        className="w-4 h-4 border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {risk}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full mt-4"
                size="sm"
              >
                <FiRefreshCw className="h-4 w-4 mr-2" />
                Reset Filters
              </Button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 lg:px-6 py-6 space-y-6">
            {/* Market Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(marketStats).map(([market, change]) => (
                <Card key={market} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {market}
                      </span>
                      {change >= 0 ? (
                        <FiTrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <FiTrendingDown className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <div className={`text-2xl font-bold ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Today's performance
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Chat Panel - Left Side */}
              <div className="lg:col-span-2">
                <Card className="h-[700px] flex flex-col">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <FiMessageSquare className="h-5 w-5 text-blue-600" />
                      <CardTitle>AI Investment Assistant</CardTitle>
                    </div>
                    <CardDescription>
                      Ask about markets, get recommendations, or run full analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col overflow-hidden p-4">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                      {chatMessages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-center space-y-3 max-w-sm">
                            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center mx-auto">
                              <FiMessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                              Start a conversation
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              Ask about top performers, dividend stocks, or request personalized recommendations
                            </p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {chatMessages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                                  msg.role === 'user'
                                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                  {msg.content}
                                </p>
                                <p className={`text-xs mt-2 ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-500'}`}>
                                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          ))}
                          {loading && (
                            <div className="flex justify-start">
                              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
                                <div className="flex gap-2">
                                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                  <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </>
                      )}
                    </div>

                    {/* Input */}
                    <div className="flex gap-2">
                      <Input
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !loading && handleSendMessage()}
                        placeholder="Ask me anything about investments..."
                        disabled={loading}
                        className="flex-1"
                      />
                      <Button
                        onClick={() => handleSendMessage()}
                        disabled={loading || !inputMessage.trim()}
                        size="icon"
                        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        <FiSend className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Data Visualization - Right Side */}
              <div className="lg:col-span-3 space-y-6">
                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <Button
                    onClick={handleFullAnalysis}
                    disabled={loading}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-lg"
                    size="lg"
                  >
                    <FiActivity className="h-4 w-4 mr-2" />
                    {loading ? 'Analyzing...' : 'Run Full Analysis'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportCSV}
                    disabled={!analysisData?.csv_export_data}
                  >
                    <FiDownload className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                {/* Rankings Table */}
                {analysisData && filteredInvestments.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FiBarChart2 className="h-5 w-5 text-blue-600" />
                        Investment Rankings
                      </CardTitle>
                      <CardDescription>
                        {filteredInvestments.length} investments ranked by four-pillar score
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {paginatedInvestments.map((investment, idx) => (
                          <div
                            key={investment.symbol}
                            onClick={() => {
                              setSelectedInvestment(investment)
                              setModalOpen(true)
                            }}
                            className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer bg-white dark:bg-slate-800/50"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-lg font-bold text-slate-700 dark:text-slate-200">
                                    {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                                  </span>
                                  <div>
                                    <h4 className="font-semibold text-blue-600 dark:text-blue-400">
                                      {investment.symbol}
                                    </h4>
                                    <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                                      {investment.name}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {investment.market}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {investment.asset_type.replace('_', ' ')}
                                  </Badge>
                                  <Badge variant={getRecommendationStyle(investment.recommendation)} className="text-xs">
                                    {investment.recommendation}
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                  {investment.four_pillar_score.overall_score}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Overall Score
                                </p>
                              </div>
                            </div>
                            <Progress
                              value={scoreToPercentage(investment.four_pillar_score.overall_score)}
                              className="mt-3 h-1.5"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t">
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Page {currentPage} of {totalPages}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                            >
                              <FiChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                            >
                              <FiChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-16 text-center">
                      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
                        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 flex items-center justify-center">
                          <FiBarChart2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            No Analysis Yet
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Click "Run Full Analysis" or ask a question in the chat to get investment insights
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Performance Chart */}
                {analysisData?.chart_data && analysisData.chart_data.data?.[0]?.x?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FiPieChart className="h-5 w-5 text-purple-600" />
                        Performance Comparison
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80 flex items-end justify-around gap-3 px-4">
                        {analysisData.chart_data.data[0].x.map((symbol: string, idx: number) => {
                          const score = analysisData.chart_data.data[0].y[idx]
                          const height = (score / 10) * 100
                          return (
                            <div key={symbol} className="flex flex-col items-center flex-1 max-w-[100px]">
                              <div className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                                {score.toFixed(1)}
                              </div>
                              <div
                                className="w-full bg-gradient-to-t from-blue-600 to-purple-600 rounded-t-lg transition-all duration-500 hover:from-blue-500 hover:to-purple-500 cursor-pointer shadow-lg"
                                style={{ height: `${height}%`, minHeight: '30px' }}
                              />
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-2 text-center">
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
          </div>
        </main>
      </div>

      {/* Investment Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedInvestment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-3 flex-wrap">
                  <span>{selectedInvestment.name}</span>
                  <Badge variant="secondary">{selectedInvestment.market}</Badge>
                  <Badge variant={getRecommendationStyle(selectedInvestment.recommendation)}>
                    {selectedInvestment.recommendation}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-4 mt-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 dark:text-slate-400">Symbol:</span>
                    <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {selectedInvestment.symbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FiDollarSign className="h-4 w-4 text-slate-500" />
                    <span className="text-lg font-semibold">
                      {selectedInvestment.key_metrics.current_price}
                    </span>
                  </div>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-6">
                {/* Four Pillar Scores */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <FiActivity className="h-5 w-5 text-blue-600" />
                    Four-Pillar Score Breakdown
                  </h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Historical Returns', value: selectedInvestment.four_pillar_score.historical_returns },
                      { label: 'Risk-Adjusted Returns', value: selectedInvestment.four_pillar_score.risk_adjusted_returns },
                      { label: 'Fundamentals', value: selectedInvestment.four_pillar_score.fundamentals },
                      { label: 'Dividends', value: selectedInvestment.four_pillar_score.dividends }
                    ].map(pillar => (
                      <div key={pillar.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {pillar.label}
                          </span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {pillar.value}
                          </span>
                        </div>
                        <Progress value={pillarToPercentage(pillar.value)} className="h-2" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                        Overall Score
                      </span>
                      <span className="text-4xl font-bold text-green-600 dark:text-green-400">
                        {selectedInvestment.four_pillar_score.overall_score}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Recommendation */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Recommendation Rationale</h3>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {selectedInvestment.recommendation_rationale}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Key Metrics */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Key Metrics</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: 'Current Price', value: selectedInvestment.key_metrics.current_price, icon: FiDollarSign },
                      { label: 'P/E Ratio', value: selectedInvestment.key_metrics.pe_ratio || 'N/A', icon: FiBarChart2 },
                      { label: 'Dividend Yield', value: selectedInvestment.key_metrics.dividend_yield, icon: FiTrendingUp },
                      { label: '52-Week High', value: selectedInvestment.key_metrics['52_week_high'], icon: FiTrendingUp },
                      { label: '52-Week Low', value: selectedInvestment.key_metrics['52_week_low'], icon: FiTrendingDown },
                      { label: 'Asset Type', value: selectedInvestment.asset_type.replace('_', ' ').toUpperCase(), icon: FiPieChart }
                    ].map(metric => (
                      <div key={metric.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <metric.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                            {metric.label}
                          </span>
                        </div>
                        <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                          {metric.value}
                        </div>
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
