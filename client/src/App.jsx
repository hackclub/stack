import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth/AuthContext.jsx";
import { FaqPage } from "./components/FaqPage.jsx";
import { Hero } from "./components/Hero.jsx";
import { MainPage } from "./components/MainPage.jsx";
import { ProjectsPage } from "./components/ProjectsPage.jsx";
import { ShopPage } from "./components/ShopPage.jsx";
import { TestPage } from "./components/TestPage.jsx";
import { UserAreaPage } from "./components/UserAreaPage.jsx";

const PROTECTED = new Set(["/main", "/shop", "/projects", "/faq", "/user", "/test"]);

export default function App() {
  const [auth, setAuth] = useState({ status: "loading", user: null });

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

  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (auth.status === "loading") {
    return (
      <div className="app-auth-loading" aria-busy="true">
        Loading…
      </div>
    );
  }

  if (PROTECTED.has(pathname) && !auth.user) {
    const returnTo = `${pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/api/auth/hackclub/login?returnTo=${encodeURIComponent(returnTo)}`);
    return null;
  }

  if (pathname === "/" && auth.user) {
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
    case "/test":
      page = <TestPage />;
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
    default:
      page = <Hero />;
  }

  return <AuthContext.Provider value={contextValue}>{page}</AuthContext.Provider>;
}
