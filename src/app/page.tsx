"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import MediaCard from "./components/MediaCard";
import CarouselSection from "./components/CarouselSection";
import DiscoverHero from "./components/DiscoverHero";
import { subscribeUser } from "./actions";

type MediaItem = {
  id: number | string;
  title?: string;
  name?: string;
  media_type?: string;
  [key: string]: unknown;
};

type RequestItem = MediaItem & {
  status?: string;
  requested_by?: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const INSTALL_PROMPT_SNOOZE_MS = 24 * 60 * 60 * 1000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; ++index) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

export default function Dashboard() {
  const [recentlyAdded, setRecentlyAdded] = useState<MediaItem[]>([]);
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [watchlist, setWatchlist] = useState<MediaItem[]>([]);
  const [recentRequests, setRecentRequests] = useState<RequestItem[]>([]);
  const [heroItem, setHeroItem] = useState<MediaItem | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Fetch all dashboard rows
    Promise.all([
      fetch("/api/dashboard/plex-recent").then((res) => res.json()),
      fetch("/api/dashboard/trending").then((res) => res.json()),
      fetch("/api/dashboard/watchlist").then((res) => res.json()),
      fetch("/api/dashboard/requests").then((res) => res.json()),
    ]).then(([plexData, trendingData, watchlistData, requestsData]) => {
      setRecentlyAdded(plexData.results || []);
      const trendingResults = trendingData.results || [];
      setTrending(trendingResults);
      setWatchlist(watchlistData.results || []);
      setRecentRequests(requestsData.results || []);

      if (trendingResults.length > 0) {
        const random =
          trendingResults[
            Math.floor(Math.random() * Math.min(5, trendingResults.length))
          ];
        setHeroItem(random);
      }
    });
  }, []);

  useEffect(() => {
    let unmounted = false;

    const isInstallPromptSnoozed = () => {
      const dismissedAt = Number(
        localStorage.getItem("vexa-install-dismissed-at") || "0",
      );
      if (!dismissedAt) return false;
      return Date.now() - dismissedAt < INSTALL_PROMPT_SNOOZE_MS;
    };

    const shouldPromptNotifications = () => {
      if (!("Notification" in window)) return false;
      if (Notification.permission !== "default") return false;
      return localStorage.getItem("vexa-notification-dismissed") !== "1";
    };

    const registerServiceWorker = async () => {
      if (!("serviceWorker" in navigator)) return;
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // no-op
      }
    };

    void registerServiceWorker();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (unmounted) return;

      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);

      if (!isInstallPromptSnoozed()) {
        setShowInstallPrompt(true);
        setShowNotificationPrompt(false);
      }
    };

    const onAppInstalled = () => {
      if (unmounted) return;
      setDeferredInstallPrompt(null);
      setShowInstallPrompt(false);
      if (shouldPromptNotifications()) {
        setShowNotificationPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    if (!window.matchMedia("(display-mode: standalone)").matches) {
      if (shouldPromptNotifications()) {
        setShowNotificationPrompt(true);
      }
    }

    return () => {
      unmounted = true;
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) return;

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
    setShowInstallPrompt(false);

    if (
      "Notification" in window &&
      Notification.permission === "default" &&
      localStorage.getItem("vexa-notification-dismissed") !== "1"
    ) {
      setShowNotificationPrompt(true);
    }
  };

  const handleEnableNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("This browser does not support push notifications");
      return;
    }

    setIsEnablingNotifications(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission was not granted");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const keyRes = await fetch("/api/push/public-key", {
          cache: "no-store",
        });
        const keyData = await keyRes.json();
        if (!keyRes.ok || !keyData?.publicKey) {
          throw new Error(keyData?.error || "VAPID public key is unavailable");
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            keyData.publicKey,
          ) as BufferSource,
        });
      }

      const serializableSubscription = subscription.toJSON() as {
        endpoint: string;
        expirationTime?: number | null;
        keys?: {
          p256dh?: string;
          auth?: string;
        };
      };
      await subscribeUser(serializableSubscription);
      setShowNotificationPrompt(false);
      toast.success("Notifications enabled");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to enable notifications";
      toast.error(message);
    } finally {
      setIsEnablingNotifications(false);
    }
  };

  const scrollCarousel = (id: string, direction: "left" | "right") => {
    const el = document.getElementById(id);
    if (!el) return;

    const amount = Math.max(320, Math.floor(el.clientWidth * 0.8));
    el.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  const carouselClass =
    "flex gap-3 md:gap-4 overflow-x-auto pt-4 pb-6 px-9 md:px-11 scrollbar-hide snap-x snap-mandatory scroll-smooth touch-pan-x overscroll-x-contain";
  const navButtonClass =
    "flex absolute top-1/2 -translate-y-1/2 z-20 w-8 h-8 md:w-10 md:h-10 items-center justify-center rounded-full border border-gray-600/80 bg-[#0b1020]/90 text-white hover:bg-[#1b2440] shadow-lg shadow-black/40";
  const sectionClass = "relative group";
  const sectionHeaderClass = "flex items-center justify-between mb-4 px-1";
  const sectionTitleClass =
    "text-xl font-bold text-white flex items-center gap-2";

  return (
    <div className="space-y-10 pb-10">
      {showInstallPrompt && (
        <div className="mx-4 mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 md:mx-0 md:mt-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Install Vexa App
              </p>
              <p className="text-xs text-indigo-200/90">
                Add Vexa to your home screen for a faster app-like experience.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  localStorage.setItem(
                    "vexa-install-dismissed-at",
                    String(Date.now()),
                  );
                  setShowInstallPrompt(false);
                  if (
                    "Notification" in window &&
                    Notification.permission === "default" &&
                    localStorage.getItem("vexa-notification-dismissed") !== "1"
                  ) {
                    setShowNotificationPrompt(true);
                  }
                }}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
              >
                Later
              </button>
              <button
                onClick={handleInstallApp}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotificationPrompt && !showInstallPrompt && (
        <div className="mx-4 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 md:mx-0 md:mt-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                Enable Notifications
              </p>
              <p className="text-xs text-emerald-200/90">
                Get alerts when new movies/episodes are added to your library.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  localStorage.setItem("vexa-notification-dismissed", "1");
                  setShowNotificationPrompt(false);
                }}
                className="rounded-lg border border-white/20 px-3 py-2 text-xs text-gray-200 hover:bg-white/10"
              >
                Later
              </button>
              <button
                onClick={handleEnableNotifications}
                disabled={isEnablingNotifications}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                {isEnablingNotifications ? "Enabling..." : "Enable"}
              </button>
            </div>
          </div>
        </div>
      )}

      <DiscoverHero
        heroItem={heroItem}
        onDetails={() => {
          if (!heroItem) return;
          router.push(
            `/media/${heroItem.media_type || "movie"}/${heroItem.id}`,
          );
        }}
      />

      <CarouselSection
        title="Recently Added"
        carouselId="carousel-recent"
        onScroll={scrollCarousel}
        viewAllHref="/movies"
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
        {recentlyAdded.length > 0 ? (
          recentlyAdded.map((media) => (
            <MediaCard
              key={`recent-${media.id}`}
              media={media}
              isAvailable={true}
            />
          ))
        ) : (
          <div className="text-gray-500 text-sm italic w-full text-center py-10 border border-dashed border-gray-800 rounded-xl">
            No recent media found in Plex.
          </div>
        )}
      </CarouselSection>

      <CarouselSection
        title="Recent Requests"
        carouselId="carousel-requests"
        onScroll={scrollCarousel}
        viewAllHref="/requests"
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
        {recentRequests.length > 0 ? (
          recentRequests.map((req) => (
            <MediaCard
              key={`req-${req.id}`}
              media={req}
              type="wide"
              status={req.status}
              user={req.requested_by}
            />
          ))
        ) : (
          <div className="text-gray-500 text-sm italic w-full text-center py-10 border border-dashed border-gray-800 rounded-xl">
            No requests yet.
          </div>
        )}
      </CarouselSection>

      <CarouselSection
        title="Your Watchlist"
        carouselId="carousel-watchlist"
        onScroll={scrollCarousel}
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
        {watchlist.length > 0 ? (
          watchlist.map((media) => (
            <MediaCard
              key={`watch-${media.id}`}
              media={media}
              isAvailable={true}
            />
          ))
        ) : (
          <div className="text-gray-500 text-sm italic w-full text-center py-10 border border-dashed border-gray-800 rounded-xl">
            Your watchlist is empty.
          </div>
        )}
      </CarouselSection>

      <CarouselSection
        title="Trending Now"
        carouselId="carousel-trending"
        onScroll={scrollCarousel}
        sectionClassName={sectionClass}
        headerClassName={sectionHeaderClass}
        titleClassName={sectionTitleClass}
        carouselClassName={carouselClass}
        navButtonClassName={navButtonClass}
      >
        {trending.map((media) => {
          const onPlex = recentlyAdded.some(
            (plexItem) =>
              (plexItem.title || plexItem.name) === (media.title || media.name),
          );
          return (
            <MediaCard
              key={`trending-${media.id}`}
              media={media}
              isAvailable={onPlex}
            />
          );
        })}
      </CarouselSection>
    </div>
  );
}
