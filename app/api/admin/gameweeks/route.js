import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { isAdmin } from "@/lib/manager";

const GAMEWEEK_LABEL = /^Gameweek\s+(\d+)$/i;

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

function gameweekNumber(label) {
  const match = GAMEWEEK_LABEL.exec(label || "");
  return match ? Number(match[1]) : null;
}

export async function POST(request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const number = Number(body?.number);
  if (!Number.isSafeInteger(number) || number < 1) {
    return NextResponse.json(
      { error: "Enter a valid gameweek number" },
      { status: 400 },
    );
  }
  if (!validDate(body?.match_date)) {
    return NextResponse.json(
      { error: "Enter a valid gameweek date" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: existing, error: readError } = await admin
    .from("gameweeks")
    .select("label");
  if (readError)
    return NextResponse.json({ error: readError.message }, { status: 500 });
  if (
    (existing || []).some(
      (gameweek) => gameweekNumber(gameweek.label) === number,
    )
  ) {
    return NextResponse.json(
      { error: `Gameweek ${number} already exists` },
      { status: 409 },
    );
  }

  const { data, error } = await admin
    .from("gameweeks")
    .insert({
      label: `Gameweek ${number}`,
      match_date: body.match_date,
      is_locked: true,
      is_scored: false,
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}

export async function PATCH(request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json(
      { error: "A valid gameweek is required" },
      { status: 400 },
    );
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(body || {}, "is_locked"))
    updates.is_locked = !!body.is_locked;
  if (Object.prototype.hasOwnProperty.call(body || {}, "match_date")) {
    if (!validDate(body.match_date)) {
      return NextResponse.json(
        { error: "Enter a valid gameweek date" },
        { status: 400 },
      );
    }
    updates.match_date = body.match_date;
  }
  if (!Object.keys(updates).length) {
    return NextResponse.json(
      { error: "No gameweek changes were provided" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gameweeks")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request) {
  if (!(await isAdmin()))
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json(
      { error: "A valid gameweek is required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: gameweek, error: readError } = await admin
    .from("gameweeks")
    .select("id, label, is_locked")
    .eq("id", id)
    .maybeSingle();
  if (readError)
    return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!gameweek)
    return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });
  if (!gameweek.is_locked) {
    return NextResponse.json(
      { error: "Lock the gameweek before deleting it" },
      { status: 409 },
    );
  }

  const number = gameweekNumber(gameweek.label);
  if (!number) {
    return NextResponse.json(
      {
        error:
          "Cannot verify fixture links for this gameweek label, so it cannot be deleted safely",
      },
      { status: 409 },
    );
  }
  const dependencies = [
    admin
      .from("squads")
      .select("id")
      .eq("gameweek_id", id)
      .limit(1)
      .maybeSingle(),
    admin
      .from("player_stats")
      .select("id")
      .eq("gameweek_id", id)
      .limit(1)
      .maybeSingle(),
    admin
      .from("squad_points")
      .select("id")
      .eq("gameweek_id", id)
      .limit(1)
      .maybeSingle(),
    admin
      .from("fixtures")
      .select("id")
      .eq("gameweek_no", number)
      .limit(1)
      .maybeSingle(),
  ];
  const results = await Promise.all(dependencies);
  const dependencyError = results.find((result) => result.error);
  if (dependencyError)
    return NextResponse.json(
      { error: dependencyError.error.message },
      { status: 500 },
    );
  if (results.some((result) => result.data)) {
    return NextResponse.json(
      {
        error:
          "This gameweek has fixtures, squads, stats, or scores. Remove those records first to protect league history.",
      },
      { status: 409 },
    );
  }

  const { error } = await admin.from("gameweeks").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
