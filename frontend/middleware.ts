import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;
  const isLogin = request.nextUrl.pathname === '/login';

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isLogin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico).*)'],
};
