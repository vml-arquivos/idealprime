import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Redireciona automaticamente para o simulador de precificação.
 */
export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/simulador");
  }, [setLocation]);

  return null;
}
