import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { AIProvider } from "./ai";
import AIGlobalShell from "./components/AIGlobalShell";
import WelcomeModal from "./components/WelcomeModal";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AIProvider>
          <App />
          <AIGlobalShell />
          <WelcomeModal />
        </AIProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
