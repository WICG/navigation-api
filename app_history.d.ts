interface Window {
  readonly appHistory: AppHistory;
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

  onnavigate: ((this: AppHistory, ev: Event) => any)|null;
  onnavigatesuccess: ((this: AppHistory, ev: Event) => any)|null;
  onnavigateerror: ((this: AppHistory, ev: Event) => any)|null;
}

declare class AppHistoryTransition {
  readonly navigationType: AppHistoryNavigationType;
  readonly from: AppHistoryEntry;
  readonly finished: Promise<void>;

  rollback(options?: AppHistoryNavigationOptions): Promise<void>;
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
}

type AppHistoryNavigationType = 'reload'|'push'|'replace'|'traverse';

declare class AppHistoryNavigationOptions {
  navigateInfo?: unknown;
}

declare class AppHistoryNavigateOptions extends AppHistoryNavigationOptions {
  state?: unknown;
  replace?: boolean;
}

declare class AppHistoryReloadOptions extends AppHistoryNavigationOptions {
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

declare class AppHistoryNavigateEventInit extends EventInit {
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
