import * as React from "react";

const SMALL_BREAKPOINT = 640;

export function useIsSmall() {
  const [isSmall, setIsSmall] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${SMALL_BREAKPOINT - 1}px)`);
    const onChange = () => setIsSmall(window.innerWidth < SMALL_BREAKPOINT);
    mql.addEventListener("change", onChange);
    setIsSmall(window.innerWidth < SMALL_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isSmall;
}
