"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "../styles/navbar.module.css";
import { useAuth } from "../context/AuthContext";

const ADMIN_LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/prompt-templates", label: "Prompt templates" },
  { href: "/admin/session-logs", label: "Audit logs" },
];

const Navbar = () => {
  const { logout, user } = useAuth();
  const displayName = user?.fullName || user?.username || "User";
  const roleLabel = user?.role ? user.role.replace(/^\w/, (c) => c.toUpperCase()) : "";
  const isAdmin = user?.role === "administrator";

  return (
    <nav className={styles.navbar}>
      <div className="flex items-center gap-2">
        <Image
          src="/logo.jpeg"
          alt="Amigo Translations logo"
          width={50}
          height={50}
        />
        <Link href="/dashboard" className="font-semibold text-blue-800 hover:underline">
          Amigo Translations
        </Link>
      </div>
      <ul className={`${styles.menu} items-center`}>
        <li>
          <Link href="/dashboard" className="text-sm text-gray-700 hover:underline">
            Dashboard
          </Link>
        </li>
        {isAdmin &&
          ADMIN_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-sm text-gray-700 hover:underline whitespace-nowrap">
                {link.label}
              </Link>
            </li>
          ))}
        <li className="text-sm text-gray-500">
          <span className="font-semibold text-gray-800">{displayName}</span>
          {roleLabel && <span className="ml-1 text-xs uppercase tracking-wide">({roleLabel})</span>}
        </li>
        <li>
          <button
            onClick={logout}
            className="text-blue-600 text-sm font-semibold hover:underline"
          >
            Logout
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
