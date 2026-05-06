import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth/AuthContext.jsx";
import { FaqPage } from "./components/FaqPage.jsx";
import { Hero } from "./components/Hero.jsx";
import { LoginPage } from "./components/LoginPage.jsx";
import { MainPage } from "./components/MainPage.jsx";
import { ProjectsPage } from "./components/ProjectsPage.jsx";
import { ShopPage } from "./components/ShopPage.jsx";
import { TestPage } from "./components/TestPage.jsx";
import { AdminAirtableSyncPage } from "./components/AdminAirtableSyncPage.jsx";
import { AdminPage } from "./components/AdminPage.jsx";
import { AdminReviewPage } from "./components/AdminReviewPage.jsx";
import { AdminShopPage } from "./components/AdminShopPage.jsx";
import { AdminShopOrdersPage } from "./components/AdminShopOrdersPage.jsx";
import { AdminUsersPage } from "./components/AdminUsersPage.jsx";
import { UserAreaPage } from "./components/UserAreaPage.jsx";

const PROTECTED = new Set(["/main", "/shop", "/projects", "/faq", "/user", "/test", "/admin"]);

function canStaffReviewRole(role) {
  return role === "reviewer" || role === "admin" || role === "superadmin";
}

function canFullAdminRole(role) {
  return role === "admin" || role === "superadmin";
}

export default function App() {
  const [auth, setAuth] = useState({ status: "loading", user: null });
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isAnyAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const isReviewPath = pathname === "/admin/review" || pathname.startsWith("/admin/review/");

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

  if ((PROTECTED.has(pathname) || isAnyAdminPath) && !auth.user) {
    const returnTo = `${pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    return null;
  }

  const role = auth.user?.role;

  if (isAnyAdminPath && auth.user) {
    if (isReviewPath) {
      if (!canStaffReviewRole(role)) {
        window.location.replace("/main");
        return null;
      }
    } else if (!canFullAdminRole(role)) {
      window.location.replace(canStaffReviewRole(role) ? "/admin/review" : "/main");
      return null;
    }
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
    case "/admin/users":
      page = <AdminUsersPage />;
      break;
    case "/admin/airtable_sync":
      page = <AdminAirtableSyncPage />;
      break;
    case "/admin/shop":
      page = <AdminShopPage />;
      break;
    case "/admin/shop/orders":
      page = <AdminShopOrdersPage />;
      break;
    case "/admin/review":
      page = <AdminReviewPage />;
      break;
    default:
      if (pathname.startsWith("/admin/users/")) {
        page = <AdminUsersPage userId={pathname.split("/").pop()} />;
      } else if (pathname.startsWith("/admin/review/project/")) {
        page = <AdminReviewPage projectId={pathname.split("/").pop()} />;
      } else {
        page = <Hero />;
      }
  }

  return <AuthContext.Provider value={contextValue}>{page}</AuthContext.Provider>;
}
