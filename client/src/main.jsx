import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import faviconUrl from "@assets/mainPage/favicon.png?url";
import "./index.css";

const favicon = document.querySelector("link[rel='icon']") ?? document.createElement("link");
favicon.rel = "icon";
favicon.type = "image/png";
favicon.href = faviconUrl;
document.head.appendChild(favicon);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
