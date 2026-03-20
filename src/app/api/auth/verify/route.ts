import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function resolveNextPath(request: NextRequest) {
  const nextParam = request.nextUrl.searchParams.get('next');
  if (!nextParam) {
    return '/';
  }

  try {
    const target = new URL(nextParam, request.url);
    if (target.origin !== request.nextUrl.origin) {
      return '/';
    }

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

export async function GET(request: NextRequest) {
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: resolveNextPath(request),
      'Cache-Control': 'no-store',
    },
  });
}
