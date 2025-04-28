"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NavItems = () => {
  const path = usePathname();

  return (
    <div className="flex items-center gap-5 text-slate-400">
      <Link href={"/analyze"} className={path.includes("/analyze") ? "text-slate-900" : ""}>
        URL Analyzer
      </Link>
      <Link href={"/tests"} className={path.includes("/tests") ? "text-slate-900" : ""}>
        Tests
      </Link>
    </div>
  );
};

export default NavItems;
