import {createRoot} from "react-dom/client";
import App from "./App.tsx";
import StatsPage from "./components/StatsPage.tsx";
import "./index.css";

const isStatsView =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("stats") === "1";

createRoot(document.getElementById("root")!).render(isStatsView ? <StatsPage /> : <App />);
