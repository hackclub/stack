import { Hero } from "./components/Hero.jsx";
import { MainPage } from "./components/MainPage.jsx";

export default function App() {
  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/main") {
    return <MainPage />;
  }

  return <Hero />;
}
