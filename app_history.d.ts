interface Window {
  readonly appHistory: AppHistory;
}

interface AppHistoryEventMap {
  "navigate": AppHistoryNavigateEvent;
  "navigatesuccess": Event;
  "navigateerror": ErrorEvent;
  "currentchange": AppHistoryCurrentChangeEvent;
}

interface AppHistoryResult {
  committed: Promise<AppHistoryEntry>;
  finished: Promise<AppHistoryEntry>;
}

declare class AppHistory extends EventTarget {
  entries(): AppHistoryEntry[];
  readonly current: AppHistoryEntry|null;
  updateCurrent(options: AppHistoryUpdateCurrentOptions): void;
  readonly transition: AppHistoryTransition|null;

  readonly canGoBack: boolean;
  readonly canGoForward: boolean;

  navigate(url: string, options?: AppHistoryNavigateOptions): AppHistoryResult;
  reload(options?: AppHistoryReloadOptions): AppHistoryResult;

  goTo(key: string, options?: AppHistoryNavigationOptions): AppHistoryResult;
  back(options?: AppHistoryNavigationOptions): AppHistoryResult;
  forward(options?: AppHistoryNavigationOptions): AppHistoryResult;

  onnavigate: ((this: AppHistory, ev: AppHistoryNavigateEvent) => any)|null;
  onnavigatesuccess: ((this: AppHistory, ev: Event) => any)|null;
  onnavigateerror: ((this: AppHistory, ev: ErrorEvent) => any)|null;
  oncurrentchange: ((this: AppHistory, ev: AppHistoryCurrentChangeEvent) => any)|null;

  addEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener<K extends keyof AppHistoryEventMap>(type: K, listener: (this: AppHistory, ev: AppHistoryEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare class AppHistoryTransition {
  readonly navigationType: AppHistoryNavigationType;
  readonly from: AppHistoryEntry;
  readonly finished: Promise<void>;

  rollback(options?: AppHistoryNavigationOptions): AppHistoryResult;
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

interface AppHistoryUpdateCurrentOptions {
  state: unknown;
}

interface AppHistoryNavigationOptions {
  info?: unknown;
}

interface AppHistoryNavigateOptions extends AppHistoryNavigationOptions {
  state?: unknown;
  replace?: boolean;
}

interface AppHistoryReloadOptions extends AppHistoryNavigationOptions {
  state?: unknown;
}

declare class AppHistoryCurrentChangeEvent extends Event {
  constructor(type: string, eventInit: AppHistoryCurrentChangeEventInit);

  readonly navigationType: AppHistoryNavigationType|null;
  readonly from: AppHistoryEntry;
}

interface AppHistoryCurrentChangeEventInit extends EventInit {
  navigationType?: AppHistoryNavigationType|null;
  from: AppHistoryEntry;
}

declare class AppHistoryNavigateEvent extends Event {
  constructor(type: string, eventInit: AppHistoryNavigateEventInit);

  readonly navigationType: AppHistoryNavigationType;
  readonly canTransition: boolean;
  readonly userInitiated: boolean;
  readonly hashChange: boolean;
  readonly destination: AppHistoryDestination;
  readonly signal: AbortSignal;
  readonly formData: FormData|null;
  readonly info: unknown;

  transitionWhile(newNavigationAction: Promise<any>): void;
}

interface AppHistoryNavigateEventInit extends EventInit {
  navigationType?: AppHistoryNavigationType;
  canTransition?: boolean;
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
