import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable console methods in production
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  console.warn = () => {};
}

createRoot(document.getElementById("root")!).render(<App />);
