"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * /profile/setup is now absorbed into /profile.
 * This redirect ensures any existing links or bookmarks still work.
 */
export default function ProfileSetupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return null;
}
