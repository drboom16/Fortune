// Mock data for AAPL stock - used for development and testing

export interface ChartData {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }
  
  export interface AiCompanyPayload {
    ticker?: string;
    company_name?: string;
    market_status?: string;
    quote?: {
      current_price?: number;
      currency?: string;
      change_absolute?: number;
      change_percentage?: number;
      trading_mode?: string;
    };
    performance_metrics?: {
      past_week_growth?: string;
      market_cap?: string;
      volume_3m_avg?: string;
      pe_ratio?: number;
      revenue_ttm?: string;
      day_range?: {
        low?: number;
        high?: number;
      };
      "52w_range"?: {
        low?: number;
        high?: number;
      };
    };
    upcoming_events?: {
      event_type?: string;
      fiscal_period?: string;
      date?: string;
      timing?: string;
    };
    analyst_forecast?: {
      consensus?: string;
      price_target?: number;
      analyst_count?: number;
    };
    related_content?: {
      people_also_bought?: string[];
    };
    metadata?: {
      source_screenshot_date?: string;
      primary_exchange?: string;
    };
    profile?: {
      sector?: string;
      industry?: string;
      ceo?: string;
      employees?: number;
    };
    financials?: {
      prev_close?: number;
      eps?: number;
      one_year_return?: string;
      dividend_yield?: string;
      beta?: number;
      market_cap?: string;
      day_range?: string;
      year_range?: string;
      volume_3m?: string;
      revenue?: string;
    };
    latest_news?: Array<{ title: string; source: string; time: string }>;
    related_companies?: Array<{ ticker: string; name: string; change: string }>;
  }
  
  // Generate realistic intraday data (1 day - 5 minute intervals)
  const generateIntradayData = (): ChartData[] => {
    const data: ChartData[] = [];
    const now = Date.now() / 1000;
    const marketOpen = now - (6.5 * 60 * 60); // 6.5 hours ago (market hours)
    const intervalSeconds = 5 * 60; // 5 minutes
    const intervals = 78; // 6.5 hours / 5 minutes
    
    let currentPrice = 190.50;
    
    for (let i = 0; i < intervals; i++) {
      const timestamp = marketOpen + (i * intervalSeconds);
      
      // Intraday volatility
      const volatility = 0.002; // 0.2% per 5 minutes
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      
      const open = currentPrice;
      currentPrice = currentPrice * (1 + randomChange);
      
      const change = currentPrice * (Math.random() * 0.003 - 0.0015);
      const high = Math.max(open, currentPrice + Math.abs(change));
      const low = Math.min(open, currentPrice - Math.abs(change));
      const close = currentPrice + change;
      
      currentPrice = close;
      
      const volume = Math.floor(500000 + Math.random() * 1500000);
      
      data.push({
        time: Math.floor(timestamp),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume
      });
    }
    
    return data;
  };
  
  // Generate 1 week data (5 days, 30-minute intervals during market hours)
  const generateWeekData = (): ChartData[] => {
    const data: ChartData[] = [];
    const now = Date.now() / 1000;
    const daysAgo = 5;
    const marketHours = 6.5;
    const intervalMinutes = 30;
    const intervalsPerDay = (marketHours * 60) / intervalMinutes;
    
    let currentPrice = 187.80;
    
    for (let day = daysAgo; day >= 0; day--) {
      const dayStart = now - (day * 24 * 60 * 60);
      
      for (let interval = 0; interval < intervalsPerDay; interval++) {
        const timestamp = dayStart + (interval * intervalMinutes * 60);
        
        const volatility = 0.004;
        const randomChange = (Math.random() - 0.5) * 2 * volatility;
        
        const open = currentPrice;
        currentPrice = currentPrice * (1 + randomChange);
        
        const change = currentPrice * (Math.random() * 0.005 - 0.0025);
        const high = Math.max(open, currentPrice + Math.abs(change));
        const low = Math.min(open, currentPrice - Math.abs(change));
        const close = currentPrice + change;
        
        currentPrice = close;
        
        const volume = Math.floor(2000000 + Math.random() * 4000000);
        
        data.push({
          time: Math.floor(timestamp),
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: volume
        });
      }
    }
    
    return data;
  };
  
  // Generate 1 month data (daily intervals)
  const generateMonthData = (): ChartData[] => {
    const data: ChartData[] = [];
    const now = Date.now() / 1000;
    const daysAgo = 30;
    const intervalSeconds = 24 * 60 * 60;
    
    let currentPrice = 185.50;
    
    for (let i = daysAgo; i >= 0; i--) {
      const timestamp = now - (i * intervalSeconds);
      
      const volatility = 0.015;
      const trend = 0.0015; // Slight upward trend
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      
      currentPrice = currentPrice * (1 + trend + randomChange);
      
      const open = currentPrice;
      const change = currentPrice * (Math.random() * 0.02 - 0.01);
      const high = Math.max(open, currentPrice + Math.abs(change) * 1.5);
      const low = Math.min(open, currentPrice - Math.abs(change) * 1.5);
      const close = currentPrice + change;
      
      currentPrice = close;
      
      const volume = Math.floor(45000000 + Math.random() * 40000000);
      
      data.push({
        time: Math.floor(timestamp),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume
      });
    }
    
    return data;
  };
  
  // Generate 3 month data (daily intervals)
  const generate3MonthData = (): ChartData[] => {
    const data: ChartData[] = [];
    const now = Date.now() / 1000;
    const daysAgo = 90;
    const intervalSeconds = 24 * 60 * 60;
    
    let currentPrice = 175.20;
    
    for (let i = daysAgo; i >= 0; i--) {
      const timestamp = now - (i * intervalSeconds);
      
      const volatility = 0.018;
      const trend = 0.0012;
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      
      currentPrice = currentPrice * (1 + trend + randomChange);
      
      const open = currentPrice;
      const change = currentPrice * (Math.random() * 0.025 - 0.0125);
      const high = Math.max(open, currentPrice + Math.abs(change) * 1.5);
      const low = Math.min(open, currentPrice - Math.abs(change) * 1.5);
      const close = currentPrice + change;
      
      currentPrice = close;
      
      const volume = Math.floor(42000000 + Math.random() * 45000000);
      
      data.push({
        time: Math.floor(timestamp),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume
      });
    }
    
    return data;
  };
  
  // Generate 1 year data (daily intervals)
  const generateYearData = (): ChartData[] => {
    const data: ChartData[] = [];
    const now = Date.now() / 1000;
    const daysAgo = 365;
    const intervalSeconds = 24 * 60 * 60;
    
    let currentPrice = 165.00;
    
    for (let i = daysAgo; i >= 0; i--) {
      const timestamp = now - (i * intervalSeconds);
      
      const volatility = 0.02;
      const trend = 0.0008;
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      
      currentPrice = currentPrice * (1 + trend + randomChange);
      
      const open = currentPrice;
      const change = currentPrice * (Math.random() * 0.03 - 0.015);
      const high = Math.max(open, currentPrice + Math.abs(change) * 1.5);
      const low = Math.min(open, currentPrice - Math.abs(change) * 1.5);
      const close = currentPrice + change;
      
      currentPrice = close;
      
      const volume = Math.floor(40000000 + Math.random() * 50000000);
      
      data.push({
        time: Math.floor(timestamp),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume
      });
    }
    
    return data;
  };
  
  // Generate 5 year data (weekly intervals)
  const generate5YearData = (): ChartData[] => {
    const data: ChartData[] = [];
    const now = Date.now() / 1000;
    const weeksAgo = 260; // ~5 years
    const intervalSeconds = 7 * 24 * 60 * 60; // 1 week
    
    let currentPrice = 95.00;
    
    for (let i = weeksAgo; i >= 0; i--) {
      const timestamp = now - (i * intervalSeconds);
      
      const volatility = 0.04;
      const trend = 0.0025;
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      
      currentPrice = currentPrice * (1 + trend + randomChange);
      
      const open = currentPrice;
      const change = currentPrice * (Math.random() * 0.05 - 0.025);
      const high = Math.max(open, currentPrice + Math.abs(change) * 1.8);
      const low = Math.min(open, currentPrice - Math.abs(change) * 1.8);
      const close = currentPrice + change;
      
      currentPrice = close;
      
      const volume = Math.floor(200000000 + Math.random() * 300000000); // Weekly volume
      
      data.push({
        time: Math.floor(timestamp),
        open: parseFloat(open.toFixed(2)),
        high: parseFloat(high.toFixed(2)),
        low: parseFloat(low.toFixed(2)),
        close: parseFloat(close.toFixed(2)),
        volume: volume
      });
    }
    
    return data;
  };
  
  // Default export - 1 month data for initial display
  export const MOCK_AAPL_CHART_DATA: ChartData[] = generateMonthData();
  
  // Export all timeframe generators for dynamic loading
  export const MOCK_AAPL_CHART_DATA_BY_PERIOD = {
    "1d": generateIntradayData(),
    "5d": generateWeekData(),
    "1mo": generateMonthData(),
    "3mo": generate3MonthData(),
    "1y": generateYearData(),
    "5y": generate5YearData(),
  };
  
  export const MOCK_AAPL_DATA: AiCompanyPayload = {
    ticker: "AAPL",
    company_name: "Apple Inc.",
    market_status: "Market Open",
    quote: {
      current_price: 191.24,
      currency: "USD",
      change_absolute: 1.18,
      change_percentage: 0.62,
      trading_mode: "24/5 Trading"
    },
    performance_metrics: {
      past_week_growth: "+2.14%",
      market_cap: "2.98T",
      volume_3m_avg: "58.21M",
      pe_ratio: 28.41,
      revenue_ttm: "382.49B",
      day_range: { low: 188.72, high: 192.84 },
      "52w_range": { low: 164.08, high: 199.62 }
    },
    upcoming_events: {
      event_type: "Earnings Report",
      fiscal_period: "Q1 2026",
      date: "2026-02-28",
      timing: "After Market Close"
    },
    analyst_forecast: {
      consensus: "Moderate Buy",
      price_target: 214.35,
      analyst_count: 41
    },
    related_content: {
      people_also_bought: ["Microsoft", "Alphabet Class A", "NVIDIA", "Amazon", "Meta"]
    },
    metadata: {
      source_screenshot_date: "2026-02-02",
      primary_exchange: "NASDAQ"
    },
    profile: {
      sector: "Technology",
      industry: "Consumer Electronics",
      ceo: "Tim Cook",
      employees: 161000
    },
    financials: {
      prev_close: 190.06,
      eps: 6.42,
      one_year_return: "+18.6%",
      dividend_yield: "0.52% (0.96)",
      beta: 1.25,
      market_cap: "2.98T",
      day_range: "188.72 - 192.84",
      year_range: "164.08 - 199.62",
      volume_3m: "58.21M",
      revenue: "382.49B"
    },
    latest_news: [
      { title: "Apple unveils new AI tools for creators", source: "Reuters", time: "2h ago" },
      { title: "iPhone demand stays resilient in Q1", source: "Bloomberg", time: "6h ago" },
      { title: "Apple services revenue hits record", source: "WSJ", time: "1d ago" }
    ],
    related_companies: [
      { ticker: "GOOG", name: "Alphabet", change: "-2.36%" },
      { ticker: "MSFT", name: "Microsoft", change: "-1.78%" },
      { ticker: "AMZN", name: "Amazon", change: "-1.80%" },
      { ticker: "NKE", name: "Nike", change: "-1.44%" },
      { ticker: "TSLA", name: "Tesla", change: "-2.70%" }
    ]
  };