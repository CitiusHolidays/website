"use client";

import { useEffect, useState } from "react";

const PRERENDER_YEAR = 2026;

export function useCurrentYear() {
  const [currentYear, setCurrentYear] = useState(PRERENDER_YEAR);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return currentYear;
}
