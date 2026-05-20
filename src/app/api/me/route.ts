import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/server/auth";

export async function GET() {
  const { user } = await getServerUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const metadata = user.user_metadata as { full_name?: string };
  const name =
    metadata.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "there";

  return NextResponse.json({
    success: true,
    data: {
      id: user.id,
      name,
      email: user.email ?? "",
    },
  });
}
