import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
const faviconUrl = "https://cdn.hackclub.com/019e3e5a-40da-7214-b948-4100b5fa74e9/favicon.png";
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
