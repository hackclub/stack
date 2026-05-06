import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth/AuthContext.jsx";
import { FaqPage } from "./components/FaqPage.jsx";
import { Hero } from "./components/Hero.jsx";
import { LoginPage } from "./components/LoginPage.jsx";
import { MainPage } from "./components/MainPage.jsx";
import { ProjectsPage } from "./components/ProjectsPage.jsx";
import { ShopPage } from "./components/ShopPage.jsx";
import { TestPage } from "./components/TestPage.jsx";
import { AdminPage } from "./components/AdminPage.jsx";
import { AdminShopPage } from "./components/AdminShopPage.jsx";
import { AdminShopOrdersPage } from "./components/AdminShopOrdersPage.jsx";
import { UserAreaPage } from "./components/UserAreaPage.jsx";

const PROTECTED = new Set(["/main", "/shop", "/projects", "/faq", "/user", "/test", "/admin"]);
const ADMIN_ONLY = new Set(["/admin"]);

export default function App() {
  const [auth, setAuth] = useState({ status: "loading", user: null });
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  const loadMe = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      const data = response.ok ? await response.json() : { user: null };
      setAuth({ status: "ready", user: data.user ?? null });
    } catch {
      setAuth({ status: "ready", user: null });
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  if (auth.status === "loading") {
    return (
      <div className="app-auth-loading" aria-busy="true">
        Loading…
      </div>
    );
  }

  if ((PROTECTED.has(pathname) || isAdminPath) && !auth.user) {
    const returnTo = `${pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return null;
  }

  if ((ADMIN_ONLY.has(pathname) || isAdminPath) && auth.user?.role !== "admin") {
    window.location.replace("/main");
    return null;
  }

  if (pathname === "/" && auth.user) {
    window.location.replace("/main");
    return null;
  }

  if (pathname === "/login" && auth.user) {
    window.location.replace("/main");
    return null;
  }

  const contextValue = {
    user: auth.user,
    status: auth.status,
    reload: loadMe,
  };

  let page;
  switch (pathname) {
    case "/main":
      page = <MainPage />;
      break;
    case "/login":
      page = <LoginPage />;
      break;
    case "/test":
      page = isLocalhost ? <TestPage /> : <AdminPage />;
      break;
    case "/projects":
      page = <ProjectsPage />;
      break;
    case "/shop":
      page = <ShopPage />;
      break;
    case "/faq":
      page = <FaqPage />;
      break;
    case "/user":
      page = <UserAreaPage />;
      break;
    case "/admin":
      page = <AdminPage />;
      break;
    case "/admin/shop":
      page = <AdminShopPage />;
      break;
    case "/admin/shop/orders":
      page = <AdminShopOrdersPage />;
      break;
    default:
      page = <Hero />;
  }

  return <AuthContext.Provider value={contextValue}>{page}</AuthContext.Provider>;
}
