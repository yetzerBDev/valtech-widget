"use client";

import Image from "next/image";
import { useTheme } from "../lib/use-theme";

export default function Logo({
  width,
  height,
  className,
  priority,
}: {
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
}) {
  const [theme] = useTheme();
  return (
    <Image
      src={theme === "dark" ? "/LOGO VALTECH BLANCO.png" : "/LOGO VALTECH.png"}
      alt="Valtech"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
