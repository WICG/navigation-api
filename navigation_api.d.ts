interface Window {
  readonly navigation: Navigation;
}

interface NavigationEventMap {
  "navigate": NavigateEvent;
  "navigatesuccess": Event;
  "navigateerror": ErrorEvent;
  "currententrychange": NavigationCurrentEntryChangeEvent;
}

interface NavigationResult {
  committed: Promise<NavigationHistoryEntry>;
  finished: Promise<NavigationHistoryEntry>;
}

declare class Navigation extends EventTarget {
  entries(): NavigationHistoryEntry[];
  readonly currentEntry: NavigationHistoryEntry|null;
  updateCurrentEntry(options: NavigationUpdateCurrentEntryOptions): void;
  readonly transition: NavigationTransition|null;

  readonly canGoBack: boolean;
  readonly canGoForward: boolean;

  navigate(url: string, options?: NavigationNavigateOptions): NavigationResult;
  reload(options?: NavigationReloadOptions): NavigationResult;

  traverseTo(key: string, options?: NavigationOptions): NavigationResult;
  back(options?: NavigationOptions): NavigationResult;
  forward(options?: NavigationOptions): NavigationResult;

  onnavigate: ((this: Navigation, ev: NavigateEvent) => any)|null;
  onnavigatesuccess: ((this: Navigation, ev: Event) => any)|null;
  onnavigateerror: ((this: Navigation, ev: ErrorEvent) => any)|null;
  oncurrententrychange: ((this: Navigation, ev: NavigationCurrentEntryChangeEvent) => any)|null;

  addEventListener<K extends keyof NavigationEventMap>(type: K, listener: (this: Navigation, ev: NavigationEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof NavigationEventMap>(type: K, listener: (this: Navigation, ev: NavigationEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare class NavigationTransition {
  readonly navigationType: NavigationNavigationType;
  readonly from: NavigationHistoryEntry;
  readonly finished: Promise<void>;

  rollback(options?: NavigationOptions): NavigationResult;
}

interface NavigationHistoryEntryEventMap {
  "navigateto": Event;
  "navigatefrom": Event;
  "finish": Event;
  "dispose": Event;
}

declare class NavigationHistoryEntry extends EventTarget {
  readonly key: string;
  readonly id: string;
  readonly url: string|null;
  readonly index: number;
  readonly sameDocument: boolean;

  getState(): unknown;

  onnavigateto: ((this: NavigationHistoryEntry, ev: Event) => any)|null;
  onnavigatefrom: ((this: NavigationHistoryEntry, ev: Event) => any)|null;
  onfinish: ((this: NavigationHistoryEntry, ev: Event) => any)|null;
  ondispose: ((this: NavigationHistoryEntry, ev: Event) => any)|null;

  addEventListener<K extends keyof NavigationHistoryEntryEventMap>(type: K, listener: (this: NavigationHistoryEntry, ev: NavigationHistoryEntryEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof NavigationHistoryEntryEventMap>(type: K, listener: (this: NavigationHistoryEntry, ev: NavigationHistoryEntryEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

// TODO: use just `NavigationType` if https://github.com/w3c/navigation-timing/pull/172 goes through.
type NavigationNavigationType = 'reload'|'push'|'replace'|'traverse';

interface NavigationUpdateCurrentEntryOptions {
  state: unknown;
}

interface NavigationOptions {
  info?: unknown;
}

interface NavigationNavigateOptions extends NavigationOptions {
  state?: unknown;
  replace?: boolean;
}

interface NavigationReloadOptions extends NavigationOptions {
  state?: unknown;
}

declare class NavigationCurrentEntryChangeEvent extends Event {
  constructor(type: string, eventInit?: NavigationCurrentEntryChangeEventInit);

  readonly navigationType: NavigationNavigationType|null;
  readonly from: NavigationHistoryEntry;
}

interface NavigationCurrentEntryChangeEventInit extends EventInit {
  navigationType?: NavigationNavigationType|null;
  from: NavigationHistoryEntry;
}

declare class NavigateEvent extends Event {
  constructor(type: string, eventInit?: NavigateEventInit);

  readonly navigationType: NavigationNavigationType;
  readonly canTransition: boolean;
  readonly userInitiated: boolean;
  readonly hashChange: boolean;
  readonly destination: NavigationDestination;
  readonly signal: AbortSignal;
  readonly formData: FormData|null;
  readonly info: unknown;

  transitionWhile(newNavigationAction: Promise<any>, options?: NavigationTransitionWhileOptions): void;
}

interface NavigateEventInit extends EventInit {
  navigationType?: NavigationNavigationType;
  canTransition?: boolean;
  userInitiated?: boolean;
  hashChange?: boolean;
  destination: NavigationDestination;
  signal: AbortSignal;
  formData?: FormData|null;
  info?: unknown;
}

interface NavigationTransitionWhileOptions {
  focusReset?: "after-transition"|"manual",
  scrollRestoration?: "after-transition"|"manual"
}

declare class NavigationDestination {
  readonly url: string;
  readonly key: string|null;
  readonly id: string|null;
  readonly index: number;
  readonly sameDocument: boolean;

  getState(): unknown;
}
