import React from "react";

interface LogoProps {
  className?: string;
  iconClassName?: string;
}

export default function Logo({
  className = "w-10 h-10 rounded-xl",
  iconClassName = "w-5 h-5",
}: LogoProps) {
  return (
    <div
      className={`flex items-center justify-center bg-linear-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/20 ring-1 ring-white/10 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconClassName} text-white`}
      >
        <path
          d="M12 21.5L2.5 5H7.5L12 14.5L16.5 5H21.5L12 21.5Z"
          fill="currentColor"
        />
        <path
          d="M12 21.5L7.5 12H2.5L12 24L21.5 12H16.5L12 21.5Z"
          fill="currentColor"
          fillOpacity="0.4"
        />
      </svg>
    </div>
  );
}
