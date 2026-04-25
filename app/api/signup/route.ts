import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  void req
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use the register flow instead.' },
    { status: 410 }
  )
}
