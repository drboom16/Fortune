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
}
