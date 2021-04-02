# App history navigation details

[Navigation interception](./README.md#navigation-monitoring-and-interception) using app history can be complicated. There are a lot of moving parts and events. This document details several scenarios and walks through how they work in detail.

TODO: research where in these sequences accessibility technology should integrate, by researching where AT integrates into typical cross-document navigations.

## Same-document

### Immediately-successful `respondWith()`

```js
appHistory.addEventListener("navigate", e => {
  e.respondWith(Promise.resolve());
});

location.hash = "#foo";
console.log(location.hash);
```

Synchronously:

1. `navigate` fires on `window.appHistory`.
1. `appHistory.current` fires `navigatefrom`.
1. `location.href` updates.
1. `appHistory.current` and `appHistory.transition` update.
1. `currentchange` fires on `window.appHistory`.
1. `appHistory.current` fires `navigateto`.
1. Any now-unreachable `AppHistoryEntry` instances fire `dispose`.
1. The `console.log()` outputs `"#foo"`

Asynchronously but basically immediately:

1. The URL bar updates.

After the promise settles in one microtask:

1. `appHistory.current` fires `finish`.
1. `navigatesuccess` is fired on `appHistory`.
1. `appHistory.transition.finished` fulfills.
1. `appHistory.transition` updates back to null.

### No interception

```js
appHistory.addEventListener("navigate", e => {
  // Do nothing.
});

location.hash = "#foo";
console.log(location.hash);
```

This is the same as the previous case.

### Cancelation

```js
appHistory.addEventListener("navigate", e => {
  e.preventDefault();
});

location.hash = "#foo";
console.log(location.hash);
```

Synchronously:

1. `navigate` fires on `window.appHistory`. The event gets canceled.
1. The `console.log()` outputs `""` (or whatever the old hash was).

## Same-origin `respondWith()`, cross-document

When performing a same-origin navigations, `respondWith()` can be used to take over the navigation and convert it to a same-document navigation, even if it would normally be a cross-document navigation.

### Delayed success

```js
appHistory.addEventListener("navigate", e => {
  e.respondWith(new Promise(r => setTimeout(r, 10_000)));
});

location.href = "/foo";
console.log(location.href);
```

Synchronously:

1. `navigate` fires on `window.appHistory`.
1. `appHistory.current` fires `navigatefrom`.
1. `location.href` updates.
1. `appHistory.current` and `appHistory.transition` update.
1. `currentchange` fires on `window.appHistory`.
1. `appHistory.current` fires `navigateto`.
1. Any now-unreachable `AppHistoryEntry` instances fire `dispose`.
1. The `console.log()` outputs `"/foo"`.

Asynchronously but basically immediately:

1. The URL bar updates to show `/foo`.
1. Any loading spinner UI starts.

After the promise fulfills in ten seconds:

1. `appHistory.current` fires `finish`.
1. `navigatesuccess` is fired on `appHistory`.
1. `appHistory.transition.finished` fulfills.
1. `appHistory.transition` updates back to null.
1. Any loading spinner UI stops.

### Delayed failure

```js
appHistory.addEventListener("navigate", e => {
  e.respondWith(new Promise((r, reject) => setTimeout(() => reject(new Error("bad")), 10_000)));
});

location.href = "/foo";
console.log(location.href);
```

Synchronously:

1. `navigate` fires on `window.appHistory`.
1. `appHistory.current` fires `navigatefrom`.
1. `location.href` updates.
1. `appHistory.current` and `appHistory.transition` update.
1. `currentchange` fires on `window.appHistory`.
1. `appHistory.current` fires `navigateto`.
1. Any now-unreachable `AppHistoryEntry` instances fire `dispose`.
1. The `console.log()` outputs `"/foo"`.

Asynchronously but basically immediately:

1. The URL bar updates to show `/foo`.
1. Any loading spinner UI starts.

After the promise rejects in ten seconds:

1. `appHistory.current` fires `finish`.
1. `navigateerror` is fired on `window.appHistory`, with the `new Error("bad")` exception.
1. `appHistory.transition.finished` rejects, with the `new Error("bad")` exception.
1. `appHistory.transition` updates back to null.
1. Any loading spinner UI stops.

Note: any unreachable `AppHistoryEntry`s disposed as part of the synchronous block do not get resurrected.

### Interrupting a slow navigation

```js
appHistory.addEventListener("navigate", e => {
  e.respondWith((async () => {
    await new Promise(r => setTimeout(r, 10_000));

    // Since there's no setTimeout-that-takes-an-AbortSignal we check manually here.
    // A manual check isn't needed if you're doing something like fetch(..., { signal: e.signal }).
    if (!e.signal.aborted) {
      document.body.innerHTML = `navigated to ${e.destination.url}`;
    }
  })());
});

location.href = "/foo";
console.log(location.href);

setTimeout(() => {
  location.href = "/bar";
  console.log(location.href);
}, 1_000);
```

Synchronously:

1. `navigate` fires on `window.appHistory`.
1. `appHistory.current` fires `navigatefrom`.
1. `location.href` updates to `"/foo"`.
1. `appHistory.current` updates to a new `AppHistoryEntry` representing `/foo`, and `appHistory.transition` updates to represent the transition from the starting URL to `/foo`.
1. `currentchange` fires on `window.appHistory`.
1. `appHistory.current` fires `navigateto`.
1. Any now-unreachable `AppHistoryEntry` instances fire `dispose`.
1. The `console.log()` outputs `"/foo"`.

Asynchronously but basically immediately:

1. The URL bar updates to show `/foo`.
1. Any loading spinner UI starts.

After one second:

1. `navigateerror` fires on `window.appHistory`, with an `"AbortError"` `DOMException`.
1. `appHistory.transition.finished` rejects with that `"AbortError"` `DOMException`.
1. `appHistory.current` fires `navigatefrom`.
1. `location.href` updates to `"/bar"`.
1. `appHistory.current` changes to a new `AppHistoryEntry` representing `/bar`, and `appHistory.transition` updates to represent the transition from `/foo` to `/bar` (_not_ from the starting URL to `/bar`).
1. `currentchange` fires on `window.appHistory`.
1. `appHistory.current` fires `navigateto`.
1. The `event.signal` for the navigation to `/foo` fires an `"abort"` event.
1. Any loading spinner UI stops, but then restarts. (Or maybe it never stops.)
1. The second `console.log()` outputs `"/bar"`.

After ten seconds:

1. The `setTimeout()` promise inside the original navigation to `/foo` fulfills.
1. But, `e.signal.aborted` is `true`, so the code inside the `navigate` handler does nothing.

After eleven seconds:

1. The `setTimeout()` promise inside the navigation to `/bar` fulfills.
1. Since `e.signal.aborted` is `false`, the code inside the `navigate` handler updates `document.body.innerHTML`.
1. `appHistory.current` fires `finish`.
1. `navigatesuccess` is fired on `appHistory`.
1. `appHistory.transition.finished` fulfills.
1. `appHistory.transition` updates back to null.
1. Any loading spinner UI stops.

### Trying to interrupt a slow navigation, but the `navigate` handler doesn't care

This is a modification of the above example where the web developer does not pay attention to the `signal` property of the event. It shows exactly what goes wrong in that case. Changes are **bolded**.

```js
appHistory.addEventListener("navigate", e => {
  e.respondWith((async () => {
    await new Promise(r => setTimeout(r, 10_000));
    document.body.innerHTML = `navigated to ${e.destination.url}`;
  })());
});

location.href = "/foo";
console.log(location.href);

setTimeout(() => {
  location.href = "/bar";
  console.log(location.href);
}, 1_000);
```

Synchronously:

1. `navigate` fires on `window.appHistory`.
1. `appHistory.current` fires `navigatefrom`.
1. `location.href` updates to `"/foo"`.
1. `appHistory.current` updates to a new `AppHistoryEntry` representing `/foo`, and `appHistory.transition` updates to represent the transition from the starting URL to `/foo`.
1. `currentchange` fires on `window.appHistory`.
1. `appHistory.current` fires `navigateto`.
1. Any now-unreachable `AppHistoryEntry` instances fire `dispose`.
1. The `console.log()` outputs `"/foo"`.

Asynchronously but basically immediately:

1. The URL bar updates to show `/foo`.
1. Any loading spinner UI starts.

After one second:

1. `navigateerror` fires on `window.appHistory`, with an `"AbortError"` `DOMException`.
1. `appHistory.current` fires `navigatefrom`.
1. `location.href` updates to `"/bar"`.
1. `appHistory.current` changes to a new `AppHistoryEntry` representing `/bar`, and `appHistory.transition` updates to represent the transition from `/foo` to `/bar` (_not_ from the starting URL to `/bar`).
1. `currentchange` fires on `window.appHistory`.
1. `appHistory.current` fires `navigateto`.
1. The `event.signal` for the navigation to `/foo` fires an `"abort"` event. (But nobody is listening to it.)
1. Any loading spinner UI stops, but then restarts. (Or maybe it never stops.)
1. The second `console.log()` outputs `"/bar"`.

After ten seconds:

1. The `setTimeout()` promise inside the original navigation to `/foo` fulfills.
1. **The code inside the `navigate` handler updates the body to `"navigated to /foo"`. (Note that this mismatches `location.href`!)**

After eleven seconds:

1. The `setTimeout()` promise inside the navigation to `/bar` fulfills.
1. The code inside the `navigate` handler updates the body to `"navigated to /bar"`. (Now it matches `location.href` again.)
1. `appHistory.current` fires `finish`.
1. `navigatesuccess` is fired on `appHistory`.
1. `appHistory.transition.finished` fulfills.
1. `appHistory.transition` updates back to null.
1. Any loading spinner UI stops.
