import { Hero } from "./components/Hero.jsx";
import { MainPage } from "./components/MainPage.jsx";
import { TestPage } from "./components/TestPage.jsx";

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/main") {
    return <MainPage />;
  }

  if (pathname === "/test") {
    return <TestPage />;
  }

  return <Hero />;
}
