"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function MobileCtaBar({ heroId, hideNearId }: { heroId: string; hideNearId: string }) {
  const [pastHero, setPastHero] = useState(false);
  const [nearFooterCta, setNearFooterCta] = useState(false);
  const observers = useRef<IntersectionObserver[]>([]);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const footerCta = document.getElementById(hideNearId);
    if (!hero || !footerCta) return;

    const heroObserver = new IntersectionObserver(
      ([entry]) => setPastHero(!entry.isIntersecting),
      { rootMargin: "0px" }
    );
    heroObserver.observe(hero);

    const footerObserver = new IntersectionObserver(
      ([entry]) => setNearFooterCta(entry.isIntersecting),
      { rootMargin: "0px 0px -20% 0px" }
    );
    footerObserver.observe(footerCta);

    observers.current = [heroObserver, footerObserver];
    return () => observers.current.forEach((o) => o.disconnect());
  }, [heroId, hideNearId]);

  const visible = pastHero && !nearFooterCta;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border/40 bg-background/95 p-3 backdrop-blur-lg transition-transform duration-300 sm:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      aria-hidden={!visible}
    >
      <Link href="/auth/sign-up" tabIndex={visible ? 0 : -1}>
        <Button className="w-full rounded-xl gradient-indigo text-white hover:opacity-90 shadow-glow-primary h-11 text-sm font-medium">
          Get Started Free <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
