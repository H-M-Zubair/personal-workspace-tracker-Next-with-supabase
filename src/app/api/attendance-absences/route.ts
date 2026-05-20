import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/server/auth";
import { attendanceAbsenceSchema } from "@/lib/validation/schemas";

export async function GET() {
  const { supabase, user } = await getServerUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("attendance_absences")
    .select("id, date, reason, created_at")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(365);

  if (error) {
    return NextResponse.json({ success: false, error: "Failed to fetch attendance absences" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(request: Request) {
  const { supabase, user } = await getServerUser();

  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  const parsed = attendanceAbsenceSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { date, reason } = parsed.data;
  const today = new Date().toISOString().slice(0, 10);
  if (date >= today) {
    return NextResponse.json(
      { success: false, error: "Reason can only be added for past dates." },
      { status: 400 },
    );
  }

  const { data: checkIn, error: checkInError } = await supabase
    .from("attendance")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  if (checkInError) {
    return NextResponse.json({ success: false, error: "Failed to verify attendance" }, { status: 500 });
  }

  if (checkIn) {
    return NextResponse.json(
      { success: false, error: "You checked in on this day — no absence reason needed." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("attendance_absences")
    .upsert(
      {
        user_id: user.id,
        date,
        reason,
      },
      { onConflict: "user_id,date" },
    )
    .select("id, date, reason, created_at")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: "Failed to save absence reason" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}
