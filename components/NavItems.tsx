"use client";

import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NavItems = () => {
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);
    }
    fetchUser();
  }, []);

  if (loading) return null;
  if (!user) return null;

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
