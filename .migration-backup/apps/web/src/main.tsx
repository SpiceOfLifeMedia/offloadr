import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@/api-client";
import App from "./App";
import "./index.css";

const basePrefix = import.meta.env.BASE_URL.replace(/\/$/, "");
if (basePrefix) {
  setBaseUrl(basePrefix);
}

createRoot(document.getElementById("root")!).render(<App />);
