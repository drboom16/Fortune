import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";

import App from "./App";
import Auth from "./pages/Auth"
import PortfolioOverview from "./pages/PortfolioOverview";
import Watchlist from "./pages/Watchlist";
import "./index.css";
import MarketStock from "./pages/MarketStock";
import PortfolioLayout from "./pages/PortfolioLayout";
import PortfolioBreakdown from "./pages/PortfolioBreakdown";
import SearchNoResults from "./pages/SearchNoResults";
import InvestmentCalculatorPage from "./pages/InvestmentCalculatorPage";
import { Navigate } from "react-router-dom";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<Auth />} />
        <Route element={<App />}>
          <Route path="/" element={<Navigate to="/portfolio/calculator" replace />} />
          <Route path="home" element={<Navigate to="/portfolio/calculator" replace />} />
          <Route path="market/:symbol" element={<MarketStock />} />
          <Route path="search/no-results" element={<SearchNoResults />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="portfolio" element={<Outlet />}>
            <Route path="overview" element={<PortfolioLayout />}>
              <Route index element={<PortfolioOverview />} />
            </Route>
            <Route path="breakdown/:symbol" element={<PortfolioLayout />}>
              <Route index element={<PortfolioBreakdown />} />
            </Route>
            <Route path="calculator" element={<InvestmentCalculatorPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
