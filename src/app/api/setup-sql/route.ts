import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "supabase", "setup_complete.sql");
    const sqlContent = fs.readFileSync(filePath, "utf8");
    return new NextResponse(sqlContent, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return new NextResponse("-- Error loading setup_complete.sql", { status: 500 });
  }
}
