interface Window {
  readonly appHistory: AppHistory;
}

interface AppHistoryEventMap {
  "navigate": AppHistoryNavigateEvent;
  "navigatesuccess": Event;
  "navigateerror": ErrorEvent;
}

declare class AppHistory extends EventTarget {
  readonly current: AppHistoryEntry|null;
  readonly transition: AppHistoryTransition|null;

  entries(): AppHistoryEntry[];

  readonly canGoBack: boolean;
  readonly canGoForward: boolean;

  navigate(url: string, options?: AppHistoryNavigateOptions): Promise<void>;
  reload(options?: AppHistoryReloadOptions): Promise<void>;

  goTo(key: string, options?: AppHistoryNavigationOptions): Promise<void>;
  back(options?: AppHistoryNavigationOptions): Promise<void>;
  forward(options?: AppHistoryNavigationOptions): Promise<void>;

  onnavigate: ((this: AppHistory, ev: AppHistoryNavigateEvent) => any)|null;
  onnavigatesuccess: ((this: AppHistory, ev: Event) => any)|null;
  onnavigateerror: ((this: AppHistory, ev: ErrorEvent) => any)|null;

  addEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare class AppHistoryTransition {
  readonly navigationType: AppHistoryNavigationType;
  readonly from: AppHistoryEntry;
  readonly finished: Promise<void>;

  rollback(options?: AppHistoryNavigationOptions): Promise<void>;
}

interface AppHistoryEntryEventMap {
  "navigateto": Event;
  "navigatefrom": Event;
  "finish": Event;
  "dispose": Event;
}

declare class AppHistoryEntry extends EventTarget {
  readonly key: string;
  readonly id: string;
  readonly url: string;
  readonly index: number;
  readonly sameDocument: boolean;

  getState(): unknown;

  onnavigateto: ((this: AppHistoryEntry, ev: Event) => any)|null;
  onnavigatefrom: ((this: AppHistoryEntry, ev: Event) => any)|null;
  onfinish: ((this: AppHistoryEntry, ev: Event) => any)|null;
  ondispose: ((this: AppHistoryEntry, ev: Event) => any)|null;

  addEventListener<K extends keyof AppHistoryEntryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEntryEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof AppHistoryEntryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEntryEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

type AppHistoryNavigationType = 'reload'|'push'|'replace'|'traverse';

interface AppHistoryNavigationOptions {
  navigateInfo?: unknown;
}

interface AppHistoryNavigateOptions extends AppHistoryNavigationOptions {
  state?: unknown;
  replace?: boolean;
}

interface AppHistoryReloadOptions extends AppHistoryNavigationOptions {
  state?: unknown;
}

declare class AppHistoryNavigateEvent extends Event {
  constructor(type: string, eventInit: AppHistoryNavigateEventInit);

  readonly navigationType: AppHistoryNavigationType;
  readonly canRespond: boolean;
  readonly userInitiated: boolean;
  readonly hashChange: boolean;
  readonly destination: AppHistoryDestination;
  readonly signal: AbortSignal;
  readonly formData: FormData|null;
  readonly info: unknown;

  respondWith(newNavigationAction: Promise<void>): void;
}

interface AppHistoryNavigateEventInit extends EventInit {
  navigationType?: AppHistoryNavigationType;
  canRespond?: boolean;
  userInitiated?: boolean;
  hashChange?: boolean;
  destination: AppHistoryDestination;
  signal: AbortSignal;
  formData?: FormData|null;
  info?: unknown;
}

declare class AppHistoryDestination {
  readonly url: string;
  readonly key: string|null;
  readonly id: string|null;
  readonly index: number;
  readonly sameDocument: boolean;

  getState(): unknown;
}
