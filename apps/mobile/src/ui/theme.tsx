import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { storage } from "../lib/storage";
const dark = {
  bg: "#0a0b0f",
  panel: "#15171c",
  inset: "#1d2027",
  line: "#292d37",
  text: "#f4f6fa",
  secondary: "#c3c8d2",
  muted: "#8b92a1",
  brand: "#3358ff",
  soft: "#18214a",
  link: "#9aacff",
  green: "#4ad08a",
  danger: "#ff8c8c",
};
const light: typeof dark = {
  bg: "#f6f7f9",
  panel: "#ffffff",
  inset: "#f0f2f6",
  line: "#e3e7ef",
  text: "#0b1220",
  secondary: "#3b4558",
  muted: "#667085",
  brand: "#0129ac",
  soft: "#eaf0ff",
  link: "#204acc",
  green: "#12815a",
  danger: "#bb324b",
};
const Theme = createContext({
  colors: dark,
  mode: "dark",
  setMode: (_mode: string) => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, set] = useState("dark");
  useEffect(() => {
    void storage.get("appearance").then((v) => {
      if (v === "light" || v === "dark") set(v);
    });
  }, []);
  const setMode = (value: string) => {
    set(value);
    void storage.set("appearance", value);
  };
  return (
    <Theme.Provider
      value={{ colors: mode === "light" ? light : dark, mode, setMode }}
    >
      {children}
    </Theme.Provider>
  );
}
export const useTheme = () => useContext(Theme);
