import { Hero } from "./components/Hero.jsx";
import { MainPage } from "./components/MainPage.jsx";
import { ProjectsPage } from "./components/ProjectsPage.jsx";
import { ShopPage } from "./components/ShopPage.jsx";
import { TestPage } from "./components/TestPage.jsx";

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/main") {
    return <MainPage />;
  }

  if (pathname === "/test") {
    return <TestPage />;
  }

  if (pathname === "/projects") {
    return <ProjectsPage />;
  }

  if (pathname === "/shop") {
    return <ShopPage />;
  }

  return <Hero />;
}
