import type { Manifest, Route } from 'godmode/spec';

export interface Match {
  route: Route;
  params: Record<string, string>;
}

export function matchRoute(
  manifest: Manifest,
  userSegments: string[],
  method: string,
): Match | null {
  // Version prefix: `godmode stripe v1 billing meter_events`
  if (userSegments.length > 0) {
    const ver = manifest.versions.find((v) => v.name === userSegments[0]);
    if (ver) {
      const match = findMatch(manifest.routes, userSegments.slice(1), method, ver.name);
      if (match) return match;
    }
  }

  // Default: match across all versions, latest wins on collision
  return findMatch(manifest.routes, userSegments, method);
}

function findMatch(
  routes: Route[],
  userSegments: string[],
  method: string,
  version?: string,
): Match | null {
  let bestMatch: Match | null = null;
  let bestScore = -1;

  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.segments.length !== userSegments.length) continue;
    if (version !== undefined && route.version !== version) continue;

    let score = 0;
    const params: Record<string, string> = {};
    let matches = true;

    for (let i = 0; i < route.segments.length; i++) {
      const seg = route.segments[i];
      const userSeg = userSegments[i];

      if (seg.isParam) {
        params[seg.value] = userSeg;
      } else if (seg.value === userSeg) {
        score += 1;
      } else {
        matches = false;
        break;
      }
    }

    if (matches && (score > bestScore || (score === bestScore && isLaterVersion(route, bestMatch?.route)))) {
      bestScore = score;
      bestMatch = { route, params };
    }
  }

  return bestMatch;
}

function isLaterVersion(a: Route, b: Route | undefined): boolean {
  if (!b) return true;
  return a.version > b.version;
}

export function suggestRoutes(manifest: Manifest, userSegments: string[]): Route[] {
  if (!userSegments.length) return [];

  return manifest.routes.filter((route) => {
    if (route.segments.length < userSegments.length) return false;
    const firstSeg = route.segments[0];
    return !firstSeg.isParam && firstSeg.value === userSegments[0];
  });
}
