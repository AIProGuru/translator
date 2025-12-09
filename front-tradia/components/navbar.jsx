"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "../styles/navbar.module.css";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { logout, user } = useAuth();
  return (
    <nav className={styles.navbar}>
      <div className="flex items-center gap-2">
        <Image
          src="/logo.jpeg"
          alt="logo de amigo traduction"
          width={50}
          height={50}
        />
        <Link href="/">Amigo Translations</Link>
      </div>
      <ul className={styles.menu}>
        <li>
          <p>{user?.name}</p>
        </li>
        <li>
          <button onClick={logout} className="text-blue-600 hover:underline">
            Logout
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Navbar;
