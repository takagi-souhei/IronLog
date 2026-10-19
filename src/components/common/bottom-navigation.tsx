import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface BottomNavigationProps {
  active: "record" | "history" | "graph" | "settings";
  onNavigate?: (href: string) => Promise<boolean>;
}

export function BottomNavigation({ active, onNavigate }: BottomNavigationProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationLock = useRef(false);

  async function handleNavigation(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (
      !onNavigate ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (navigationLock.current) return;
    navigationLock.current = true;
    setIsNavigating(true);
    try {
      if (await onNavigate(href)) router.push(href);
    } finally {
      navigationLock.current = false;
      setIsNavigating(false);
    }
  }

  return (
    <nav
      className="bottom-navigation"
      aria-label="メインナビゲーション"
      aria-busy={isNavigating}
    >
      <Link
        className={`bottom-navigation-link${active === "record" ? " is-active" : ""}`}
        href="/"
        aria-current={active === "record" ? "page" : undefined}
        onClick={(event) => void handleNavigation(event, "/")}
      >
        <span className="bottom-navigation-icon" aria-hidden="true">＋</span>
        <span>記録</span>
      </Link>
      <Link
        className={`bottom-navigation-link${active === "history" ? " is-active" : ""}`}
        href="/history"
        aria-current={active === "history" ? "page" : undefined}
        onClick={(event) => void handleNavigation(event, "/history")}
      >
        <span className="bottom-navigation-icon" aria-hidden="true">≡</span>
        <span>履歴</span>
      </Link>
      <Link
        className={`bottom-navigation-link${active === "graph" ? " is-active" : ""}`}
        href="/graphs"
        aria-current={active === "graph" ? "page" : undefined}
        onClick={(event) => void handleNavigation(event, "/graphs")}
      >
        <span className="bottom-navigation-icon" aria-hidden="true">⌁</span>
        <span>グラフ</span>
      </Link>
      <Link
        className={`bottom-navigation-link${active === "settings" ? " is-active" : ""}`}
        href="/settings"
        aria-current={active === "settings" ? "page" : undefined}
        onClick={(event) => void handleNavigation(event, "/settings")}
      >
        <span className="bottom-navigation-icon" aria-hidden="true">⚙</span>
        <span>設定</span>
      </Link>
    </nav>
  );
}
