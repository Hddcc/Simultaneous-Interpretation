import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Tagged before the first paint so the transparent overlay never flashes the opaque
// workbench background.
if (new URLSearchParams(window.location.search).get("window") === "floating") {
  document.documentElement.classList.add("floating-window");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
