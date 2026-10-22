import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'welcome' }
  | { name: 'learn' }
  | { name: 'library' }
  | { name: 'card'; id: string }
  | { name: 'helper' }
  | { name: 'reader'; id: string }
  | { name: 'settings' };

function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  const [head = '', tail = ''] = raw.split('/');
  switch (head) {
    case '':
      return { name: 'home' };
    case 'welcome':
      return { name: 'welcome' };
    case 'learn':
      return { name: 'learn' };
    case 'library':
      return { name: 'library' };
    case 'card':
      return tail ? { name: 'card', id: decode(tail) } : { name: 'library' };
    case 'helper':
      return { name: 'helper' };
    case 'reader':
      return tail ? { name: 'reader', id: decode(tail) } : { name: 'helper' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'home' };
  }
}

export function routePath(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'welcome':
      return '#/welcome';
    case 'learn':
      return '#/learn';
    case 'library':
      return '#/library';
    case 'card':
      return `#/card/${encodeURIComponent(route.id)}`;
    case 'helper':
      return '#/helper';
    case 'reader':
      return `#/reader/${encodeURIComponent(route.id)}`;
    case 'settings':
      return '#/settings';
  }
}

export function navigate(path: string): void {
  if (window.location.hash === path) return;
  window.location.hash = path;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('hashchange', callback);
  window.addEventListener('popstate', callback);
  return () => {
    window.removeEventListener('hashchange', callback);
    window.removeEventListener('popstate', callback);
  };
}

function getSnapshot(): string {
  return window.location.hash || '#/';
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, () => '#/');
  return parseRoute(hash);
}
