"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NavItems = () => {
  const path = usePathname();

  return (
    <div className="flex items-center gap-5 font-normal text-slate-400">
      <Link href={"/explore_runs"} className={path.includes("/explore_runs") ? "font-medium text-slate-900" : ""}>
        Generate Tests
      </Link>
      <Link href={"/tests"} className={path.includes("/tests") ? "font-medium text-slate-900" : ""}>
        My Tests
      </Link>
    </div>
  );
};

export default NavItems;
