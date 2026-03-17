"use client";

import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface CarouselSectionProps {
  title: string;
  carouselId: string;
  children: ReactNode;
  onScroll: (id: string, direction: "left" | "right") => void;
  viewAllHref?: string;
  sectionClassName?: string;
  headerClassName?: string;
  titleClassName?: string;
  carouselClassName?: string;
  navButtonClassName?: string;
}

export default function CarouselSection({
  title,
  carouselId,
  children,
  onScroll,
  viewAllHref,
  sectionClassName = "relative group",
  headerClassName = "flex items-center justify-between mb-4 px-1",
  titleClassName = "text-xl font-bold text-white flex items-center gap-2",
  carouselClassName = "flex gap-3 md:gap-4 overflow-x-auto pt-4 pb-6 px-9 md:px-11 scrollbar-hide snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain",
  navButtonClassName = "flex absolute top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 items-center justify-center rounded-full border border-gray-600/80 bg-[#0b1020]/90 text-white hover:bg-[#1b2440] shadow-lg shadow-black/40",
}: CarouselSectionProps) {
  return (
    <section className={sectionClassName}>
      <div className={headerClassName}>
        <h2 className={titleClassName}>{title}</h2>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm text-gray-400 hover:text-white transition-colors flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>

      <button
        onClick={() => onScroll(carouselId, "left")}
        className={`${navButtonClassName} -left-4`}
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => onScroll(carouselId, "right")}
        className={`${navButtonClassName} -right-4`}
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      <div id={carouselId} className={carouselClassName}>
        {children}
      </div>
    </section>
  );
}
