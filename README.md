# Navigation API

_[Formerly known as](https://github.com/WICG/navigation-api/issues/83) the app history API_

The web's existing [history API](https://developer.mozilla.org/en-US/docs/Web/API/History) is problematic for a number of reasons, which makes it hard to use for web applications. This proposal introduces a new API encompassing navigation and history traversal, which is more directly usable by web application developers. Its scope is: initiating navigations, intercepting navigations, and history introspection and mutation.

This new `window.navigation` API [layers](#integration-with-the-existing-history-api-and-spec) on top of the existing API and specification infrastructure, with well-defined interaction points. The main differences are that it is scoped to the current origin and frame, and it is designed to be pleasant to use instead of being a historical accident with many sharp edges.

## Summary

The existing [history API](https://developer.mozilla.org/en-US/docs/Web/API/History), including its ability to cause same-document navigations via `history.pushState()` and `history.replaceState()`, is hard to deal with in practice, especially for single-page applications. In the best case, developers can work around this with various hacks. In the worst case, it causes user-facing pain in the form of lost state and broken back buttons, or the inability to achieve the desired navigation flow for a web app.

The main problems are:

- Managing and introspecting your application's history list, and associated application state, is fragile. State can be lost sometimes (e.g. due to fragment navigations); the browser will spontaneously insert entries due to iframe navigations; and the existing `popstate` and `hashchange` events are [unreliable](https://github.com/whatwg/html/issues/5562). We solve this by providing a view only onto the history entries created directly by the application, and the ability to look at all previous entries for your app so that no state is ever lost.

- It's hard to figure out all the ways that navigations can occur, so that an application can synchronize its state or convert those navigations into single-page navigations. We solve this by exposing events that allow the application to observe all navigation actions, and substitute their own behavior in place of the default.

- Various parts of the platform, e.g. accessibility technology, the browser's UI, and performance APIs, do not have good visibility into single-page navigations. We solve this by providing a standardized API for telling the browser when a single-page navigation starts and finishes.

- Some of the current navigation and history APIs are clunky and hard to understand. We solve this by providing a new interface that is easy for developers to use and understand.

## Sample code

An application or framework's centralized router can use the `navigate` event to implement single-page app routing:

```js
navigation.addEventListener("navigate", e => {
  if (!e.canIntercept || e.hashChange || e.downloadRequest !== null) {
    return;
  }

  if (routesTable.has(e.destination.url)) {
    const routeHandler = routesTable.get(e.destination.url);
    e.intercept({ handler: routeHandler });
  }
});
```

A page-supplied "back" button can actually take you back, even after reload, by inspecting the previous history entries:

```js
backButtonEl.addEventListener("click", () => {
  if (navigation.entries()[navigation.currentEntry.index - 1]?.url === "/product-listing") {
    navigation.back();
  } else {
    // If the user arrived here by typing the URL directly:
    navigation.navigate("/product-listing", { history: "replace" });
  }
});
```

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of contents

- [Problem statement](#problem-statement)
- [Goals](#goals)
- [Proposal](#proposal)
  - [The current entry](#the-current-entry)
  - [Inspection of the history entry list](#inspection-of-the-history-entry-list)
  - [Navigation through the history entry list](#navigation-through-the-history-entry-list)
  - [Keys and IDs](#keys-and-ids)
  - [Navigation monitoring and interception](#navigation-monitoring-and-interception)
    - [Example: replacing navigations with single-page app navigations](#example-replacing-navigations-with-single-page-app-navigations)
    - [Example: async transitions with special back/forward handling](#example-async-transitions-with-special-backforward-handling)
    - [Example: progressively enhancing form submissions](#example-progressively-enhancing-form-submissions)
    - [Restrictions on firing, canceling, and responding](#restrictions-on-firing-canceling-and-responding)
    - [Measuring standardized single-page navigations](#measuring-standardized-single-page-navigations)
    - [Aborted navigations](#aborted-navigations)
  - [Customizations and consequences of navigation interception](#customizations-and-consequences-of-navigation-interception)
    - [Accessibility technology announcements](#accessibility-technology-announcements)
    - [Loading spinners and stop buttons](#loading-spinners-and-stop-buttons)
    - [Focus management](#focus-management)
    - [Scrolling to fragments and scroll resetting](#scrolling-to-fragments-and-scroll-resetting)
    - [Scroll position restoration](#scroll-position-restoration)
    - [Deferred commit](#deferred-commit)
  - [Transitional time after navigation interception](#transitional-time-after-navigation-interception)
    - [Example: handling failed navigations](#example-handling-failed-navigations)
  - [The `navigate()` and `reload()` methods](#the-navigate-and-reload-methods)
    - [Example: using `info`](#example-using-info)
    - [Example: next/previous buttons](#example-nextprevious-buttons)
  - [Setting the current entry's state without navigating](#setting-the-current-entrys-state-without-navigating)
  - [Notifications on entry disposal](#notifications-on-entry-disposal)
  - [Current entry change monitoring](#current-entry-change-monitoring)
  - [Complete event sequence](#complete-event-sequence)
- [Guide for migrating from the existing history API](#guide-for-migrating-from-the-existing-history-api)
  - [Performing navigations](#performing-navigations)
  - [Warning: back/forward are not always opposites](#warning-backforward-are-not-always-opposites)
  - [Using `navigate` handlers](#using-navigate-handlers)
  - [Attaching and using history state](#attaching-and-using-history-state)
  - [Introspecting the history list](#introspecting-the-history-list)
  - [Watching for navigations](#watching-for-navigations)
- [Integration with the existing history API and spec](#integration-with-the-existing-history-api-and-spec)
  - [Correspondence with session history entries](#correspondence-with-session-history-entries)
  - [Correspondence with the joint session history](#correspondence-with-the-joint-session-history)
  - [Integration with navigation](#integration-with-navigation)
- [Impact on the back button and user agent UI](#impact-on-the-back-button-and-user-agent-ui)
- [Security and privacy considerations](#security-and-privacy-considerations)
- [Future extensions](#future-extensions)
  - [More per-entry events](#more-per-entry-events)
  - [Performance timeline API integration](#performance-timeline-api-integration)
  - [Navigation transition rollbacks and redirects](#navigation-transition-rollbacks-and-redirects)
  - [More](#more)
- [Stakeholder feedback](#stakeholder-feedback)
- [Acknowledgments](#acknowledgments)
- [Appendix: types of navigations](#appendix-types-of-navigations)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Problem statement

Web application developers, as well as the developers of router libraries for single-page applications, want to accomplish a number of use cases related to history:

- Intercepting cross-document navigations, replacing them with single-page navigations (i.e. loading content into the appropriate part of the existing document), and then updating the URL bar.

- Performing single-page navigations that create and push a new entry onto the history list, to represent a new conceptual history entry.

- Navigating backward or forward through the history list via application-provided UI.

- Synchronizing application or UI state with the current position in the history list, so that user- or application-initiated navigations through the history list appropriately restore application/UI state.

The existing [history API](https://developer.mozilla.org/en-US/docs/Web/API/History) is difficult to use for these purposes. The fundamental problem is that `window.history` surfaces the joint session history of a browsing session, and so gets updated in response to navigations in nested frames, or cross-origin navigations. Although this view is important for the user, especially in terms of how it impacts their back button, it doesn't map well to web application development. A web application cares about its own, same-origin, current-frame history entries, and having to deal with the entire joint session history makes this very painful. Even in a carefully-crafted web app, a single iframe can completely mess up the application's history.

The existing history API also has a number of less-fundamental, but still very painful, problems around how its API shape has grown organically, with only very slight considerations for single-page app architectures. For example, it provides no mechanism for intercepting navigations; to do this, developers have to intercept all `click` events, cancel them, and perform the appropriate `history.pushState()` call. The `history.state` property is a very bad storage mechanism for application and UI state, as it disappears and reappears as you transition throughout the history list, instead of allowing access to earlier entries in the list. And the ability to navigate throughout the list is limited to numeric offsets, with `history.go(-2)` or similar; thus, navigating back to an actual specific state requires keeping a side table mapping history indices to application states.

To hear more detail about these problems, in the words of a web developer, see [@dvoytenko](https://github.com/dvoytenko)'s ["The case for the new Web History API"](https://github.com/dvoytenko/web-history-api/blob/master/problem.md). See also [@housseindjirdeh](https://github.com/housseindjirdeh)'s ["History API and JavaScript frameworks"](https://docs.google.com/document/d/1gLW_FlR_wD93ZWXWmH14q0UssBaR0eGMk8njyr6p3cE/edit).

## Goals

Overall, our guiding principle is to make it easy for web application developers to write applications which give good user experiences in terms of the history list, back button, and other navigation UI (such as open-in-new-tab). We believe this is too hard today with the `window.history` API.

From an API perspective, our primary goals are as follows:

- Allow easy conversion of cross-document navigations into single-page app same-document navigations, without fragile hacks like a global `click` handler.

- Improve the accessibility of single-page app navigations ([1](https://github.com/w3c/aria/issues/1353), [2](https://docs.google.com/document/d/1MYClmO3FkjhSuSYKlVPVDnXvtOm-yzG15SY9jopJIxQ/edit#), [3](https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/)), ideally to be on par with cross-document navigations, when they are implemented using this API.

- Provide a uniform way to signal single-page app navigations, including their duration.

- Provide a reliable system to tie application and UI state to history entries.

- Continue to support the pattern of allowing the history list to contain state that is not serialized to the URL. (This is possible with `history.pushState()` today.)

- Provide events for notifying the application about navigations and traversals, which they can use to synchronize application or UI state.

- Allow metrics code to watch for navigations, including gathering timing information about how long they took, without interfering with the rest of the application.

- Provide a way for an application to reliably navigate through its own history list.

- Provide a reasonable layering onto and integration with the existing `window.history` API, in terms of spec primitives and ensuring non-terrible behavior when both are used.

Non-goals:

- Allow web applications to intercept user-initiated navigations in a way that would trap the user (e.g., disabling the URL bar or back button).

- Provide applications knowledge of cross-origin history entries or state.

- Provide applications knowledge of other frames' entries or state.

- Provide platform support for the coordination problem of multiple routers (e.g., per-UI-component routers) on a single page. We plan to leave this coordination to frameworks for now (with the frameworks using the new API).

- Handle the case where the Android back button is being used as a "close signal"; instead, we believe that's best handled by [a separate API](https://github.com/domenic/close-watcher).

- Provide any handling for preventing navigations that might lose data: this is already handled orthogonally by the platform's `beforeunload` event.

- Provide an _elegant_ layering onto or integration with the existing `window.history` API. That API is quite problematic, and we can't be tied down by a need to make every operation in the new API isomorphic to one in the old API.

A goal that might not be possible, but we'd like to try:

- It would be ideal if this API were polyfillable, especially in its mainline usage scenarios.

Finally, although it's really a goal for all web APIs, we want to call out a strong focus on interoperability, backstopped by [web platform tests](http://web-platform-tests.org/). The existing history API and its interactions with navigation have terrible interoperability (see [this vivid example](https://docs.google.com/document/d/1Pdve-DJ1JCGilj9Yqf5HxRJyBKSel5owgOvUJqTauwU/edit#)). We hope to have solid and well-tested specifications for:

- Every aspect and self-interaction of the new API

- Every aspect of how the new API integrates and interacts with the `window.history` API (including things like relative timing of events)

Additionally, we hope to drive interoperability through tests, spec updates, and browser bugfixes for the existing `window.history` API while we're in the area, to the extent that is possible; some of this work is being done in [whatwg/html#5767](https://github.com/whatwg/html/issues/5767).

## Proposal

### The current entry

The entry point for the new navigation API is `window.navigation`. Let's start with `navigation.currentEntry`, which is an instance of the new `NavigationHistoryEntry` class. This class has the following readonly properties:

- `id`: a user-agent-generated UUID identifying this particular `NavigationHistoryEntry`. This will be changed upon any mutation of the current history entry, such as replacing its state or updating the current URL.

- `key`: a user-agent-generated UUID identifying this history entry "slot". This will stay the same even if the entry is replaced.

- `index`: the index of this `NavigationHistoryEntry` within the (`Window`- and origin-specific) history entry list. (Or, `-1` if the entry is no longer in the list, or not yet in the list.)

- `url`: the URL of this history entry (as a string).

- `sameDocument`: a boolean indicating whether this entry is for the current document, or whether navigating to it will require a full navigation (either from the network, or from the browser's back/forward cache). Note: for `navigation.currentEntry`, this will always be `true`.

It also has a method `getState()`, which retrieve the navigation API state for the entry. This is somewhat similar to `history.state`, but it will survive fragment navigations, and `getState()` always returns a fresh clone of the state to avoid the [misleading nature of `history.state`](https://github.com/WICG/navigation-api/issues/36):

```js
navigation.reload({ state: { test: 2 } });

// Don't do this: it won't be saved to the stored state.
navigation.currentEntry.getState().test = 3;

console.assert(navigation.currentEntry.getState().test === 2);

// Instead do this, combined with a `navigate` event handler:
navigation.reload({ state: { ...navigation.currentEntry.getState(), test: 3 } });
```

Crucially, `navigation.currentEntry` stays the same regardless of what iframe navigations happen. It only reflects the current entry for the current frame. The complete list of ways the current navigation API history entry can change to a new entry (with a new `NavigationHistoryEntry` object, and a new `key` value) are:

- A fragment navigation, which will copy over the navigation API state to the new entry.

- Via `history.pushState()`. (Not `history.replaceState()`.)

- A full-page navigation to a different document. This could be an existing document in the browser's back/forward cache, or a new document. In the latter case, this will generate a new entry on the new page's `window.navigation.entries()` list, somewhat similar to `navigation.navigate(navigatedToURL, { state: undefined })`. Note that if the navigation is cross-origin, then we'll end up in a separate navigation API history entries list for that other origin.

- When using the `navigate` event to [convert a cross-document non-replace navigation into a same-document navigation](#navigation-monitoring-and-interception).

The current entry can be replaced with a new entry, with a new `NavigationHistoryEntry` object and a new `id` (but usually the same `key`), in the following ways:

- Via `history.replaceState()`.

- Via cross-document replace navigations generated by `location.replace()` or `navigation.navigate(url, { history: "replace", ... })`. Note that if the navigation is cross-origin, then we'll end up in a separate navigation API history entry list for that other origin, where `key` will not be preserved.

- When using the `navigate` event to [convert a cross-document replace navigation into a same-document navigation](#navigation-monitoring-and-interception).

For any same-document navigation, traversal, or replacement, the `currententrychange` event will fire on `navigation`:

```js
navigation.addEventListener("currententrychange", () => {
  // navigation.currentEntry has changed: either to a completely new entry (with a new key),
  // or it has been replaced (keeping the same key but with a new id).
});
```

### Inspection of the history entry list

In addition to the current entry, the entire list of history entries can be inspected, using `navigation.entries()`, which returns an array of `NavigationHistoryEntry` instances. (Recall that all navigation API history entries are same-origin contiguous entries for the current frame, so this is not a security issue.)

This solves the problem of allowing applications to reliably store state in a `NavigationHistoryEntry`'s state: because they can inspect the values stored in previous entries at any time, it can be used as real application state storage, without needing to keep a side table like one has to do when using `history.state`.

Note that we have a method, `navigation.entries()`, instead of a static array, `navigation.entries`, to emphasize that retrieving the entries gives you a snapshot at a given point in time. That is, the current set of history entries could change at any point due to manipulations of the history list, including by the user.

In combination with the following section, the `entries()` API also allows applications to display a UI allowing navigation through the entry list.

### Navigation through the history entry list

The way for an application to navigate through the history entry list is using `navigation.traverseTo(key)`. For example:

```js
function renderHomepage() {
  const homepageKey = navigation.currentEntry.key;

  // ... set up some UI ...

  document.querySelector("#home-button").addEventListener("click", async e => {
    try {
      await navigation.traverseTo(homepageKey).finished;
    } catch {
      // Fall back to a normal push navigation
      navigation.navigate("/");
    }
  });
}
```

Unlike the existing history API's `history.go()` method, which navigates by offset, traversing by key allows the application to not care about intermediate history entries; it just specifies its desired destination entry. There are also convenience methods, `navigation.back()` and `navigation.forward()`, and convenience booleans, `navigation.canGoBack` and `navigation.canGoForward`.

All of these methods return `{ committed, finished }` pairs, where both values are promises. This because navigations can be intercepted and made asynchronous by the `navigate` event handlers that we're about to describe in the next section. There are then several possible outcomes:

- A `navigate` event handler calls `event.preventDefault()`, in which case both promises reject with an `"AbortError"` `DOMException`, and `location.href` and `navigation.currentEntry` stay on their original value.

- It's not possible to navigate to the given entry, e.g. `navigation.traverseTo(key)` was given a non-existant `key`, or `navigation.back()` was called when there's no previous entries in the list of accessible history entries. In this case, both promises reject with an `"InvalidStateError"` `DOMException`, and `location.href` and `navigation.currentEntry` stay on their original value.

- The `navigate` event responds to the navigation using `event.intercept()` with a `commit` option of `"immediate"` (the default). In this case the `committed` promise immediately fulfills, while the `finished` promise fulfills or rejects according to any promise(s) returned by handlers passed to `intercept()`. (However, even if the `finished` promise rejects, `location.href` and `navigation.currentEntry` will change.)

- The `navigate` event listener responds to the navigation using `event.intercept()` with a `commit` option of `"after-transition"`. In this case the `committed` promise fulfills and `location.href` and `navigation.currentEntry` change when `event.commit()` is called. The `finished` promise fulfills or rejects according to any promise(s) returned by handlers passed to `intercept()`. If a promise returned by a handler rejects before `event.commit()` is called, then both the `committed` and `finished` promises reject and `location.href` and `navigation.currentEntry` do not update. If all promise(s) returned by handlers fulfill, but the `committed` promise has not yet fulfilled, the `committed` promise will be fulfilled and and `location.href` and `navigation.currentEntry` will be updated first, then `finished` will fulfill.

- The navigation succeeds, and was a same-document navigation (but not intercepted using `event.intercept()`). Then both promises immediately fulfill,  and `location.href` and `navigation.currentEntry` will have been set to their new value.

- The navigation succeeds, and it was a different-document navigation. Then the promise will never settle, because the entire document and all its promises will disappear.

In all cases, the fulfillment value for the promises is the `NavigationHistoryEntry` being navigated to. This can be useful for setting up [per-entry event](#per-entry-events) handlers.

As discussed in more detail in the section on [integration with the existing history API and spec](#integration-with-the-existing-history-api-and-spec), navigating through the navigation API history list does navigate through the joint session history. This means it _can_ impact other frames on the page. It's just that, unlike `history.back()` and friends, such other-frame navigations always happen as a side effect of navigating your own frame; they are never the sole result of a navigation API traversal. (An interesting consequence of this is that [`navigation.back()` and `navigation.forward()` are not always opposites](#warning-backforward-are-not-always-opposites).)

### Keys and IDs

As noted [above](#the-current-entry), `key` stays stable to represent the "slot" in the history list, whereas `id` gets updated whenever the history entry is updated. This allows them to serve distinct purposes:

- `key` provides a stable identifier for a given slot in the history entry list, for use by the `navigation.traverseTo()` method which allows navigating to specific waypoints within the history list.

- `id` provides an identifier for the specific URL and navigation API state currently in the entry, which can be used to correlate a history entry with an out-of-band resource such as a cache.

With the `window.history` API, web applications have tried to use the URL for such purposes, but the URL is not guaranteed to be unique within a given history list.

Note that both `key` and `id` are user-agent-generated random UUIDs. This is done, instead of e.g. using a numeric index, to encourage treating them as opaque identifiers.

Both `key` and `id` are stored in the browser's session history, and as such are stable across session restores.

Note that `key` is not a stable identifier for a slot in the _joint session history list_, but instead in the _navigation API history entry list_. In particular, this means that if a given history entry is replaced with a cross-origin one, which lives in a different navigation API history list, it will get a new key. (This replacement prevents cross-site tracking.)

### Navigation monitoring and interception

The most interesting event on `window.navigation` is the one which allows monitoring and interception of navigations: the `navigate` event. It fires on almost any navigation, either user-initiated or application-initiated, which would update the value of `navigation.currentEntry`. This includes cross-origin navigations (which will take us out of the current navigation API history entry list). **We expect this to be the main event used by application- or framework-level routers.**

The event object has several useful properties:

- `cancelable` (inherited from `Event`): indicates whether `preventDefault()` is allowed to cancel this navigation.

- `canIntercept`: indicates whether `intercept()`, discussed below, is allowed for this navigation.

- `navigationType`: either `"reload"`, `"push"`, `"replace"`, or `"traverse"`.

- `userInitiated`: a boolean indicating whether the navigation is user-initiated (i.e., a click on an `<a>`, or a form submission) or application-initiated (e.g. `location.href = ...`, `navigation.navigate(...)`, etc.). Note that this will _not_ be `true` when you use mechanisms such as `button.onclick = () => navigation.navigate(...)`; the user interaction needs to be with a real link or form. See the table in the [appendix](#appendix-types-of-navigations) for more details.

- `destination`: an object containing the information about the destination of the navigation. It has many of the same properties as a `NavigationHistoryEntry`: namely `url`, `sameDocument`, and `getState()` for all navigations, and `id`, `key`, and `index` for same-origin `"traverse"` navigations. (See [#97](https://github.com/WICG/navigation-api/issues/97) for discussion as to whether we should add the latter to non-`"traverse"` same-origin navigations as well.)

- `hashChange`: a boolean, indicating whether or not this is a same-document [fragment navigation](https://html.spec.whatwg.org/#scroll-to-fragid).

- `formData`: a [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) object containing form submission data, or `null` if the navigation is not a form submission.

- `downloadRequest`: a string or null, indicating whether this navigation was initiated by a `<a href="..." download>` link. If it was, then this will contain the value of the attribute (which could be the empty string).

- `info`: any value passed by `navigation.navigate(url, { state, info })`, `navigation.back({ info })`, or similar, if the navigation was initiated by one of those methods and the `info` option was supplied. Otherwise, undefined. See [the example below](#example-using-info) for more.

- `triggeringElement`: an `HTMLElement` or null, indicating what element (if any) initiated this navigation. If the navigation was triggered by a link click, the `triggeringElement` will be the `<a href="...">`. If the navigation was triggered by a form submission, the `triggeringElement` will be the [the element that sent the `submit` event to the form](https://developer.mozilla.org/en-US/docs/Web/API/SubmitEvent/submitter), or if that is null, the `<form>` being submitted.

- `signal`: an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) which can be monitored for when the navigation gets aborted.

Note that you can check if the navigation will be [same-document or cross-document](#appendix-types-of-navigations) via `event.destination.sameDocument`, and you can check whether the navigation is to an already-existing history entry (i.e. is a back/forward navigation) via `event.navigationType`.

The event object has a special method `event.intercept(options)`. This works only under certain circumstances, e.g. it cannot be used on cross-origin navigations. ([See below](#restrictions-on-firing-canceling-and-responding) for full details.) It will:

- Cancel any fragment navigation or cross-document navigation.
- Immediately update the URL bar, `location.href`, and `navigation.currentEntry` unless the `event.intercept()` was called with a `commit` option of `"after-transition"`.
- Create the [`navigation.transition`](#transitional-time-after-navigation-interception) object.
- If `options.handler` is given, it can be a function that returns a promise. That function will be then be called, and the browser will wait for the returned promise to settle. Once it does, the browser will:
  - If the promise rejects, fire `navigateerror` on `navigation` and reject `navigation.transition.finished`.
  - If the promise fulfills, fire `navigatesuccess` on `navigation` and fulfill `navigation.transition.finished`.
  - Set `navigation.transition` to null.
- For the duration of any such promise settling, any browser loading UI such as a spinner will behave as if it were doing a cross-document navigation.

Note that the browser does not wait for any returned promises to settle in order to update its URL/history-displaying UI (such as URL bar or back button), or to update `location.href` and `navigation.currentEntry`, unless a `commit` option of `"after-transition"` is provided to `event.intercept()`. [See below](#deferred-commit) for more details.

If `intercept()` is called multiple times (e.g., by multiple different listeners to the `navigate` event), then all of the promises returned by any handlers will be combined together using the equivalent of `Promise.all()`, so that the navigation only counts as a success once they have all fulfilled, or the navigation counts as an error at the point where any of them reject.

_In [#66](https://github.com/WICG/navigation-api/issues/66), we are discussing adding the capability to delay URL/current entry updates to not happen immediately, as a future extension._

#### Example: replacing navigations with single-page app navigations

The following is the kind of code you might see in an application or framework's router:

```js
navigation.addEventListener("navigate", e => {
  // Some navigations, e.g. cross-origin navigations, we cannot intercept. Let the browser handle those normally.
  if (!e.canIntercept) {
    return;
  }

  // Don't intercept fragment navigations or downloads.
  if (e.hashChange || e.downloadRequest !== null) {
    return;
  }

  e.intercept({
    handler() {
      if (e.formData) {
        processFormDataAndUpdateUI(e.formData, e.signal);
      } else {
        doSinglePageAppNav(e.destination, e.signal);
      }
    }
  });
});
```

Here, `doSinglePageAppNav` and `processFormDataAndUpdateUI` are functions that can return a promise. For example:

```js
async function doSinglePageAppNav(destination, signal) {
  const htmlFromTheServer = await (await fetch(destination.url, { signal })).text();
  document.querySelector("main").innerHTML = htmlFromTheServer;
}
```

Note how this example responds to various types of navigations:

- Cross-origin navigations: let the browser handle it as usual.
- Same-document fragment navigations: let the browser handle it as usual.
- Same-document URL or state updates (via `history.pushState()` or `history.replaceState()`):
  1. Send the information about the URL/state update to `doSinglePageAppNav()`, which will use it to modify the current document.
  1. After that UI update is done, potentially asynchronously, notify the app and the browser about the navigation's success or failure.
- Cross-document normal navigations (including those via `navigation.navigate()`):
  1. Prevent the browser handling, which would unload the document and create a new one from the network. Instead, immediately change the URL bar/`location.href`/`navigation.currentEntry`, while staying on the same document.
  1. Send the information about the navigation to `doSinglePageAppNav()`, which will use it to modify the current document.
  1. After that UI update is done, potentially asynchronously, notify the app and the browser about the navigation's success or failure.
- Cross-document form submissions:
  1. Prevent the browser handling, which would unload the document and create a new one from the network. Instead, immediately change the URL bar/`location.href`/`navigation.currentEntry`, while staying on the same document.
  1. Send the form data to `processFormDataAndUpdateUI()`, which will use it to modify the current document.
  1. After that UI update is done, potentially asynchronously, notify the app and the browser about the navigation's success or failure.

Notice also how by passing through the `AbortSignal` found in `e.signal`, we ensure that any aborted navigations abort the associated fetch as well.

#### Example: async transitions with special back/forward handling

Sometimes it's desirable to handle back/forward navigations specially, e.g. reusing cached views by transitioning them onto the screen. This can be done by branching as follows:

```js
navigation.addEventListener("navigate", e => {
  // As before.
  if (!e.canIntercept || e.hashChange || e.downloadRequest !== null) {
    return;
  }

  e.intercept({ async handler() {
    if (myFramework.currentPage) {
      await myFramework.currentPage.transitionOut();
    }

    let { key } = e.destination;

    if (e.navigationType === "traverse" && myFramework.previousPages.has(key)) {
      await myFramework.previousPages.get(key).transitionIn();
    } else {
      // This will probably result in myFramework storing the rendered page in myFramework.previousPages.
      await myFramework.renderPage(e.destination);
    }
  } });
});
```

#### Example: progressively enhancing form submissions

A common pattern for multi-page web apps is [post/redirect/get](https://en.wikipedia.org/wiki/Post/Redirect/Get), which handles POST form submissions by performing a server-side redirect to a page retrieved with GET. This avoids a POST-derived page from ever entering the session history, since this can lead to confusing "Do you want to resubmit the form?" popups and [interop problems](https://github.com/whatwg/html/issues/6600).

The navigation API's `navigate` event allows emulating this pattern on the client side using code such as the following:

```js
navigation.addEventListener("navigate", e => {
  const url = new URL(e.destination.url);

  switch (url.pathname) {
    case "/form-submit": {
      e.intercept({ async handler() {
        // Do not navigate to form-submit; instead send the data to that endpoint using fetch().
        await fetch("/form-submit", { body: e.formData });

        // Perform a client-side "redirect" to /destination.
        await navigation.navigate("/destination", { history: "replace" }).finished;
      } });
      break;
    }
    case "/destination": {
      e.intercept({ async handler() {
        document.body.innerHTML = "Form submission complete!";
      } });
      break;
    }
  }
});
```

Note how doing a replace navigation to `/destination` overrides the in-progress navigation to `/form-submit`, so that like in the server-driven approach, the session history ends up going straight from the original page to `/destination`, with no entry for `/form-submit`. (This example uses the `navigation.navigate()` API introduced [further down](#the-navigate-and-reload-methods), but you could also do `location.replace("/destination")` for much the same effect.)

What's cool about this example is that, if the browser does not support the new navigation API, then the server-driven post/redirect/get flow will still go through, i.e. the user will see a full-page navigation that leaves them at `/destination`. So this is purely a progressive enhancement.

See [this interactive demo](https://selective-heliotrope-dumpling.glitch.me/) to check out the technique in action, in browsers with or without the new navigation API implemented.

#### Restrictions on firing, canceling, and responding

There are many types of navigations a given page can experience; see [this appendix](#appendix-types-of-navigations) for a full breakdown. Some of these need to be treated specially for the purposes of the navigate event.

First, the following navigations **will not fire `navigate`** at all:

- User-initiated [cross-document](#appendix-types-of-navigations) navigations via non-back/forward browser UI, such as the URL bar, bookmarks, or the reload button
- [Cross-document](#appendix-types-of-navigations) navigations initiated from other cross origin windows, e.g. via `window.open(url, nameOfYourWindow)`, or clicking on `<a href="..." target="nameOfYourWindow">`
- [`document.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/open), which can strip off the fragment from the current document's URL

Navigations of the first sort are outside the scope of the webpage, and can never be intercepted or prevented. This is true even if they are to same-origin documents, e.g. if the browser is currently displaying `https://example.com/foo` and the user edits the URL bar to read `https://example.com/bar` and presses enter. On the other hand, we do allow the page to intercept user-initiated _same_-document navigations via browser UI, e.g. if the the browser is currently displaying `https://example.com/foo` and the user edits the URL bar to read `https://example.com/foo#fragment` and presses enter. (We do fire a `navigate` event for browser-UI back/forward buttons; see more discussion below.)

Similarly, cross-document navigations initiated from other windows are not something that can be intercepted today, and for security reasons, we don't want to introduce the ability for your origin to mess with the operation of another origin's scripts. (Even if the purpose of those scripts is to navigate your frame.)

As for `document.open()`, it is a terrible legacy API with lots of strange side effects, which makes supporting it not worth the implementation cost. Modern sites which use the new navigation API should never be using `document.open()`.

Second, **traversals have special restrictions on canceling the navigation** via `event.preventDefault()`. Traversals are:
- User-initiated traversals via the browser's back/forward buttons (either same- or cross-document)
- Programmatic traversals via `history.back()`/`history.forward()`/`history.go()`
- Programmatic traversals via `navigation.back()`/`navigation.forward()`/`navigation.traverseTo()`

Traversals may only be canceled (and `event.cancelable` will be equal to true) if:
- The navigate event is firing in the top window
- The traversal is same-document
- The traversal was not user-initiated, or there is a consumable activation in the current window.

Allowing cancelation only in the top window is to ensure that there is a single authoritative source for deciding whether or not to cancel the traversal. If all windows were allowed to cancel and a traversal navigated multiple windows, and some canceled but others proceeded, there would not be a good way to keep all windows in sync with the joint session history. Cross-document traversals are uncancelable because of performance concerns. If a cross-document traversal were cancelable, it would need to block before any network requests are sent in order to fire `navigate`. This is already necessary for `beforeunload`, but `beforeunload` is a single-purpose event and if no `beforeunload` handler is present, the blocking step can be skipped. `navigate`, on the other hand, is intended to be used for many purposes, and it is wasteful to impose a performance penalty on all cross-document traversals simply because `navigate` was being used for something unrelated to canceling cross-document navigations.  Finally, user activation is required for user-initiated traversals in order to minimize the possibility of trapping: `event.preventDefault()` on a traversal consumes the user activation, ensuring that the user can always break out of an application that is canceling traversals by, e.g., pressing the browser's back button twice in a row.

By _consumable activation_, we mean a variant of [user activation](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation) that we wish to add to the HTML spec. _Sticky activation_ is obviously not correct for preventing trapping the user, because then a single errant click or tap could disable back/forward navigations entirely. However, we are also concerned about using _transient activation_: it meets our requirement that the user activation can be used once before it is consumed, but the possibility of it expiring due to its _transient activation duration_ elapsing means that web applications may suddenly and unexpectedly get an uncancelable traversal if a back or forward button is pressed and the user happens not to have interacted with the page for a modest period of time. We therefore intend to add a third mode of user activation to the HTML spec, _consumable activation_, which can be consumed like _transient activation_, but does not expire based on the _transient activation duration_.

Because canceling is limited to same-document traversals, no special timing or handler is required for firing `navigate`; the standard fragment navigation timing just works. If the performance concerns around canceling cross-document traversals were to be resolved at some point in the future, special consideration would need to be given to firing `navigate` at the correct time in the traversal process (presumably at the same time that `beforeunload` is fired).

Finally, the following navigations **cannot be replaced with same-document navigations** by using `event.intercept()`, and as such will have `event.canIntercept` equal to false:

- Any navigation to a URL which differs in scheme, username, password, host, or port. (I.e., you can only intercept URLs which differ in path, query, or fragment.)
- Any [cross-document](#appendix-types-of-navigations) back/forward navigations. Transitioning two adjacent history entries from cross-document to same-document has unpleasant ripple effects on web application and browser implementation architecture.

We'll note that these restrictions allow canceling cross-origin non-back/forward navigations. Although this might be surprising, in general it doesn't grant additional power. That is, web developers can already intercept `<a>` `click` events, or modify their code that would set `location.href`, even if the destination URL is cross-origin.

#### Measuring standardized single-page navigations

Continuing with the theme of `intercept()` giving ecosystem benefits beyond just web developer convenience, telling the browser about the start time, duration, end time, and success/failure if a single-page app navigation has benefits for metrics gathering.

In particular, analytics frameworks would be able to consume this information from the browser in a way that works across all applications using the navigation API. See the discussion on [performance timeline API integration](#performance-timeline-api-integration) for what we are proposing there.

This standardized notion of single-page navigations also gives a hook for other useful metrics to build off of. For example, you could imagine variants of the `"first-paint"` and `"first-contentful-paint"` APIs which are collected after the `navigate` event is fired. Or, you could imagine vendor-specific or application-specific measurements like [Cumulative Layout Shift](https://web.dev/cls/) or React hydration time being reset after such navigations begin.

This isn't a complete panacea: in particular, such metrics are gameable by bad actors. Such bad actors could try to drive down average measured "load time" by generating excessive `navigate` events that don't actually do anything. So in scenarios where the web application is less interested in measuring itself, and more interested in driving down specific metrics, those creating the metrics will need to take into account such misuse of the API. Some potential countermeasures against such gaming could include:

- Only using the start time of the navigation in creating such metrics, and not using the promise-settling time. This avoids gaming via code such as `event.intercept(/* no handler */); await doActualNavigation();` which makes the navigation appear instant to the browser.

- Filtering to only count navigations where `event.userInitiated` is true.

- Filtering to only count navigations where the URL changes (i.e., `navigation.currentEntry.url !== event.destination.url`).

- We hope that most analytics vendors will come to automatically track `navigate` events as page views, and measure their duration. Then, apps using such analytics vendors would have an incentive to keep their page view statistics meaningful, and thus be disincentivized to generate spurious navigations.

#### Aborted navigations

As shown in [the example above](#example-replacing-navigations-with-single-page-app-navigations), the `navigate` event comes with an `event.signal` property that is an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). This signal will transition to the aborted state if any of the following occur before any promises returned by handlers passed to `intercept()` settle:

- The user presses their browser's stop button (or similar UI, such as the <kbd>Esc</kbd> key).
- Another navigation is started, either by the user or programmatically. This includes back/forward navigations, e.g. the user pressing their browser's back button.

The signal will not transition to the aborted state if `intercept()` is not called. This means it cannot be used to observe the interruption of a [cross-document](#appendix-types-of-navigations) navigation, if that cross-document navigation was left alone and not converted into a same-document navigation by using `intercept()`.

Whether and how the application responds to this abort is up to the web developer. In many cases, such as in [the example above](#example-replacing-navigations-with-single-page-app-navigations), this will automatically work: by passing the `event.signal` through to any `AbortSignal`-consuming APIs like `fetch()`, those APIs will get aborted, and the resulting `"AbortError"` `DOMException` propagated from the handler passed to `intercept()`. But it's possible to ignore it completely, as in the following example:

```js
navigation.addEventListener("navigate", event => {
  event.intercept({ async handler(){
    await new Promise(r => setTimeout(r, 10_000));
    document.body.innerHTML = `Navigated to ${event.destination.url}`;
  } });
});
```

In this case:

- The user pressing the stop button will have no effect, and after ten seconds `document.body` will get updated anyway with the destination URL of the original navigation.
- Navigation to another URL will not prevent the fact that in ten seconds `document.body.innerHTML`  will be updated to show the original destination URL.

### Customizations and consequences of navigation interception

#### Accessibility technology announcements

With [cross-document](#appendix-types-of-navigations) navigations, accessibility technology will announce the start of the navigation, and its completion. But traditionally, same-document navigations (i.e. single-page app navigations) have not been communicated in the same way to accessibility technology. This is in part because it is not clear to the browser when a user interaction causes a single-page navigation, because of the app-specific JavaScript that intermediates between such interactions and the eventual call to `history.pushState()`/`history.replaceState()`. In particular, it's unclear exactly when the navigation begins and ends: trying to use the URL change as a signal doesn't work, since when applications call `history.pushState()` during the content loading process varies.

Any navigation that is intercepted and converted into a single-page navigation using `navigateEvent.intercept()` will be communicated to accessibility technology in the same way as a cross-document one. Using `intercept()` serves as a opt-in to this new behavior, and the provided promise allows the browser to know how long the navigation takes, and whether or not it succeeds.

#### Loading spinners and stop buttons

It is a long-requested feature (see [whatwg/fetch#19](https://github.com/whatwg/fetch/issues/19) and [whatwg/html#330](https://github.com/whatwg/html/issues/330)) to give pages control over the browser's loading indicator, i.e. the one they show while cross-document navigations are ongoing. This proposal gives the browsers the tools to do this: they can display the loading indicator while any promises returned by handlers passed to `navigateEvent.intercept()` are settling.

Additionally, in modern browsers, the reload button is replaced with a stop button while such loading is taking place. This can be done for navigation API-intercepted navigations as well, with the result communicated to the developer using `navigateEvent.signal`.

You can see a [demo](https://gigantic-honored-octagon.glitch.me/) and [screencast](https://twitter.com/i/status/1471604621470846979) of this behavior in Chromium.

_Note: specifications do not mandate browser UI, so this is not guaranteed behavior. But it's a nice feature that we hope browsers do end up implementing!_

#### Focus management

Like [accessibility technology announcements](#accessibility-technology-announcements), focus management currently behaves differently between same-document navigations and cross-document navigations. As [this post discusses](https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/):

> ... a user’s keyboard focus point may be kept in the same place as where they clicked, which isn’t intuitive. In layouts where the page changes partially to include a deep-linked modal dialog or other view layer, a user’s focus point could be left in an entirely wrong spot on the page.

The navigation API's navigation interception again gives us the tool to fix this.

By default, any navigation that is intercepted and converted into a single-page navigation using `navigateEvent.intercept()` will cause focus to reset to the `<body>` element, or to the first element with the `autofocus=""` attribute set (if there is one). This focus reset will happen after any promises returned by handlers passed to `intercept()` settle. However, this focus reset will not take place if the user or developer has manually changed focus while the promise was settling, and that element is still visible and focusable.

This behavior can be customized using `intercept()`'s `focusReset` option:

- `e.intercept({ handler, focusReset: "after-transition" })`: the default behavior, described above.
- `e.intercept({ handler, focusReset: "manual" })`: does not reset the focus, and leaves it where it is. (Although, it might get [reset anyway](https://html.spec.whatwg.org/#focus-fixup-rule) if the element is removed from the DOM or similar.) The application will manually manage focus changes.

In general, the default behavior is a best-effort attempt at cross-document navigation parity. But if developers invest some extra work, they can do even better:

- Per the above-linked [research by Fable Tech Labs](https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/), screen reader users generally prefer focus to be reset to a heading or wrapper element, instead of the `<body>` element. So to get the optimal experience with navigation interception, developers should use `autofocus=""` appropriately on such elements.

- For traversals (i.e. cases where `navigateEvent.navigationType === "traverse"`), getting parity with the [back/forward cache experience](https://web.dev/bfcache/) requires restoring focus to the same element that was previously focused when that history entry was active. Unfortunately, this isn't something the browser can do automatically for client-side rendered applications; the notion of "the same element" [is not generally stable](https://github.com/WICG/navigation-api/issues/190#:~:text=On%20the%20other%20hand%2C%20in%20the%20general%20case%20we%20won%27t%20be%20able%20to%20identify%20%22the%20same%20element%22!) in such cases. So for such cases, using `focusReset: "manual"`, storing some identifier for the currently-focused element in the navigation API state, and calling `element.focus()` appropriately upon transition could give a better experience, as in the following example:

```js
navigation.addEventListener("navigate", e => {
  const focusedIdentifier = computeIdentifierFor(document.activeElement);
  navigation.updateCurrentEntry({ ...navigation.currentEntry.getState(), focusedIdentifier });

  if (e.canIntercept) {
    const handler = figureOutHandler(e);
    const focusReset = e.navigationType === "traverse" ? "manual" : "after-transition";
    e.intercept({ handler, focusReset });
  }
});

navigation.addEventListener("navigatesuccess", () => {
  if (navigation.transition.navigationType === "traverse") {
    const { focusedIdentifier } = navigation.currentEntry.getState();
    const elementToFocus = findByIdentifier(focusedIdentifier);
    if (elementToFocus) {
      elementToFocus.focus();
    }
  }
});
```

An additional API that would be helpful, both for cases like these and more generally, would be one for [setting and getting the sequential focus navigation start point](https://github.com/whatwg/html/issues/5326). Especially for the custom traversals case, this would give even higher-fidelity focus restoration. (But that proposal is separate from the new navigation API.)

We can also extend the `focusReset` option with other behaviors in the future. Here are a couple which have been proposed, but we are not planning to include in the initial version unless we get strong developer feedback that they would be helpful:

- `focusReset: "immediate"`: immediately resets the focus to the `<body>` element, without waiting for the promise to settle.
- `focusReset: "two-stage"`: immediately resets the focus to the `<body>` element, and then has the same behavior as `"after-transition"`.

#### Scrolling to fragments and scroll resetting

_Note that the discussion in this section applies only to `"push"` and `"replace"` navigations. For the behavior for `"traverse"` and `"reload"` navigations, see the [next section](#scroll-position-restoration)._

When you change the URL with `history.pushState()`/`history.replaceState()`, the user's scroll position stays where it is. This is true even if you try to navigate to a fragment, e.g. by doing `history.pushState("/article#subheading")`. The latter has caused significant pain in client-side router libraries; see e.g. [remix-run/react-router#394](https://github.com/remix-run/react-router/issues/394), or the manual code that is needed to handle this case in [Vue](https://sourcegraph.com/github.com/vuejs/router/-/blob/src/scrollBehavior.ts?L81-140), [Angular](https://github.com/angular/angular/blob/main/packages/router/src/router_scroller.ts#L76-L77), [React Router Hash Link](https://github.com/rafgraph/react-router-hash-link/blob/main/src/HashLink.jsx), and others.

With the navigation API, there is a different default behavior, controllable via another option to `navigateEvent.intercept()`:

- `e.intercept({ handler, scroll: "after-transition" })`: the default behavior. After the promise returned by `handler` fulfills, the browser will attempt to scroll to the fragment given by `e.destination.url`, or if there is no fragment, it will reset the scroll position to the top of the page (like in a cross-document navigation).
- `e.intercept({ handler, scroll: "manual" })`: the browser will not change the user's scroll position, although you can later perform the same logic manually using `e.scroll()`.

The `navigateEvent.scroll()` method could be useful if you know you have loaded the element referenced by the hash, or if you know you want to reset the scroll position to the top of the document early, before the full transition has finished. For example:

```js
const freshEntry =
  navigateEvent.navigationType === "push" ||
  navigateEvent.navigationType === "replace";

navigateEvent.intercept({
  scroll: freshEntry ? "manual" : "after-transition",
  async handler() {
    await fetchDataAndSetUpDOM(navigateEvent.url);

    if (freshEntry) {
      navigateEvent.scroll();
    }

    // Note: navigateEvent.scroll() will update what :target points to.
    await fadeInTheScrolledToElement(document.querySelector(":target"));
  },
});
```

If you want to only perform the scroll-to-a-fragment behavior, and not reset the scroll position to the top if there is no matching fragment, then you can use `"manual"` combined with only calling `navigateEvent.scroll()` when `(new URL(navigateEvent.destination.url)).hash` points to an element that exists.

#### Scroll position restoration

A common pain point for web developers is scroll restoration during `"traverse"` and `"reload"` navigations. The essential problem is that scroll restoration happens unpredictably, and often at the wrong times. For example:

- The browser tries to restore the user's scroll position, but the application logic is still setting up the DOM and the relevant elements aren't ready yet.
- The browser tries to restore the user's scroll position, but the page's contents have changed and scroll restoration doesn't work that well. (For example, going back to a listing of files in a shared folder, after a different user deleted a bunch of the files.)
- The application needs to perform some measurements in order to do a proper transition, but the browser does scroll restoration during the transition, which messes up those measurements. ([Demo of this problem](https://nifty-blossom-meadow.glitch.me/legacy-history/transition.html): notice how when going back to the grid view, the transition sends the square to the wrong location.)

The same `scroll` option to `navigateEvent.intercept()` that we described above for `"push"` and `"replace"` navigations, similarly controls scroll restoration for `"traverse"` and `"reload"` navigations. And similarly to that case, using `intercept()` opts you into a more sensible default behavior:

- `e.intercept({ handler, scroll: "after-transition" })`: the default behavior. The browser delays its scroll restoration logic until `promise` fulfills; it will perform no scroll restoration if the promise rejects. If the user has scrolled during the transition then no scroll restoration will be performed ([like for multi-page navs](https://neat-equal-cent.glitch.me/)).
- `e.intercept({ handler, scroll: "manual" })`: The browser will perform no automatic scroll restoration. However, the developer can use the `e.scroll()` API to get semi-automatic scroll restoration, or can use [`window.scrollTo()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/scrollTo) or similar APIs to take full control.

For `"traverse"` and `"reload"`, the `navigateEvent.scroll()` API performs the browser's scroll restoration logic at the specified time. This allows cases that require precise control over scroll restoration timing, such as a non-broken version of the [demo referenced above](https://nifty-blossom-meadow.glitch.me/legacy-history/transition.html), to be written like so:

```js
if (navigateEvent.navigationType === "traverse" || navigateEvent.navigationType === "reload") {
  navigateEvent.intercept({
    scroll: "manual",
    async handler() {
      await fetchDataAndSetUpDOM();
      navigateEvent.scroll();
      await measureLayoutAndDoTransition();
    },
  });
}
```

Some more details on how the navigation API handles scrolling with `"traverse"` and `"reload"` navigations:

- `navigateEvent.scroll()` will silently do nothing if called after the user has started scrolling the document.

- `navigateEvent.scroll()` doesn't actually perform a single update of the scroll position. Rather, it puts the page in scroll-position-restoring mode. The scroll position could update several times as more elements load and [scroll anchoring](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor/Guide_to_scroll_anchoring) kicks in.

- By default, any navigations which are intercepted with `navigateEvent.intercept()` will _ignore_ the value of `history.scrollRestoration` from the classic history API. This allows developers to use `history.scrollRestoration` for controlling cross-document scroll restoration, while using the more-granular option to `intercept()` to control individual same-document navigations.

#### Deferred commit

The default behavior of immediately "committing" (i.e., updating `location.href` and `navigation.currentEntry`) works well for most situations, but some developers may find they do not want to immediately update the URL, and may want to retain the option of aborting the navigation without needing to rollback a URL update or cancel-and-restart. This behavior can be customized using `intercept()`'s `commit` option:

- `e.intercept({ handler, commit: "immediate" })`: the default behavior, immediately commit the navigation and update `location.href` and `navigation.currentEntry`.
- `e.intercept({ handler, commit: "after-transition" })`: start the navigation (e.g., show a loading spinner if the UI has one), but do not immediately commit.

When deferred commit is used, the navigation will commit (and a `committed` promise will resolve if present) when `e.commit()` is called. If any handler(s) passed to `intercept()` fulfill, and `e.commit()` has not yet been called, we will fallback to committing just before any `finish` promise resolves and `navigatesuccess` is fired.

If a handler passed to `intercept()` rejects before `e.commit()` is called, then the navigation will be treated as canceled (both `committed` and `finished` promises will reject, and no URL update will occur). If a handler passed to `intercept()` rejects after `e.commit()` is called, the behavior will match a rejected promise in immediate commit mode (i.e., the `committed` promise will fulfill, the `finished` promise will reject, and the URL will update).

Because deferred commit can be used to cancel the navigation before the URL updates, it is only available when `e.cancelable` is true. See [above](#restrictions-on-firing-canceling-and-responding) for details on when `e.cancelable` is set to false, and thus deferred commit is not available.

### Transitional time after navigation interception

Although calling `event.intercept()` to [intercept a navigation](#navigation-monitoring-and-interception) and convert it into a single-page navigation immediately and synchronously updates `location.href`, `navigation.currentEntry`, and the URL bar, the handlers passed to `intercept()` can return promises that might not settle for a while. During this transitional time, before the promise settles and the `navigatesuccess` or `navigateerror` events fire, an additional API is available, `navigation.transition`. It has the following properties:

- `navigationType`: either `"reload"`, `"push"`, `"replace"`, or `"traverse"` indicating what type of navigation this is
- `from`: the `NavigationHistoryEntry` that was the current one before the transition
- `finished`: a promise which fulfills with undefined when the `navigatesuccess` event fires on `navigation`, or rejects with the corresponding error when the `navigateerror` event fires on `navigation`

#### Example: handling failed navigations

To handle failed single-page navigations, i.e. navigations where a promise returned by a handler passed to `event.intercept()` eventually rejects, you can listen to the `navigateerror` event and perform application-specific interactions. This event will be an [`ErrorEvent`](https://developer.mozilla.org/en-US/docs/Web/API/ErrorEvent) so you can retrieve the promise's rejection reason. For example, to display an error, you could do something like:

```js
navigation.addEventListener("navigateerror", e => {
  document.body.textContent = `Could not load ${location.href}: ${e.message}`;
  analyticsPackage.send("navigateerror", { stack: e.error.stack });
});
```

This would give your users an experience most like a multi-page application, where server errors or broken links take them to a dedicated, server-generated error page.

### The `navigate()` and `reload()` methods

In a single-page app using `window.history`, the typical flow is:

1. Application code triggers a router's navigation infrastructure, giving it a destination URL and possibly additional state or info.
1. The router updates the URL displayed to the user and visible with `location.href`, by using `history.pushState()` or `history.replaceState()`.
1. The router or its surrounding framework loads the data necessary to render the new URL, and does so.

(Sometimes steps (2) and (3) are switched.) Note in particular the extra care an application needs to take to ensure that all navigations go through the router. This means that they can't easily use traditional APIs like `<a>` or `location.href`.

In a single-page app using the new navigation API, instead the router listens to the `navigate` event. This automatically takes care of step (2), and provides a centralized place for the router and framework to perform step (3). And now the application code can use traditional navigation mechanisms, like `<a>` or `location.href`, without any extra code; the browser takes care of sending all of those to the `navigate` event!

There's one gap remaining, which is the ability to send additional state or info along with a navigation. We solve this by introducing new APIs, `navigation.navigate()` and `navigation.reload()`, which can be thought of as an augmented and combined versions of `location.assign()`, `location.replace()`, and `location.reload()`. The non-replace usage of `navigation.navigate()` is as follows:

```js
// Navigate to a new URL, resetting the state to undefined:
// (equivalent to `location.assign(url)`)
navigation.navigate(url);

// Use a new URL and state.
navigation.navigate(url, { state });

// You can also pass info for the navigate event handler to receive:
navigation.navigate(url, { state, info });
```

Note how unlike `history.pushState()`, `navigation.navigate()` will by default perform a full navigation, e.g. scrolling to a fragment or navigating across documents. Single-page apps will usually intercept these using the `navigate` event, and convert them into same-document navigations by using `event.intercept()`.

Regardless of whether the navigation gets converted or not, calling `navigation.navigate()` in this form will clear any future entries in the joint session history. (This includes entries coming from frame navigations, or cross-origin entries: so, it can have an impact beyond just the `navigation.entries()` list.)

`navigation.navigate()` also takes a `history` option, which controls whether the navigation will replace the current history entry in a similar manner to `location.replace()`. It is used as follows:

```js
// Performs a navigation to the given URL, but replace the current history entry
// instead of pushing a new one.
// (equivalent to `location.replace(url)`)
navigation.navigate(url, { history: "replace" });

// Replace the URL and state at the same time.
navigation.navigate(url, { history: "replace", state });

// You can still pass along info:
navigation.navigate(url, { history: "replace", state, info });
```

Again, unlike `history.replaceState()`, `navigation.navigate(url, { history: "replace" })` will by default perform a full navigation. And again, single-page apps will usually intercept these using `navigate`.

There are two other values the `history` option can take: `"auto"`, which will usually perform a push navigation but will perform a replace navigation under special circumstances (such as when on the initial `about:blank` document or when navigating to the current URL); and `"push"`, which will always either perform a push navigation or fail if called under those special circumstances. Most developers will be fine either omitting the `history` option (which has `"auto"` behavior) or using `"replace"`.

Finally, we have `navigation.reload()`. This can be used as a replacement for `location.reload()`, but it also allows passing `info` and `state`, which are useful when a single-page app intercepts the reload using the `navigate` event:

```js
// Just like location.reload().
navigation.reload();

// Leave the state as-is, but pass some info.
navigation.reload({ info });

// Overwrite the state with a new value.
navigation.reload({ state, info });
```

Note that all of these methods return `{ committed, finished }` promise pairs, [as described above](#navigation-through-the-history-entry-list) for the traversal methods. That is, in the event that the navigations get converted into same-document navigations via `event.intercept()` in a `navigate` handler, `committed` will fulfill immediately, and `finished` will settle based on the promise returned by the handler (if there is one). This gives your navigation call site an indication of the navigation's success or failure. (If they are non-intercepted fragment navigations, or intercepted navigations with no handler, then `finished` will fulfill immediately. And if they are non-intercepted cross-document navigations, then the returned promises, along with the entire JavaScript global environment, will disappear as the current document gets unloaded.)

#### Example: using `info`

The `info` option to `navigation.navigate()` gets passed to the `navigate` event handler as the `event.info` property. The intended use of this value is to convey transient information about this particular navigation, such as how it happened. In this way, it's different from the persisted value retrievable using `event.destination.getState()`.

One example of how this might be used is to trigger different single-page navigation renderings depending on how a certain route was reached. For example, consider a photo gallery app, where you can reach the same photo URL and state via various routes:

- Clicking on it in a gallery view
- Clicking "next" or "previous" when viewing another photo in the album
- Etc.

Each of these wants a different animation at navigate time. This information doesn't make sense to store in the persistent URL or history entry state, but it's still important to communicate from the rest of the application, into the router (i.e. `navigate` event handler). This could be done using code such as

```js
document.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" && hasPreviousPhoto()) {
    navigation.navigate(getPreviousPhotoURL(), { info: { via: "go-left" } });
  }
  if (e.key === "ArrowRight" && hasNextPhoto()) {
    navigation.navigate(getNextPhotoURL(), { info: { via: "go-right" } });
  }
});

photoGallery.addEventListener("click", e => {
  if (e.target.closest(".photo-thumbnail")) {
    navigation.navigate(getPhotoURL(e.target), { info: { via: "gallery", thumbnail: e.target } });
  }
});

navigation.addEventListener("navigate", e => {
  if (isPhotoNavigation(e)) {
    e.intercept({ async handler() {
      switch (e.info.?via) {
        case "go-left": {
          await animateLeft();
          break;
        }
        case "go-right": {
          await animateRight();
          break;
        }
        case "gallery": {
          await animateZoomFromThumbnail(e.info.thumbnail);
          break;
        }
      }

      // TODO: actually load the photo.
    } });
  }
});
```

Note that in addition to `navigation.navigate()` and `navigation.reload()`, the previously-discussed `navigation.back()`, `navigation.forward()`, and `navigation.traverseTo()` methods can also take a `info` option.

#### Example: next/previous buttons

Consider trying to code next/previous buttons that perform single-page navigations, for example in a photo gallery application. This has some interesting properties:

- If the user presses next five times quickly, you want to be sure to skip them ahead five photos, and not to waste work on the intermediate four.
- If the user presses next five times and then previous twice, you want to load the third photo, not wasting work on any others.
- If the user presses previous/next and the previous/next item in their history list is the previous/next photo, then you want to just navigate them through the history list, like their browser back and forward buttons.
- You'll want to make sure any "permalink" or "share" UI is updated ASAP after such button presses, even if the photo is still loading.

All of this basically "just works" with the `navigate` event and other parts of the new navigation API. A large part of this is because `navigate`-event created single-page navigations [synchronously update the current URL](#navigation-monitoring-and-interception), and [abort any ongoing navigations](#aborted-navigations). The code to handle it would look like the following:

```js
const appState = {
  currentPhoto: 0,
  totalPhotos: 10
};
const next = document.querySelector("button#next");
const previous = document.querySelector("button#previous");
const permalink = document.querySelector("span#permalink");

next.onclick = () => {
  const nextPhotoInHistory = photoNumberFromURL(navigation.entries()[navigation.currentEntry.index + 1]?.url);
  if (nextPhotoInHistory === appState.currentPhoto + 1) {
    navigation.forward();
  } else {
    navigation.navigate(`/photos/${appState.currentPhoto + 1}`);
  }
};

previous.onclick = () => {
  const prevPhotoInHistory = photoNumberFromURL(navigation.entries()[navigation.currentEntry.index - 1]?.url);
  if (nextPhotoInHistory === appState.currentPhoto - 1) {
    navigation.back();
  } else {
    navigation.navigate(`/photos/${appState.currentPhoto - 1}`);
  }
};

navigation.addEventListener("navigate", e => {
  const photoNumber = photoNumberFromURL(e.destination.url);

  if (photoNumber && e.canIntercept) {
    e.intercept({ async handler() {
      // Synchronously update app state and next/previous/permalink UI:
      appState.currentPhoto = photoNumber;
      previous.disabled = appState.currentPhoto === 0;
      next.disabled = appState.currentPhoto === appState.totalPhotos - 1;
      permalink.textContent = e.destination.url;

      // Asynchronously update the photo, passing along the signal so that
      // it all gets aborted if another navigation interrupts us:
      const blob = await (await fetch(`/raw-photos/${photoNumber}.jpg`, { signal: e.signal })).blob();
      const url = URL.createObjectURL(blob);
      document.querySelector("#current-photo").src = url;
    } });
  }
});

function photoNumberFromURL(url) {
  if (!url) {
    return null;
  }

  const result = /\/photos/(\d+)/.exec((new URL(url)).pathname);
  if (result) {
    return Number(result[1]);
  }

  return null;
}
```

Let's look at our scenarios again:

- If the user presses next five times quickly, you want to be sure to skip them ahead five photos, and not to waste work on the intermediate four: this works as intended, as the first four fetches (for photos 1, 2, 3, 4) get aborted via their `e.signal`, while the last one (for photo 5) completes.
- If the user presses next five times and then previous twice, you want to load the third photo, not wasting work on any others: this works as intended, as the first six fetches (for photos 1, 2, 3, 4, 5, 4 again) get aborted via their `e.signal`, while the last one (for photo 3 again) completes.
- If the user presses previous/next and the previous/next item in their history is the previous/next photo, then you want to just navigate them through the history list, like their browser back and forward buttons: this works as intended, due to the if statements inside the `click` handlers for the next and previous buttons.
- You'll want to make sure any "permalink" or "share" UI is updated ASAP after such button presses, even if the photo is still loading: this works as intended, since we can do this work synchronously before loading the photo.

### Setting the current entry's state without navigating

We believe that in the majority of cases, single-page apps will be best served by updating their state via `navigation.navigate({ state: newState })`, which goes through the `navigate` event. That is, coupling state updates with navigations, which are handled by centralized router code. This is generally superior to the classic history API's model, where state (and URL) updates are done in a way disconnected from navigation, using `navigation.replaceState()`.

However, there is one type of case where the navigation-centric model doesn't work well. This is when you need to update the current entry's state in response to an external event, often caused by user interaction.

For example, consider a page with expandable/collapsable `<details>` elements. You want to store the expanded/collapsed state of these `<details>` elements in your navigation API state, so that when the user traverses back and forward through history, or restarts their browser, your app can read the restored navigation API state and expand the `<details>` elements appropriately, showing the user what they saw previously.

Creating this experience with `navigation.navigate()` and the `navigate` event is awkward. You would need to listen for the `<details>` element's `toggle` event, and then do `navigation.reload({ state: newState })`. And then you would need to have your `navigate` handler do `e.intercept()`, _and not actually do anything_, because the `<details>` element is already open. This can be made to work, but is not pretty.

For cases like this, where the current history entry's state needs to be updated to capture something that has already happened, we have `navigation.updateCurrentEntry({ state: newState })`. We would write our above example like so:

```js
detailsEl.addEventListener("toggle", () => {
  navigation.updateCurrentEntry({
    state: { ...navigation.currentEntry.getState(), detailsOpen: detailsEl.open }
  });
});
```

Another example of this sort of situation is shown in the following section.

### Notifications on entry disposal

Each `NavigationHistoryEntry` has a `dispose` event, which occurs when that history entry is permanently evicted and unreachable. The most common scenario where this occurs is when doing a push navigation that prunes the forward history, like so:

```js
const startingKey = navigation.currentEntry.key;

const entry1 = await navigation.navigate("/1").committed;
entry1.addEventListener("dispose", () => console.log(1));

const entry2 = await navigation.navigate("/2").committed;
entry2.addEventListener("dispose", () => console.log(2));

const entry3 = await navigation.navigate("/3").committed;
entry3.addEventListener("dispose", () => console.log(3));

await navigation.traverseTo(startingKey).finished;
await navigation.navigate("/1-b").finished;

// Logs 1, 2, 3 as that branch of the tree gets pruned.
```

This event can be useful for cleaning up any information in secondary stores, such as `sessionStorage` or caches, when we're guaranteed to never reach those particular history entries again.

### Current entry change monitoring

The `window.navigation` object has an event, `currententrychange`, which allows the application to react to any updates to the `navigation.currentEntry` property. This includes both navigations that change its value to a new `NavigationHistoryEntry`, and calls to APIs like `history.replaceState()`, `navigation.updateCurrentEntry()`, or intercepted `navigation.navigate(url, { history: "replace", state: newState })` calls that change its state or URL.

Unlike `navigate`, this event occurs *after* the navigation is committed. As such, it cannot be intercepted or canceled; it's just an after-the-fact notification.

This event is mainly used for code that want to watch for navigation commits, but are separated from the part of the codebase that actually perform the navigation (since the navigating code can just use `navigation.navigate().committed`). This is especially useful when migrating from `popstate` and `hashchange`, but it could also be used by e.g. analytics packages that don't care about the navigation finishing, just committing. It can also be used to set up relevant [per-entry events](#per-entry-events):

```js
navigation.addEventListener("currententrychange", () => {
  navigation.currentEntry.addEventListener("dispose", genericDisposeHandler);
});
```

It is best _not_ to use this event as part of the main routing flow of the application, which updates the main content area in response to URL changes. For that, use the `navigate` event, which provides [interception and cancelation support](#navigation-monitoring-and-interception).

The event comes with a property, `from`, which is the previous value of `navigation.currentEntry`. It also has a `navigationType` property, which is either `"reload"`, `"push"`, `"replace"`, `"traverse"`, or `null`. There are a few interesting cases to consider:

- The entry can be the same as before, i.e. `navigation.currentEntry === event.from`. This happens when `navigation.updateCurrentEntry()` is called, or when `navigation.reload()` is converted into a same-document reload. Note that in this case the old state cannot be retrieved, i.e. `event.from.getState()` will return the current navigation API state.

- `event.navigationType` will be `null` when `navigation.updateCurrentEntry()` is called, since that is not a navigation (despite updating `navigation.currentEntry`).

- During traversals, i.e. when `event.navigationType` is `"traverse"`, you can get the delta by using `navigation.currentEntry.index - event.from.index`. (Note that this can return `NaN` in `"replace"` cases where `event.from.index` is `null`.)

### Complete event sequence

Between the `dispose` events, the `window.navigation` events, and various promises, there's a lot of events floating around. Here's how they all come together:

1. `navigate` fires on `window.navigation`.
1. If the event is canceled using `event.preventDefault()`, then:
    1. If the process was initiated by a call to a `navigation` API that returns a promise, then that promise gets rejected with an `"AbortError"` `DOMException`.
1. Otherwise:
    1. `navigation.transition` is created.
    1. If `event.intercept()` was not called, or `event.intercept()` was called with no `commit` option, or `event.intercept()` was called with a `commit` option of `immediate`, run the commit steps (see below).
    1. Any loading spinner UI starts, if `event.intercept()` was called.
    1. When `event.commit()` is called, if `event.intercept()` was called with a `commit` option of `"after-transition"`, run the commit steps (see below).
    1. After all the promises returned by handlers passed to `event.intercept()` fulfill, or after one microtask if `event.intercept()` was not called:
        1. If the commit steps (see below) have not run yet, run them now.
        1. `navigatesuccess` is fired on `navigation`.
        1. Any loading spinner UI stops.
        1. If the process was initiated by a call to a `navigation` API that returns a promise, then that promise gets fulfilled.
        1. `navigation.transition.finished` fulfills with undefined.
        1. `navigation.transition` becomes null.
    1. Alternately, if any of these promises reject:
        1. `navigateerror` fires on `window.navigation` with the rejection reason as its `error` property.
        1. Any loading spinner UI stops.
        1. If the process was initiated by a call to a `navigation` API that returns a promise, then that promise gets rejected with the same rejection reason.
        1. `navigation.transition.finished` rejects with the same rejection reason.
        1. `navigation.transition` becomes null.
    1. Alternately, if the navigation gets [aborted](#aborted-navigations) before either of those two things occur:
        1. `navigateerror` fires on `window.navigation` with an `"AbortError"` `DOMException` as its `error` property.
        1. Any loading spinner UI stops. (But potentially restarts, or maybe doesn't stop at all, if the navigation was aborted due to a second navigation starting.)
        1. If the process was initiated by a call to a `navigation` API that returns a promise, then that promise gets rejected with the same `"AbortError"` `DOMException`.
        1. `navigation.transition.finished` rejects with the same `"AbortError"` `DOMException`.
        1. `navigation.transition` becomes null.
    1. One task after firing `currententrychange`, `hashchange` and/or `popstate` fire on `window`, if applicable. (Note: this can happen _before_ steps (ix)–(xi) if the promises take longer than a single task to settle.)

The commit steps are:

1. `location.href` updates.
1. `navigation.currentEntry` updates.
1. `currententrychange` is fired on `navigation`.
1. Any now-unreachable `NavigationHistoryEntry` instances fire `dispose`.
1. The URL bar updates.

## Guide for migrating from the existing history API

For web developers using the API, here's a guide to explain how you would replace usage of `window.history` with `window.navigation`.

### Performing navigations

Instead of using `history.pushState(state, "", url)`, use `navigation.navigate(url, { state })` and combine it with a `navigate` handler to convert the default cross-document navigation into a same-document navigation.

Instead of using `history.replaceState(state, "", url)`, use `navigation.navigate(url, { history: "replace", state })`, again combined with a `navigate` handler. Note that if you omit the state value, i.e. if you say `navigation.navigate(url, { history: "replace" })`, then this will overwrite the entry's state with `undefined`.

Instead of using `history.back()` and `history.forward()`, use `navigation.back()` and `navigation.forward()`. Note that unlike the `history` APIs, the `navigation` APIs will ignore other frames when determining where to navigate to. This means it might move through multiple entries in the joint session history, skipping over any entries that were generated purely by other-frame navigations.

Also note that if the navigation doesn't have an effect, the `navigation` traversal methods will return rejected promises, unlike the `history` traversal methods which silently do nothing. You can detect this as follows:

```js
try {
  await navigation.back().finished;
} catch (e) {
  if (e.name === "InvalidStateError") {
    console.log("We weren't able to go back, because there was nothing previous in the navigation API history entries list");
  }
}
```

or you can avoid it using the `canGoBack` property:

```js
if (navigation.canGoBack) {
  await navigation.back().finished;
}
```

Note that unlike the `history` APIs, these `navigation` APIs will not go to another origin. For example, trying to call `navigation.back()` when the previous document in the joint session history is cross-origin will return a rejected promise, and trigger the `console.log()` call above.

Instead of using `history.go(offset)`, use `navigation.traverseTo(key)` to navigate to a specific entry. As with `back()` and `forward()`, `navigation.traverseTo()` will ignore other frames, and will only control the navigation of your frame. If you specifically want to reproduce the pattern of navigating by an offset (not recommended), you can use code such as the following:

```js
const entry = navigation.entries()[navigation.currentEntry.index + offset];
if (entry) {
  await navigation.traverseTo(entry.key).finished;
}
```

### Warning: back/forward are not always opposites

As a consequence of how the new navigation API is focused on manipulating the current frame, `navigation.back()` followed by `navigation.forward()` will not always take you back to the original situation, when all the different frames on a page are considered. This sometimes is the case with `history.back()` and `history.forward()` today, due to browser bugs. But for the navigation API, it's actually intentional and expected.

This is because of the ambiguity where there can be multiple joint session history entries (representing the history state of the entire frame tree) for a given `NavigationHistoryEntry` (representing the history state of your particular frame). Consider the following example joint session history where an iframe is involved:

```
A. https://example.com/outer#1
   ┗ https://example.com/inner-1
B. https://example.com/outer#2
   ┗ https://example.com/inner-1
C. https://example.com/outer#2
   ┗ https://example.com/inner-2
D. https://example.com/outer#2
   ┗ https://example.com/inner-3
E. https://example.com/outer#2
   ┗ https://example.com/inner-4
```

Let's say the user is looking at joint session history entry C. If code in the outer frame calls `navigation.back()`, this is a request to navigate backward to the nearest joint session history entry where the outer frame differs, i.e. to navigate to A. Then, if the outer frame in state A calls `navigation.forward()`, this is a request to navigate forward to the nearest joint session history entry where the outer frame differs, i.e. to navigate to B. So starting at C, a back/forward sequence took us to B.

For similar reasons, if you started at state C, a forward/back sequence in the outer frame would fail (since there is no joint session history entry past C that differs for the outer frame). But a back/forward sequence would succeed, and take you to B per the above.

Although this behavior can be a bit counterintuitive, we think it's worth the tradeoff of having `navigation.back()` and `navigation.forward()` predictably navigate your own frame, instead of sometimes only navigating some subframe (like `history.back()` and `history.forward()` can do).

In the longer term, we think the best fix for this would be to introduce [a mode for iframes where they don't mess with the joint session history at all](https://github.com/whatwg/html/issues/6501). If a page used that on all its iframes, then it would never have to worry about such strange behavior.

### Using `navigate` handlers

Many cases which use `history.pushState()` today can just be deleted when using `navigation`. This is because if you have a listener for the `navigate` event on `navigation`, that listener can use `event.intercept()` to transform navigations that would normally be new-document navigations into same-document navigations. So for example, instead of

```html
<a href="/about">About us</a>
<button onclick="doStuff()">Do stuff</a>

<script>
window.doStuff = async () => {
  await doTheStuff();
  document.querySelector("main").innerHTML = await loadContentFor("/success-page");
  history.pushState(undefined, undefined, "/success-page");
};

document.addEventListener("click", async e => {
  if (e.target.localName === "a" && shouldBeSinglePageNav(e.target.href)) {
    e.preventDefault();
    document.querySelector("main").innerHTML = await loadContentFor(e.target.href);
    history.pushState(undefined, undefined, e.target.href);
  }
});
</script>
```

you could instead use a `navigate` handler like so:

```html
<a href="/about">About us</a>
<button onclick="doStuff()">Do stuff</a>

<script>
window.doStuff = async () => {
  await doTheStuff();
  location.href = "/success-page"; // or navigation.navigate("/success-page")
};

navigation.addEventListener("navigate", e => {
  if (shouldBeSinglePageNav(e.destination.url)) {
    e.intercept({ async handler() {
      document.querySelector("main").innerHTML = await loadContentFor(e.destination.url);
    } });
  }
});
</script>
```

Note how in this case we don't need to use `navigation.navigate()`, even though the original code used `history.pushState()`.

### Attaching and using history state

To update the current entry's state, instead of using `history.replaceState(newState)`, either:

- Use `navigation.reload({ state:  newState })`, combined with a `navigate` handler to convert the cross-document navigation into a same-document one and update the document appropriately, if your state update is meant to drive a page update.

- Use `navigation.updateCurrentEntry({ state: newState })`, if your state update is meant to capture something that's already happened to the page.

To create a new entry with the same URL but a new state value, instead of using `history.pushState(newState)`, use `navigation.navigate(navigation.currentEntry.url, { state: newState })`, again combined with a `navigate` handler.

To read the current entry's state, instead of using `history.state`, use `navigation.currentEntry.getState()`. Note that this will give a clone of the state, so you cannot set properties on it: to update state, see above.

In general, state in the `window.navigation` API is expected to be more useful than state in the `window.history` API, because:

- It can be introspected even for the non-current entry, e.g. using `navigation.entries()[i].getState()`.
- It is not erased by navigations that are not under the developer's control, such as fragment navigations (for which the state is copied over) and iframe navigations (which don't affect the navigation API history entry list).

This means that the patterns that are often necessary to reliably store application and UI state with `window.history`, such as maintaining a side-table or using `sessionStorage`, should not be necessary with `window.navigation`.

### Introspecting the history list

To see how many history entries are in the navigation API history entry list, use `navigation.entries().length`, instead of `history.length`. However, note that the semantics are different: navigation API history entries only include same-origin contiguous entries for the current frame, and so that this doesn't reflect the history before the user arrived at the current origin, or the history of iframes. We believe this will be more useful for the patterns that people want in practice.

The navigation API allows introspecting all entries in its history entry list, using `navigation.entries()`. This should replace some of the workarounds people use today with the `window.history` API for getting a sense of the history list, e.g. as described in [whatwg/html#2710](https://github.com/whatwg/html/issues/2710).

Finally, note that `history.length` is highly non-interoperable today, in part due to the complexity of the joint session history model, and in part due to historical baggage. `navigation`'s less complex model, and the fact that it will be developed in the modern era when there's a high focus on ensuring interoperability through web platform tests, means that using it should allow developers to avoid cross-browser issues with `history.length`.

### Watching for navigations

Today there are two events related to navigations, `hashchange` and `popstate`, both on `Window`. These events are quite problematic and hard to use; see, for example, [whatwg/html#5562](https://github.com/whatwg/html/issues/5562) or other [open issues](https://github.com/whatwg/html/issues?q=is%3Aissue+is%3Aopen+popstate) for some discussion. MDN's fourteen-step guide to ["When popstate is sent"](https://developer.mozilla.org/en-us/docs/Web/API/Window/popstate_event#when_popstate_is_sent), which [doesn't even match any browsers](https://docs.google.com/document/d/1Pdve-DJ1JCGilj9Yqf5HxRJyBKSel5owgOvUJqTauwU/edit#), is also indicative of the problem.

The new navigation API provides several replacements that subsume these events:

- To react to and potentially intercept navigations before they complete, use the `navigate` event on `navigation`. See the [Navigation monitoring and interception](#navigation-monitoring-and-interception) section for more details, including how the event object provides useful information that can be used to distinguish different types of navigations.

- To react to navigations that have finished, including any asynchronous work, use the `navigatesuccess` or `navigateerror` events on `navigation`. Note that these will only be fired after any promises returned by handlers passed to the `navigate` event's `event.intercept()` method have settled.

- To react to navigations that have committed (but not necessarily yet finished), use the [`currententrychange` event](#current-entry-change-monitoring) on `navigation`. This is the most direct counterpart to `popstate` and `hashchange`, so might be easiest to use as part of an initial migration while your app is adapting to a `navigate` event-centric paradigm.

- To watch a particular entry to see when it becomes unreachable, use that `NavigationHistoryEntry`'s [`dispose` event](#notifications-on-entry-disposal).

## Integration with the existing history API and spec

At a high level, the new navigation API is meant to be a layer on top of the HTML Standard's existing concepts. It does not require a novel model for session history, either in implementations or specifications. (Although, it will only be possible to specify it rigorously once the existing specification gets cleaned up, per the work we're doing in [whatwg/html#5767](https://github.com/whatwg/html/issues/5767).)

This is done through:

- Ensuring that navigation API `NavigationHistoryEntry`s map directly to the specification's existing history entries. (See the next section.)

- Ensuring that traversal through the history via the new navigation API always maps to a traversal through the joint session history, i.e. a traversal which is already possible today.

### Correspondence with session history entries

A `NavigationHistoryEntry` corresponds directly to a [session history entry](https://html.spec.whatwg.org/#session-history-entry) from the existing HTML specification. However, not every session history entry would have a corresponding `NavigationHistoryEntry` in a given `Window`: `NavigationHistoryEntry` objects only exist for session history entries which are same-origin to the current one, and contiguous within that frame.

Example: if a browsing session contains session history entries with the URLs

```
1. https://example.com/foo
2. https://example.com/bar
3. https://other.example.com/whatever
4. https://example.com/baz
```

then, if the current entry is 4, there would only be one `NavigationHistoryEntry` in `navigation.entries()`, corresponding to 4 itself. If the current entry is 2, then there would be two `NavigationHistoryEntry`s in `navigation.entries()`, corresponding to 1 and 2.

To make this correspondence work, every spec-level session history entry would gain three new fields:

- key, containing a browser-generated UUID. This is what backs `historyEntry.key`.
- id, containing a browser-generated UUID. This is what backs `historyEntry.id`.
- navigation API state, containing a JavaScript value. This is what backs `historyEntry.getState()`.

Note that the "navigation API state" field has no interaction with the existing "serialized state" field, which is what backs `history.state`. This route was chosen for a few reasons:

- The desired semantics of navigation API state is that it be carried over on fragment navigations, whereas `history.state` is not carried over. (This is a hard blocker.)
- A clean separation can help when a page contains code that uses both `window.history` and `window.navigation`. That is, it's convenient that existing code using `window.history` does not inadvertently mess with new code that does state management using `window.navigation`.
- Today, the serialized state of a session history entry is only exposed when that entry is the current one. The navigation API exposes `historyEntry.getState()` for all entries in `navigation.entries()`. This is not a security issue since all navigation API history entries are same-origin contiguous, but if we exposed the serialized state value even for non-current entries, it might break some assumptions of existing code.
- Switching to a separate field, accessible only via the `getState()` method, avoids the mutability problems discussed in [#36](https://github.com/WICG/navigation-api/issues/36). If the object was shared with `history.state`, those problems would be carried over.

Apart from these new fields, the session history entries which correspond to `NavigationHistoryEntry` objects will continue to manage other fields like document, scroll restoration mode, scroll position data, and persisted user state behind the scenes, in the usual way. The serialized state and browsing context name fields would continue to work if they were set or accessed via the usual APIs, but they don't have any manifestation inside the navigation APIs, and will be left as null by applications that avoid `window.history` and `window.name`.

_TODO: should we allow global control over the default scroll restoration mode, like `history.scrollRestoration` gives? That API has legitimate use cases, and we'd like to allow people to never touch `window.history`... Discuss in [#67](https://github.com/WICG/navigation-api/issues/67)._

### Correspondence with the joint session history

The view of history which the user sees, and which is traversable with existing APIs like `history.go()`, is the joint session history.

Unlike the view of history presented by `window.history`, `window.navigation` only gives a view onto session history entries for the current browsing session. This view does not present the joint session history, i.e. it is not impacted by frames. Notably, this means `navigation.entries().length` is likely to be quite different from `history.length`.

Example: consider the following setup.

1. `https://example.com/start` loads.
1. The user navigates to `https://example.com/outer` by clicking a link. This page contains an iframe with `https://example.com/inner-start`.
1. Code on `https://example.com/outer` calls `history.pushState(null, "", "/outer-pushed")`.
1. The iframe navigates to `https://example.com/inner-end`.

The joint session session history contains four entries:

```
A. https://example.com/start
B. https://example.com/outer
   ┗ https://example.com/inner-start
C. https://example.com/outer-pushed
   ┗ https://example.com/inner-start
D. https://example.com/outer-pushed
   ┗ https://example.com/inner-end
```

The navigation API history entry list (which also matches the existing spec's frame-specific "session history") for the outer frame looks like:

```
O1. https://example.com/start        (associated to A)
O2. https://example.com/outer        (associated to B)
O3. https://example.com/outer-pushed (associated to C and D)
```

The navigation API history entry list for the inner frame looks like:

```
I1. https://example.com/inner-start  (associated to B and C)
I2. https://example.com/inner-end    (associated to D)
```

Traversal operates on the joint session history, which means that it's possible to impact other frames. Continuing with our previous setup, and assuming the current entry in the joint session history is D, then:

- If code in the outer frame calls `navigation.back()`, this will take us back to O2, and thus take the joint session history back to B. This means the inner frame will be navigated from `/inner-end` to `/inner-start`, changing its current navigation API `NavigationHistoryEntry` from I2 to I1.

- If code in the inner frame calls `navigation.back()`, this will take us back to I1, and take the joint session history back to C. (This does not impact the outer frame.) The rule here for choosing C, instead of B, is that it moves the joint session history the fewest number of steps necessary to make I1 active.

- If code in either the inner frame or the outer frame calls `history.back()`, this will take the joint session history back to C, and thus update the inner frame's current navigation API `NavigationHistoryEntry` from I2 to I1. (There is no impact on the outer frame.)

### Integration with navigation

To understand when navigation interception interacts with the existing navigation spec, see [the navigation types appendix](#appendix-types-of-navigations). In cases where interception is allowed and takes place, it is essentially equivalent to preventing the normal navigation and instead synchronously performing the [URL and history update steps](https://html.spec.whatwg.org/#url-and-history-update-steps).

The way in which navigation interacts with session history entries generally is not meant to change; the correspondence of a session history entry to a `NavigationHistoryEntry` does not introduce anything novel there.

## Impact on the back button and user agent UI

The navigation API doesn't change anything about how user agents implement their UI: it's really about developer-facing affordances. Users still care about the joint session history, and so that will continue to be presented in UI surfaces like holding down the back button. Similarly, pressing the back button will continue to navigate through the joint session history, potentially across origins and out of the current navigation API history list (into a new navigation API history list, on the new origin). The design discussed in [the previous section](#correspondence-with-the-joint-session-history) ensures that the navigation API cannot get the browser into a strange novel state that has not previously been seen in the joint session history.

One consequence of this is that when iframes are involved, the back button may navigate through the joint session history, without changing the current navigation API `NavigationHistoryEntry`. This is because, for the most part, the behavior of the back button is the same as that of `history.back()`, which as the previous section showed, only impacts one frame (and thus one navigation API history entry list) at a time.

Finally, note that user agents can continue to refine their mapping of UI to joint session history to give a better experience. For example, in some cases user agents today have the back button skip joint session history entries which were created without user interaction. We expect this heuristic would continue to be applied for same-document entries generated by intercepting the `navigate` event, just like it is for today's `history.pushState()`.

## Security and privacy considerations

Privacy-wise, this feature is neutral, due to its strict same-origin contiguous entry scoping. That is, it only exposes information which the application already has access to, just in a more convenient form. The storage of navigation API state in the `NavigationHistoryEntry`s is a convenience with no new privacy concerns, since that state is only accessible same-origin; that is, it provides the same power as something like `sessionStorage` or `history.state`.

One particular point of interest is the user-agent generated `historyEntry.key` and `historyEntry.id` fields, which are a user-agent-generated random UUIDs. Here again the strict same-origin contiguous entry scoping prevents them from being used for cross-site tracking or similar. Specifically:

- These UUIDs lives only for the duration of that navigation API history entry, which is at most for the lifetime of the browsing session. For example, opening a new tab (or iframe) to the same URL will generate different `key` and `id` values. So it is not a stable user-specific identifier.

- This information is not accessible across sites, as a given navigation API history entry is specific to a frame and origin. That is, cross-site pages will always have different `key` and `id` values for all `NavigationHistoryEntry`s they can examine; there is no way to use history entry keys and IDs to correlate users.

(Collaborating cross-origin same-site pages can inspect each other's `NavigationHistoryEntry`s using `document.domain`, but they can also inspect every other aspect of each others' global objects.)

Security-wise, this feature has been carefully designed to give no new abilities that might be disruptive to the user or to delicate parts of browser code. See, for example, the restrictions on [navigation monitoring and interception](#navigation-monitoring-and-interception) to ensure that it does not allow trapping the user, or the discussion of how this proposal [does not impact how browser UI presents session history](#impact-on-the-back-button-and-user-agent-ui).

In particular, note that navigation interception can only update the URL bar to perform single-page app navigations to the same extent as `history.pushState()` does: the destination URL must only differ from the page's current URL in path, query, or fragment components. Thus, the `navigate` event does not allow URL spoofing by updating the URL bar to a cross-origin destination while providing your own origin's content.

See also the [W3C TAG security and privacy questionnaire answers](./security-privacy-questionnaire.md). We also have a [corresponding specification section](https://wicg.github.io/navigation-api/#security-privacy), which largely restates the points here but with links to specification concepts instead of explainer sections.

## Future extensions

### More per-entry events

We've heard some use cases for additional events on `NavigationHistoryEntry` objects, in addition to the [`dispose` event](#notifications-on-entry-disposal). Currently we're thinking of adding `navigateto` and `navigatefrom` events.

We expect these would mostly be used by decentralized parts of the application's codebase, such as components, to synchronize their state with the history list. Unlike the `navigate` event, these events are not cancelable. They are used only for reacting to changes, not intercepting or preventing navigations.

For example, consider a photo gallery application. One way of implementing this would be to store metadata about the photo in the corresponding `NavigationHistoryEntry`'s state. This might look something like this:

```js
async function showPhoto(photoId) {
  // In our app, the `navigate` handler will take care of actually showing the photo and updating the content area.
  const entry = await navigation.navigate(`/photos/${photoId}`, { state: {
    dateTaken: null,
    caption: null
  } }).committed;

  // When we navigate away from this photo, save any changes the user made.
  entry.addEventListener("navigatefrom", e => {
    navigation.updateCurrentEntry({
      state: {
        dateTaken: document.querySelector("#photo-container > .date-taken").value,
        caption: document.querySelector("#photo-container > .caption").value
      }
    });
  });

  // If we ever navigate back to this photo, e.g. using the browser back button or
  // navigation.traverseTo(), restore the input values.
  entry.addEventListener("navigateto", e => {
    const { dateTaken, caption } = entry.getState();
    document.querySelector("#photo-container > .date-taken").value = dateTaken;
    document.querySelector("#photo-container > .caption").value = caption;
  });
}
```

Note how we use the fulfillment value of the `committed` promise to get a handle to the entry. This is more robust than assuming `navigation.currentEntry` is correct, in edge cases where one navigation can interrupt another.

### Performance timeline API integration

The [performance timeline API](https://w3c.github.io/performance-timeline/) provides a generic framework for the browser to signal about interesting events, their durations, and their associated data via `PerformanceEntry` objects. For example, cross-document navigations are done with the [navigation timing API](https://w3c.github.io/navigation-timing/), which uses a subclass of `PerformanceEntry` called `PerformanceNavigationTiming`.

It is not currently possible to measure such data for same-document navigations. This is somewhat understandable, as such navigations have always been "zero duration": they occur instantaneously when the application calls `history.pushState()` or `history.replaceState()`. So measuring them isn't that interesting. But with the new navigation API, [browsers know about the start time, end time, and duration of the navigation](#measuring-standardized-single-page-navigations), so we can give useful performance entries.

We propose adding new `PerformanceEntry` instances for such same-document navigations. They would be instances of a new subclass, `SameDocumentNavigationEntry`, with the following properties:

- `name`: the URL being navigated to. (The use of `name` instead of `url` is strange, but matches all the other `PerformanceEntry`s on the platform.)

- `entryType`: always `"same-document-navigation"`.

- `startTime`: the time at which the navigation was initiated, i.e. when the corresponding API was called (like `location.href` or `navigation.navigate()`), or when the user activated the corresponding `<a>` element, or submitted the corresponding `<form>`.

- `duration`: the duration of the navigation, which is either `0` for `history.pushState()`/`history.replaceState()`, or is the duration it takes the promises returned by handlers passed to `event.intercept()` to settle, for navigations intercepted by a `navigate` event handler.

- `success`: `false` if any of those promises rejected; `true` otherwise (including for `history.pushState()`/`history.replaceState()`).

To record single-page navigations using [`PerformanceObserver`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceObserver), web developers could then use code such as the following:

```js
const observer = new PerformanceObserver(list => {
  for (const entry of list.getEntries()) {
    analyticsPackage.send("same-document-navigation", entry.toJSON());
  }
});
observer.observe({ type: "same-document-navigation" });
```

### Navigation transition rollbacks and redirects

During the [transitional time after navigation interception](#transitional-time-after-navigation-interception), there are several higher-level operations that we believe would be useful for developers:

- `navigation.transition.rollback()`: a method which allows easy rollback to the `navigation.transition.from` entry.
- `navigation.transition.redirect()`: a method which allows changing the destination of the current transition to a new URL.

Note that `navigation.transition.rollback()` is not the same as `navigation.back()`: for example, if the user navigates two steps back, then `navigation.rollback()` will actually go forward two steps. Similarly, it handles rolling back replace navigations by reverting back to the previous URL and navigation API state. And it rolls back push navigations by actually removing the entry that was previously pushed, instead of leaving it there for the user to reach by pressing their forward button.

Here is an example of how you could use `navigation.transition.rollback()` to give a different sort of experience for [handling failed navigations](#example-handling-failed-navigations):

```js
navigation.addEventListener("navigateerror", async e => {
  const attemptedURL = location.href;

  await navigation.transition.rollback().committed;
  showErrorToast(`Could not load ${attemptedURL}: ${e.message}`);
});
```

And here is an example of how you could use `navigation.transition.redirect()` to implement a "redirect" to a login page:

```js
navigation.addEventListener("navigate", e => {
  e.intercept({ async handler() {
    if (await isLoginGuarded(e.destination)) {
      await navigation.transition.redirect("/login").finished;
      return;
    }

    // Render e.destination as normal
  } });
});
```

In more detail, such a "redirect" would consist of either doing a replacement navigation (if we're past navigation commit time), or canceling the current not-yet-committed navigation and starting a new one. In both cases, the main value add is to avoid extra intermediate events such as `navigateerror` or `navigatesuccess`; it would seem to the rest of the code as if the navigation just took longer to finish.

### More

Check out the [addition](https://github.com/WICG/navigation-api/issues?q=is%3Aissue+is%3Aopen+label%3Aaddition) label on our issue tracker to see more proposals we've thought about!

## Stakeholder feedback

- W3C TAG: [w3ctag/design-reviews#605](https://github.com/w3ctag/design-reviews/issues/605)
- Browser engines:
  - Chromium: Prototyping behind a flag
  - Gecko: Some [non-official positive feedback](https://github.com/mozilla/standards-positions/issues/543) and continued collaboration
  - WebKit: [No feedback so far](https://www.mail-archive.com/webkit-dev@lists.webkit.org/msg30257.html)
- Web developers: Generally positive; see e.g. reactions and replies to [WICG/proposals#20](https://github.com/WICG/proposals/issues/20), or the participation on this repository's issue tracker.

## Acknowledgments

This proposal is based on [an earlier revision](https://github.com/slightlyoff/history_api/blob/55b1d7a933cfd2dccddb16668b13dbc9ff06a3f2/navigator.md) by [@tbondwilkinson](https://github.com/tbondwilkinson), which outlined all the same capabilities in a different form. It also incorporates the ideas from [philipwalton@](https://github.com/philipwalton)'s [navigation event proposal](https://github.com/philipwalton/navigation-event-proposal/tree/aa0b688eab37f906660e60af8dc49df04d33c17f).

Thanks also to
[@annevk](https://github.com/annevk),
[@atscott](https://github.com/atscott),
[@chrishtr](https://github.com/chrishtr),
[@csreis](https://github.com/csreis),
[@dvoytenko](https://github.com/dvoytenko),
[@esprehn](https://github.com/esprehn),
[@fabiancook](https://github.com/fabiancook),
[@frehner](https://github.com/frehner),
[@housseindjirdeh](https://github.com/housseindjirdeh),
[@jakearchibald](https://github.com/jakearchibald),
[@matt-buland-sfdc](https://github.com/matt-buland-sfdc),
[@MelSumner](https://github.com/MelSumner),
[@mmocny](https://github.com/mmocny),
[@natechapin](https://github.com/natechapin),
[@posva](https://github.com/posva),
[@pshrmn](https://github.com/pshrmn),
[@SetTrend](https://github.com/SetTrend),
[@slightlyoff](https://github.com/slightlyoff),
[@smaug----](https://github.com/smaug----),
[@torgo](https://github.com/torgo), and
[@Yay295](https://github.com/Yay295)
for their help in exploring this space and providing feedback.

## Appendix: types of navigations

The web platform has many ways of initiating a navigation. For the purposes of the new navigation API, the following is intended to be a comprehensive list:

- Users can trigger navigations via browser UI, including (but not necessarily limited to):
  - The URL bar
  - The back and forward buttons
  - The reload button
  - Bookmarks
- `<a>` and `<area>` elements (both directly by users, and programmatically via `element.click()` etc.)
- `<form>` elements (both directly by users, and programmatically via `element.submit()` etc.)
- As a special case of the above, the `target="nameOfSomeWindow"` attribute on `<a>`, `<area>`, and `<form>` will navigate a window whose `window.name` is `nameOfSomeWindow`
- `<meta http-equiv="refresh">`
- The `Refresh` HTTP response header
- The `window.location` setter, the various `location.*` setters, and the `location.replace()`, `location.assign()`, and `location.reload()` methods. Note that these can be called from other frames, including cross-origin ones.
- Calling `window.open(url, nameOfSomeWindow)` will navigate a window whose `window.name` is `nameOfSomeWindow`
- `history.back()`, `history.forward()`, and `history.go()`
- `history.pushState()` and `history.replaceState()`
- `navigation.back()`, `navigation.forward()`, `navigation.traverseTo()`
- `navigation.navigate()`, `navigation.reload()`
- [`document.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/open)

**Cross-document navigations** are navigations where, after the navigation completes, you end up in a different `Document` object than the one you are curently on. Notably, these unload the old document, and stop running any JavaScript code from there.

**Same-document** navigations are ones where, after the navigation completes, you stay on the same `Document`, with the same JavaScript environment.

Most navigations are cross-document navigations. Same-document navigations can happen due to:

- Any of the above navigation mechanisms only updating the URL's fragment, e.g. `location.hash = "foo"` or clicking on `<a href="#bar">` or calling `history.back()` after either of those two actions
- `history.pushState()` and `history.replaceState()`
- `document.open()`
- [Intercepting a cross-document navigation](#navigation-monitoring-and-interception) using the `navigation` object's `navigate` event, and calling `event.intercept()`

Here's a summary table:

|Trigger|Cross- vs. same-document|Fires `navigate`?|`e.userInitiated`|`e.cancelable`|`e.canIntercept`|
|-------|------------------------|-----------------|-----------------|--------------|--------------|
|Browser UI (back/forward)|Either|Yes|Yes|Yes ❖|Yes †*|
|Browser UI (non-back/forward<br>fragment change only)|Same|Yes|Yes|Yes|Yes|
|Browser UI (non-back/forward<br>other)|Cross|No|—|—|—|
|`<a>`/`<area>`/`<form>` (`target="_self"` or no `target=""`)|Either|Yes|Yes ‡|Yes|Yes *|
|`<a>`/`<area>`/`<form>`<br>(non-`_self` `target=""`)|Either|Yes Δ|Yes ‡|Yes|Yes *|
|`<meta http-equiv="refresh">`|Either ◊|Yes|No|Yes|Yes *|
|`Refresh` header|Either ◊|Yes|No|Yes|Yes *|
|`window.location`|Either|Yes Δ|No|Yes|Yes *|
|`history.{back,forward,go}()`|Either|Yes|No|Yes ❖|Yes †*|
|`history.{pushState,replaceState}()`|Same|Yes|No|Yes|Yes|
|`navigation.{back,forward,traverseTo}()`|Either|Yes|No|Yes ❖|Yes †*|
|`navigation.navigate()`|Either|Yes|No|Yes|Yes *|
|`navigation.reload()`|Cross|Yes|No|Yes|Yes|
|`window.open(url, "_self")`|Either|Yes|No|Yes|Yes *|
|`window.open(url, name)`|Either|Yes Δ|No|Yes|Yes *|
|`document.open()`|Same|No|—|—|—|

- † = No if cross-document
- ‡ = No if triggered via, e.g., `element.click()`
- \* = No if the URL differs from the page's current one in components besides path/query/fragment, or is cross-origin from the current page and differs in any component besides fragment.
- Δ = No if cross-document and initiated from a [cross origin-domain](https://html.spec.whatwg.org/multipage/origin.html#same-origin-domain) window, e.g. `frames['cross-origin-frame'].location.href = ...` or `<a target="cross-origin-frame">`
- ◊ = fragment navigations initiated by `<meta http-equiv="refresh">` or the `Refresh` header are only same-document in some browsers: [whatwg/html#6451](https://github.com/whatwg/html/issues/6451)
- ❖ = Only in the top window, if the traversal is same-origin, and either the traversal is not user-initiated, or there is a consumable user activation in the current window.

See the discussion on [restrictions](#restrictions-on-firing-canceling-and-responding) to understand the reasons why the last few columns are filled out in the way they are.

As a final note, we only fire the `navigate` event when navigating to URLs that have a [fetch scheme](https://fetch.spec.whatwg.org/#fetch-scheme). Notably, this excludes navigations to `javascript:` URLs.

_Spec details: the above comprehensive list does not fully match when the HTML Standard's [navigate](https://html.spec.whatwg.org/#navigate) algorithm is called. In particular, HTML does not handle non-fragment-related same-document navigations through the navigate algorithm; instead it uses the [URL and history update steps](https://html.spec.whatwg.org/#url-and-history-update-steps) for those. Also, HTML calls the navigate algorithm for the initial loads of new browsing contexts as they transition from the initial `about:blank`; we avoid firing `navigate` for those since the initial `about:blank` is such a weird case in general._
