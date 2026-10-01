import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Matches sync-absent's own "today" (Asia/Kolkata, not server/UTC today).
function todayIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

// sync-absent (run on every report load) re-inserts "Absent" for today for
// any active employee still missing a row past the cutoff - so deleting
// today's auto-marked row would otherwise come right back on the next
// refresh. Recording an exclusion for any deleted pair dated today makes the
// delete stick for the rest of the day; past dates are never touched by
// sync-absent, so nothing is recorded for them.
async function recordTodayExclusions(supabaseAdmin, pairs) {
  const today = todayIST();
  const rows = (pairs || [])
    .filter((p) => p.date === today)
    .map((p) => ({ employee_id: p.employeeId, date: p.date }));
  if (!rows.length) return;
  const { error } = await supabaseAdmin
    .from("employee_attendance_sync_exclusions")
    .upsert(rows, { onConflict: "employee_id,date" });
  if (error) console.error("Failed to record sync-absent exclusion:", error.message);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeId, employeeIds, date, dates, fromDate, toDate, items } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "Server configuration error: missing NEXT_PUBLIC_SUPABASE_URL" },
        { status: 500 }
      );
    }

    // Attempt direct delete if service role key is present
    if (serviceKey) {
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Case 1a: Specific employee on a single date
      if (employeeId && date) {
        const [shiftRes, attRes] = await Promise.all([
          supabaseAdmin
            .from("employee_shifts")
            .delete()
            .eq("employee_id", employeeId)
            .eq("date", date),
          supabaseAdmin
            .from("employee_attendance")
            .delete()
            .eq("employee_id", employeeId)
            .eq("date", date),
        ]);

        if (shiftRes.error) throw shiftRes.error;
        if (attRes.error) throw attRes.error;

        await recordTodayExclusions(supabaseAdmin, [{ employeeId, date }]);

        return NextResponse.json({
          success: true,
          deleted: { employeeId, date },
          message: "Deleted from both employee_shifts and employee_attendance",
        });
      }

      // Case 1b: Multiple employees on a single date
      if (Array.isArray(employeeIds) && employeeIds.length > 0 && date) {
        const [shiftRes, attRes] = await Promise.all([
          supabaseAdmin
            .from("employee_shifts")
            .delete()
            .in("employee_id", employeeIds)
            .eq("date", date),
          supabaseAdmin
            .from("employee_attendance")
            .delete()
            .in("employee_id", employeeIds)
            .eq("date", date),
        ]);

        if (shiftRes.error) throw shiftRes.error;
        if (attRes.error) throw attRes.error;

        await recordTodayExclusions(supabaseAdmin, employeeIds.map((id) => ({ employeeId: id, date })));

        return NextResponse.json({
          success: true,
          deleted: { employeeIdsCount: employeeIds.length, date },
          message: "Deleted from both employee_shifts and employee_attendance",
        });
      }

      // Case 2: Specific employee with a list of dates
      if (employeeId && Array.isArray(dates) && dates.length > 0) {
        const [shiftRes, attRes] = await Promise.all([
          supabaseAdmin
            .from("employee_shifts")
            .delete()
            .eq("employee_id", employeeId)
            .in("date", dates),
          supabaseAdmin
            .from("employee_attendance")
            .delete()
            .eq("employee_id", employeeId)
            .in("date", dates),
        ]);

        if (shiftRes.error) throw shiftRes.error;
        if (attRes.error) throw attRes.error;

        await recordTodayExclusions(supabaseAdmin, dates.map((d) => ({ employeeId, date: d })));

        return NextResponse.json({
          success: true,
          deleted: { employeeId, datesCount: dates.length },
          message: "Deleted from both employee_shifts and employee_attendance",
        });
      }

      // Case 3: Specific employee within date range [fromDate, toDate]
      if (employeeId && fromDate && toDate) {
        const [shiftRes, attRes] = await Promise.all([
          supabaseAdmin
            .from("employee_shifts")
            .delete()
            .eq("employee_id", employeeId)
            .gte("date", fromDate)
            .lte("date", toDate),
          supabaseAdmin
            .from("employee_attendance")
            .delete()
            .eq("employee_id", employeeId)
            .gte("date", fromDate)
            .lte("date", toDate),
        ]);

        if (shiftRes.error) throw shiftRes.error;
        if (attRes.error) throw attRes.error;

        const today = todayIST();
        if (today >= fromDate && today <= toDate) {
          await recordTodayExclusions(supabaseAdmin, [{ employeeId, date: today }]);
        }

        return NextResponse.json({
          success: true,
          deleted: { employeeId, fromDate, toDate },
          message: "Deleted from both employee_shifts and employee_attendance",
        });
      }

      // Case 4: Multiple items [{ employeeId, date }, ...]
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          if (!item.employeeId || !item.date) continue;
          const [shiftRes, attRes] = await Promise.all([
            supabaseAdmin
              .from("employee_shifts")
              .delete()
              .eq("employee_id", item.employeeId)
              .eq("date", item.date),
            supabaseAdmin
              .from("employee_attendance")
              .delete()
              .eq("employee_id", item.employeeId)
              .eq("date", item.date),
          ]);
          if (shiftRes.error) throw shiftRes.error;
          if (attRes.error) throw attRes.error;
        }

        await recordTodayExclusions(
          supabaseAdmin,
          items.filter((i) => i.employeeId && i.date).map((i) => ({ employeeId: i.employeeId, date: i.date }))
        );

        return NextResponse.json({
          success: true,
          count: items.length,
          message: "Deleted from both employee_shifts and employee_attendance",
        });
      }

      // Case 5: Student attendance
      if (body.type === "student" && body.className && body.date) {
        let query = supabaseAdmin
          .from("student_attendance")
          .delete()
          .eq("class", body.className)
          .eq("date", body.date);
        if (Array.isArray(body.studentIds) && body.studentIds.length > 0) {
          query = query.in("student_id", body.studentIds);
        }
        const { error } = await query;
        if (error) throw error;

        return NextResponse.json({
          success: true,
          type: "student",
          class: body.className,
          date: body.date,
          message: "Deleted student attendance records",
        });
      }
    }

    // Fallback: Try PostgreSQL RPC function admin_delete_staff_attendance if service key is missing
    if (anonKey) {
      const client = createClient(supabaseUrl, anonKey);
      const rpcParams = {
        p_employee_ids: employeeIds || null,
        p_date: date || null,
        p_employee_id: employeeId || null,
        p_dates: dates || null,
        p_items: items || null,
      };

      const { data: rpcData, error: rpcError } = await client.rpc("admin_delete_staff_attendance", rpcParams);

      if (!rpcError && rpcData?.success) {
        return NextResponse.json({
          success: true,
          via: "rpc",
          result: rpcData,
          message: "Deleted from both employee_shifts and employee_attendance via RPC",
        });
      }
    }

    return NextResponse.json(
      {
        error:
          "Missing SUPABASE_SERVICE_ROLE_KEY. In Vercel Project Settings > Environment Variables, add SUPABASE_SERVICE_ROLE_KEY (copied from .env.local), or run database/SUPABASE_DELETE_STAFF_ATTENDANCE.sql in Supabase SQL Editor.",
      },
      { status: 500 }
    );
  } catch (err) {
    console.error("API error deleting staff attendance:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete staff attendance" },
      { status: 500 }
    );
  }
}
