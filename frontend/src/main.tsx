import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import App from "./App";
import Auth from "./pages/Auth"
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";
import "./index.css";
import Home from "./pages/Home";
import MarketStock from "./pages/MarketStock";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="login" element={<Auth />} />
        <Route element={<App />}>
          <Route path="home" element={<Home />} />
          <Route path="market/:symbol" element={<MarketStock />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="portfolio/overview" element={<Portfolio />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
