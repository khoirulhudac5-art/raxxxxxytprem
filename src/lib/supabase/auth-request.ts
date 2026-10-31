import type { NextRequest } from 'next/server';
export function isSameOriginPost(request: NextRequest) {
 return request.method==='POST' && request.headers.get('origin')===request.nextUrl.origin;
}
