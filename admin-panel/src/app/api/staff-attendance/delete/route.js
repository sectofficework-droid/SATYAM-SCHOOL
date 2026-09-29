import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    const body = await request.json();
    const { employeeId, employeeIds, date, dates, fromDate, toDate, items } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error: missing Supabase credentials" },
        { status: 500 }
      );
    }

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

    return NextResponse.json(
      { error: "Invalid parameters. Provide employeeId and date, or student attendance parameters." },
      { status: 400 }
    );
  } catch (err) {
    console.error("API error deleting staff attendance:", err);
    return NextResponse.json(
      { error: err.message || "Failed to delete staff attendance" },
      { status: 500 }
    );
  }
}
