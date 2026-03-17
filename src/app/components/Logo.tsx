import React from "react";
import Image from "next/image";

interface LogoProps {
  className?: string;
  iconClassName?: string;
}

export default function Logo({
  className = "w-10 h-10",
  iconClassName = "",
}: LogoProps) {
  return (
    <Image
      src="/icon.svg"
      alt="Vexa"
      width={64}
      height={64}
      className={`${className} ${iconClassName}`.trim()}
      priority
    />
  );
}
