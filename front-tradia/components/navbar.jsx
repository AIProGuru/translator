"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/navbar.module.css";
import { useAuth } from "../context/AuthContext";

const ADMIN_LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/prompt-templates", label: "Prompt templates" },
  { href: "/admin/pricing-tiers", label: "Pricing tiers" },
  { href: "/admin/session-logs", label: "Audit logs" },
];

const ADMIN_ICONS = {
  "/admin/users": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11zM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zM16 13c-3.315 0-6 1.79-6 4v2h12v-2c0-2.21-2.685-4-6-4zM8 13c-2.67 0-5 1.45-5 3.25V19h5v-1.75c0-1.2.45-2.27 1.24-3.09A6.7 6.7 0 0 0 8 13z" />
    </svg>
  ),
  "/admin/prompt-templates": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm7 1.5V8h4.5L13 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2zM8 8h3v2H8V8z" />
    </svg>
  ),
  "/admin/pricing-tiers": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h2.2l1.4-2.1a2 2 0 0 1 1.66-.9h3.48a2 2 0 0 1 1.66.9L16.8 5H19a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      <path d="M7 13a5 5 0 0 0 10 0h2a7 7 0 0 1-14 0h2z" />
      <path d="M9 10h6v2H9v-2z" />
    </svg>
  ),
  "/admin/session-logs": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24l-2.12 2.12H22V4l-2.4 2.4A7.96 7.96 0 0 0 12 4z" />
      <path d="M11 7h2v6h-2zM11 15h2v2h-2z" />
    </svg>
  ),
};

const Navbar = () => {
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const profileRef = useRef(null);
  const displayName = user?.fullName || user?.username || "User";
  const roleLabel = user?.role ? user.role.replace(/^\w/, (c) => c.toUpperCase()) : "";
  const isAdmin = user?.role === "administrator";

  const initials = useMemo(() => {
    if (!displayName) return "U";
    const parts = displayName.trim().split(/\s+/);
    const letters = parts.map((part) => part[0]).join("");
    return letters.slice(0, 2).toUpperCase();
  }, [displayName]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!profileRef.current || profileRef.current.contains(event.target)) return;
      setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <nav className={styles.navbar}>
      <div className={styles.brand}>
        <Image
          src="/logo.jpeg"
          alt="Amigo Translations logo"
          width={44}
          height={44}
          className={styles.logo}
        />
        <div className={styles.brandText}>
          <Link href="/dashboard" className={styles.brandLink}>
            Amigo Translations
          </Link>
          <span className={styles.brandSubtitle}>M.A.R.I.A. Workspace</span>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.profile} ref={profileRef}>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className={styles.profileButton}
            aria-haspopup="true"
            aria-expanded={isOpen}
          >
            <span className={styles.avatar}>{initials}</span>
            <span className={styles.profileText}>
              <span className={styles.profileName}>{displayName}</span>
              {roleLabel && <span className={styles.profileRole}>{roleLabel}</span>}
            </span>
            <svg
              className={`${styles.caret} ${isOpen ? styles.caretOpen : ""}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {isOpen && (
            <div className={styles.dropdown} role="menu">
              <div className={styles.profileRow}>
                <span className={styles.avatarLarge}>{initials}</span>
                <div className={styles.profileMeta}>
                  <p className={styles.dropdownName}>{displayName}</p>
                  {roleLabel && <p className={styles.dropdownRole}>{roleLabel}</p>}
                </div>
              </div>

              <div className={styles.menuList}>
                <Link href="/dashboard" className={styles.menuItem}>
                  <span className={styles.menuIcon}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 11l9-7 9 7v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z" />
                    </svg>
                  </span>
                  Dashboard
                </Link>
                {isAdmin &&
                  ADMIN_LINKS.map((link) => (
                    <Link key={link.href} href={link.href} className={styles.menuItem}>
                      <span className={styles.menuIcon}>
                        {ADMIN_ICONS[link.href]}
                      </span>
                      {link.label}
                    </Link>
                  ))}
                <button type="button" onClick={logout} className={styles.menuItem}>
                  <span className={styles.menuIcon}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M10 17l1.41-1.41L8.83 13H20v-2H8.83l2.58-2.59L10 7l-5 5 5 5z" />
                      <path d="M4 4h7v2H4v12h7v2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    </svg>
                  </span>
                  Log Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
