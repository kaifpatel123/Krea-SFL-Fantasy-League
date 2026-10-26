import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ADMIN_COOKIE } from '@/lib/manager'

export async function POST(request) {
  const { code } = await request.json().catch(() => ({}))
  if (!process.env.ADMIN_PASSCODE || code !== process.env.ADMIN_PASSCODE) {
    return NextResponse.json({ error: 'Wrong passcode' }, { status: 401 })
  }
  cookies().set(ADMIN_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  cookies().delete(ADMIN_COOKIE)
  return NextResponse.json({ ok: true })
}
