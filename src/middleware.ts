import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function isBasicAuthEnabled() {
  return process.env.BASIC_AUTH_ENABLED === 'true';
}

function unauthorizedResponse(message = 'Authentication required.') {
  return new NextResponse(message, {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="UPG", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}

function parseBasicAuth(header: string | null) {
  if (!header?.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = atob(header.slice(6));
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string) {
  return (
    pathname === '/api/health' ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.[A-Za-z0-9]+$/.test(pathname)
  );
}

export function middleware(request: NextRequest) {
  if (!isBasicAuthEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const configuredUsername = process.env.BASIC_AUTH_USERNAME;
  const configuredPassword = process.env.BASIC_AUTH_PASSWORD;

  if (!configuredUsername || !configuredPassword) {
    return unauthorizedResponse('Basic auth is enabled, but credentials are not configured.');
  }

  const credentials = parseBasicAuth(request.headers.get('authorization'));
  if (
    credentials?.username === configuredUsername &&
    credentials.password === configuredPassword
  ) {
    return NextResponse.next();
  }

  return unauthorizedResponse();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
