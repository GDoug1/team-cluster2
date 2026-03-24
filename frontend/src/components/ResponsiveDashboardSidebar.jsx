import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = "(max-width: 1100px)";

export default function ResponsiveDashboardSidebar({
  avatar,
  roleLabel,
  userName,
  navItems,
  onLogout,
}) {
  const getIsMobileViewport = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia(MOBILE_BREAKPOINT).matches;
  };

  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarHidden, setIsDesktopSidebarHidden] = useState(false);
  const [restoreDesktopAfterModal, setRestoreDesktopAfterModal] = useState(false);
  const [restoreMobileAfterModal, setRestoreMobileAfterModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT);
    const handleViewportChange = event => {
      setIsMobileViewport(event.matches);

      if (!event.matches) {
        setIsMobileSidebarOpen(false);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);
      return () => mediaQuery.removeEventListener("change", handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
      return undefined;
    }

    const syncSidebarWithModalState = () => {
      const hasOpenModal = Boolean(document.querySelector(".modal-overlay"));

      if (hasOpenModal) {
        if (!isDesktopSidebarHidden) {
          setRestoreDesktopAfterModal(true);
          setIsDesktopSidebarHidden(true);
        }

        if (isMobileSidebarOpen) {
          setRestoreMobileAfterModal(true);
          setIsMobileSidebarOpen(false);
        }

        return;
      }

      if (restoreDesktopAfterModal) {
        setIsDesktopSidebarHidden(false);
        setRestoreDesktopAfterModal(false);
      }

      if (restoreMobileAfterModal) {
        setIsMobileSidebarOpen(true);
        setRestoreMobileAfterModal(false);
      }
    };

    syncSidebarWithModalState();

    const observer = new MutationObserver(() => {
      syncSidebarWithModalState();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [isDesktopSidebarHidden, isMobileSidebarOpen, restoreDesktopAfterModal, restoreMobileAfterModal]);

  const isSidebarVisible = isMobileViewport ? isMobileSidebarOpen : !isDesktopSidebarHidden;

  const handleShowSidebar = () => {
    if (isMobileViewport) {
      setIsMobileSidebarOpen(true);
      return;
    }

    setIsDesktopSidebarHidden(false);
  };

  const handleHideSidebar = () => {
    if (isMobileViewport) {
      setIsMobileSidebarOpen(false);
      return;
    }

    setIsDesktopSidebarHidden(true);
  };

  const runNavAction = action => {
    if (typeof action === "function") {
      action();
    }

    if (isMobileViewport) {
      setIsMobileSidebarOpen(false);
    }
  };

  const renderNavItem = item => {
    const className = `nav-item${item.active ? " active" : ""}`;
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;

    return (
      <div key={item.label} className="nav-group">
        {item.onClick ? (
          <button className={className} type="button" onClick={() => runNavAction(item.onClick)}>
            <span>{item.label}</span>
            {hasChildren ? <span className="nav-caret">{item.expanded ? "v" : ">"}</span> : null}
          </button>
        ) : (
          <div className={className}>
            <span>{item.label}</span>
            {hasChildren ? <span className="nav-caret">{item.expanded ? "v" : ">"}</span> : null}
          </div>
        )}

        {hasChildren && item.expanded ? (
          <div className="nav-submenu" role="group" aria-label={`${item.label} submenu`}>
            {item.children.map(child => {
              const childClassName = `nav-subitem${child.active ? " active" : ""}`;
              return (
                <button
                  key={`${item.label}-${child.label}`}
                  className={childClassName}
                  type="button"
                  onClick={() => runNavAction(child.onClick)}
                >
                  {child.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <>
      {!isSidebarVisible ? (
        <button
          type="button"
          className="sidebar-toggle"
          onClick={handleShowSidebar}
          aria-label="Open navigation menu"
          aria-expanded={false}
        >
          <span className="sidebar-toggle-icon">|||</span>
          <span className="sidebar-toggle-label">Menu</span>
        </button>
      ) : null}

      {isMobileViewport && isSidebarVisible ? (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={handleHideSidebar}
          aria-label="Close navigation menu"
        />
      ) : null}

      <aside
        className={`sidebar${isSidebarVisible ? " is-open" : " is-hidden"}${isMobileViewport ? " is-mobile" : " is-desktop"}`}
        aria-hidden={!isSidebarVisible}
      >
        <div className="sidebar-head">
          <div className="brand">
            <div className="avatar">{avatar}</div>
            <div>
              <div>{roleLabel}</div>
              <div className="user-meta">{userName ?? roleLabel}</div>
            </div>
          </div>
          <button
            className="sidebar-collapse-btn"
            type="button"
            onClick={handleHideSidebar}
            aria-label={isMobileViewport ? "Close navigation menu" : "Hide navigation menu"}
          >
            {isMobileViewport ? "X" : "Hide"}
          </button>
        </div>

        <nav className="nav">
          {navItems.map(renderNavItem)}
        </nav>

        <button className="sidebar-footer" type="button" onClick={onLogout}>
          Log Out
        </button>
      </aside>
    </>
  );
}
