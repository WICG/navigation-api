interface Window {
  readonly appHistory: AppHistory;
}

interface AppHistory extends EventTarget {
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

  onnavigate: ((ev: Event) => any)|null;
  onnavigatesuccess: ((ev: Event) => any)|null;
  onnavigateerror: ((ev: Event) => any)|null;
}

interface AppHistoryTransition {
  readonly navigationType: AppHistoryNavigationType;
  readonly from: AppHistoryEntry;
  readonly finished: Promise<void>;

  rollback(options?: AppHistoryNavigationOptions): Promise<void>;
}

interface AppHistoryEntry extends EventTarget {
  readonly key: string;
  readonly id: string;
  readonly url: string;
  readonly index: number;
  readonly sameDocument: boolean;

  getState(): unknown;

  onnavigateto: ((ev: Event) => any)|null;
  onnavigatefrom: ((ev: Event) => any)|null;
  onfinish: ((ev: Event) => any)|null;
  ondispose: ((ev: Event) => any)|null;
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
  constructor(type: string, eventInit?: AppHistoryNavigateEventInit);

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
  destination?: AppHistoryDestination;
  signal?: AbortSignal;
  formData?: FormData|null;
  info?: unknown;
}

interface AppHistoryDestination {
  readonly url: string;
  readonly attribute: string;
  readonly key: string|null;
  readonly id: string|null;
  readonly index: number;
  readonly sameDocument: boolean;

  getState(): unknown;
}
