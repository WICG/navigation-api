# App History API

The web's existing [history API](https://developer.mozilla.org/en-US/docs/Web/API/History) is problematic for a number of reasons, which makes it hard to use for web applications. This proposal introduces a new one, which is more directly usable by web application developers to address the use cases they have for history introspection, mutation, and observation/interception.

This new `window.appHistory` API [layers](#integration-with-the-existing-history-api-and-spec) on top of the existing API and specification infrastructure, with well-defined interaction points. The main differences are that it is scoped to the current origin and frame, and it is designed to be pleasant to use instead of being a historical accident with many sharp edges.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->
## Table of contents

- [Problem statement](#problem-statement)
- [Goals](#goals)
- [Proposal](#proposal)
  - [The current entry, and single-page navigations](#the-current-entry-and-single-page-navigations)
  - [Inspection of the app history list](#inspection-of-the-app-history-list)
  - [Navigation through the app history list](#navigation-through-the-app-history-list)
  - [Navigation monitoring and interception](#navigation-monitoring-and-interception)
    - [Accessibility benefits of standardized single-page navigations](#accessibility-benefits-of-standardized-single-page-navigations)
    - [Measuring standardized single-page navigations](#measuring-standardized-single-page-navigations)
    - [Example: replacing navigations with single-page app navigations](#example-replacing-navigations-with-single-page-app-navigations)
    - [Example: single-page app "redirects"](#example-single-page-app-redirects)
    - [Example: cross-origin affiliate links](#example-cross-origin-affiliate-links)
    - [Example: using `navigateInfo`](#example-using-navigateinfo)
  - [Navigations while a navigation is ongoing](#navigations-while-a-navigation-is-ongoing)
  - [Queued up single-page navigations](#queued-up-single-page-navigations)
  - [Per-entry events](#per-entry-events)
  - [Current entry change monitoring](#current-entry-change-monitoring)
  - [Complete event sequence](#complete-event-sequence)
- [Guide for migrating from the existing history API](#guide-for-migrating-from-the-existing-history-api)
  - [Performing navigations](#performing-navigations)
  - [Using `navigate` handlers plus non-history APIs](#using-navigate-handlers-plus-non-history-apis)
  - [Attaching and using history state](#attaching-and-using-history-state)
  - [Introspecting the history list](#introspecting-the-history-list)
  - [Watching for navigations](#watching-for-navigations)
- [Integration with the existing history API and spec](#integration-with-the-existing-history-api-and-spec)
  - [Correspondence with session history entries](#correspondence-with-session-history-entries)
  - [Correspondence with the joint session history](#correspondence-with-the-joint-session-history)
  - [Integration with navigation](#integration-with-navigation)
- [Impact on the back button and user agent UI](#impact-on-the-back-button-and-user-agent-ui)
- [Security and privacy considerations](#security-and-privacy-considerations)
- [Stakeholder feedback](#stakeholder-feedback)
- [Acknowledgments](#acknowledgments)
- [Appendix: types of navigations](#appendix-types-of-navigations)
- [Appendix: full API surface, in Web IDL format](#appendix-full-api-surface-in-web-idl-format)

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

- Improve the accessibility of single-page app navigations([1](https://github.com/w3c/aria/issues/1353), [2](https://docs.google.com/document/d/1MYClmO3FkjhSuSYKlVPVDnXvtOm-yzG15SY9jopJIxQ/edit#), [3](https://www.gatsbyjs.com/blog/2019-07-11-user-testing-accessible-client-routing/)), ideally to be on par with cross-document navigations, when they are implemented using this API.

- Provide a uniform way to signal single-page app navigations, including their duration.

- Provide a reliable system to tie application and UI state to history entries.

- Continue to support the pattern of allowing the history list to contain state that is not serialized to the URL. (This is possible with `history.pushState()` today.)

- Provide events for notifying the application about navigations through the list of history entries, which they can use to synchronize application or UI state.

- Allow analytics (first- or third-party) to watch for navigations, including gathering timing information about how long they took, without interfering with the rest of the application.

- Provide a way for an application to reliably navigate through its own history list.

- Provide a reasonable layering onto and integration with the existing `window.history` API, in terms of spec primitives and ensuring non-terrible behavior when both are used.

Non-goals:

- Allow web applications to intercept user-initiated navigations in a way that would trap the user (e.g., disabling the URL bar or back button).

- Provide applications knowledge of cross-origin history entries or state.

- Provide applications knowledge of other frames' entries or state.

- Provide platform support for the coordination problem of multiple routers (e.g., per-UI-component routers) on a single page. We plan to leave this coordination to frameworks for now (with the frameworks using the new API).

- Handle the case where the Android back button is being used as a "modal close signal"; instead, we believe that's best handled by [a separate API](https://github.com/slightlyoff/history_api/blob/master/history_and_modals.md).

- Provide any handling for preventing navigations that might lose data: this is already handled orthogonally by the platform's `beforeunload` event.

- Provide an elegant layering onto or integration with the existing `window.history` API. That API is quite problematic, and we can't be tied down by a need to make every operation in the new API isomorphic to one in the old API.

A goal that might not be possible, but we'd like to try:

- It would be ideal if this API were polyfillable, especially in its mainline usage scenarios.

Finally, although it's really a goal for all web APIs, we want to call out a strong focus on interoperability, backstopped by [web platform tests](http://web-platform-tests.org/). The existing history API and its interactions with navigation have terrible interoperability (see [this vivid example](https://docs.google.com/document/d/1Pdve-DJ1JCGilj9Yqf5HxRJyBKSel5owgOvUJqTauwU/edit#)). We hope to have solid and well-tested specifications for:

- Every aspect and self-interaction of the new API

- Every aspect of how the new API integrates and interacts with the `window.history` API (including things like relative timing of events)

Additionally, we hope to drive interoperability through tests, spec updates, and browser bugfixes for the existing `window.history` API while we're in the area, to the extent that is possible; some of this work is being done in [whatwg/html#5767](https://github.com/whatwg/html/issues/5767).

## Proposal

### The current entry, and single-page navigations

The entry point for the app history API is `window.appHistory`. Let's start with `appHistory.current`, which is an instance of the new `AppHistoryEntry` class. This class has the following readonly properties:

- `key`: a user-agent-generated UUID identifying this history entry. In the past, applications have used the URL as such a key, but the URL is not guaranteed to be unique.

- `url`: the URL of this history entry (as a string).

- `state`: returns the application-specific state stored in the history entry (or `null` if there is none).

- `sameDocument`: a boolean indicating whether this entry is for the current document, or whether navigating to it will require a full navigation (either from the network, or from the browser's back/forward cache). Note: for `appHistory.current`, this will always be `true`.

_NOTE: `state` would benefit greatly from having an interoperable size limit. This would depend on [whatwg/storage#110](https://github.com/whatwg/storage/issues/110)._

For single-page applications that want to update the current entry in the same manner as today's `history.replaceState()` APIs, we have the following:

```js
// Updates the URL shown in the address bar, as well as the url property. `state` stays the same.
await appHistory.update({ url });

// You can also explicitly null out the state, instead of carrying it over:
await appHistory.update({ url, state: null });

// Only updates the state property.
await appHistory.update({ state });

// Update both at once.
await appHistory.update({ url, state });
```

_TODO: more realistic example, maybe something Redux-esque like `await appHistory.update({ state: {...appHistory.current.state, newKey: newValue } })`._

Similarly, to push a new entry in the same manner as today's `history.pushState()`, we have the following:

```js
// Pushes a new entry onto the app history list, copying the URL (but not the state) from the current one.
await appHistory.push();

// If you want to copy over the state, you can do so explicitly:
await appHistory.push({ state: appHistory.current.state });

// Copy over the URL, and set a new state value:
await appHistory.push({ state });

// Use a new URL, resetting the state to null:
await appHistory.push({ url });

// Use a new URL and state:
await appHistory.push({ url, state });
```

As with `history.pushState()` and `history.replaceState()`, the new URL here must be same-origin and only differ in the path, query, or fragment portions from the current document's current URL. And as with those, you can use relative URLs.

Note that `appHistory.update()` and `appHistory.push()` are asynchronous. As with other [navigations through the app history list](#navigation-through-the-app-history-list), pushing a new entry or updating the current one can be [intercepted or canceled](#navigation-monitoring-and-interception), with the returned promise used to signal the completion of the navigation.

Additionally, like `history.pushState()`, `appHistory.push()` will clear any future entries in the joint session history. (This includes entries coming from frame navigations, or cross-origin entries: so, it can have an impact beyond just the `appHistory.entries` list.)

In general, you would use `appHistory.update()` and `appHistory.push()` in similar scenarios to when you would use `history.pushState()` and `history.replaceState()`. However, note that in the app history API, there are some cases where you don't have to use `appHistory.push()`; see [the discussion below](#using-navigate-handlers-plus-non-history-apis) for more on that subject.

Crucially, `appHistory.current` stays the same regardless of what iframe navigations happen. It only reflects the current entry for the current frame. The complete list of ways the current app history entry can change are:

- Via the above APIs, used by single-page apps to manage their own history entries.

- A fragment navigation, which will act as `appHistory.push({ url: urlWithFragment, state: appHistory.current.state })`, i.e. it will copy over the state.

- A full-page navigation to a different document. This could be an existing document in the browser's back/forward cache, or a new document. In the latter case, this will generate a new entry on the new page's `window.appHistory` object, somewhat similar to `appHistory.push({ url: navigatedToURL, state: null })`. Note that if the navigation is cross-origin, then we'll end up in a separate app history list for that other origin.

Finally, note that these two APIs also have some more advanced features, which are easier to discuss after we have introduced other parts of the app history API. The first is a callback-based variant for dealing with queued navigations, discussed in [its own section](#queued-up-single-page-navigations), and the second is the `navigateInfo` option, discussed [as part of navigation monitoring and interception](#example-using-navigateinfo).

### Inspection of the app history list

In addition to the current entry, the entire list of app history entries can be inspected, using `appHistory.entries`, which returns a frozen array of `AppHistoryEntry` instances. (Recall that all app history entries are same-origin contiguous entries for the current frame, so this is not a security issue.)

This solves the problem of allowing applications to reliably store state in an `AppHistoryEntry`'s `state` property: because they can inspect the values stored in previous entries at any time, it can be used as real application state storage, without needing to keep a side table like one has to do when using `history.state`.

In combination with the following section, the `entries` API also allows applications to display a UI allowing navigation through the app history list.

### Navigation through the app history list

The way for an application to navigate through the app history list is using `appHistory.navigateTo(key)`. For example:

_TODO: realistic example of when you'd use this._

Unlike the existing history API's `history.go()` method, which navigates by offset, navigating by key allows the application to not care about intermediate history entries; it just specifies its desired destination entry. There are also convenience methods, `appHistory.back()` and `appHistory.forward()`.

All of these methods return promises, because navigations can be intercepted and made asynchronous by the `navigate` event handlers that we're about to describe in the next section. There are then several possible outcomes:

- The `navigate` event responds to the navigation using `event.respondWith()`, in which case the promise fulfills or rejects according to the promise passed to `respondWith()`. If the promise rejects, then as part of the failed navigation, `location.href` and `appHistory.current` will roll back to their old values.

- The `navigate` event cancels the navigation without responding to it, in which case the promise rejects with an `"AbortError"` `DOMException`, and `location.href` and `appHistory.current` stay on their original value.

- It's not possible to navigate to the given entry, e.g. `appHistory.navigateTo(key)` was given a non-existant `key`, or `appHistory.back()` was called when there's no previous entries in the app history list. In this case, the promise rejects with an `"InvalidStateError"` `DOMException`, and `location.href` and `appHistory.current` stay on their original value.

- The navigation succeeds, and was a same-document navigation. Then the promise fulfills with `undefined`,  and `location.href` and `appHistory.current` will stay on their new value.

- The navigation succeeds, and it was a different-document navigation. Then the promise will never settle, because the entire document and all its promises will disappear.

As discussed in more detail in the section on [integration with the existing history API and spec](#integration-with-the-existing-history-api-and-spec), navigating through the app history list does navigate through the joint session history. This means it _can_ impact other frames on the page. It's just that, unlike `history.back()` and friends, such other-frame navigations always happen as a side effect of navigating your own frame; they are never the sole result of an app history traversal.

### Navigation monitoring and interception

The most interesting event on `window.appHistory` is the one which allows monitoring and interception of navigations: the `navigate` event. It fires on almost any navigation, either user-initiated or application-initiated, which would update the value of `appHistory.current`. This includes cross-origin navigations (which will take us out of the current app history list); see [below](#example-cross-origin-affiliate-links) for an example of how this is useful. **We expect this to be the main event used by application- or framework-level routers.**

The event object has several useful properties:

- `userInitiated`: a boolean indicating whether the navigation is user-initiated (i.e., a click on an `<a>`, or a form submission) or application-initiated (e.g. `location.href = ...`, `appHistory.push(...)`, etc.). Note that this will _not_ be `true` when you use mechanisms such as `button.onclick = () => appHistory.push(...)`; the user interaction needs to be with a real link or form. See the table in the [appendix](#appendix-types-of-navigations) for more details.

- `destination`: an `AppHistoryEntry` containing the information about the destination of the navigation. Note that this entry might or might not yet be in `window.appHistory.entries`; if it is not, then its `state` will be `null`.

- `sameOrigin`: a convenience boolean indicating whether the navigation is same-origin, and thus will stay in the same app history or not. (I.e., this is `(new URL(e.destination.url)).origin === self.origin`.)

- `hashChange`: a boolean, indicating whether or not this is a same-document [fragment navigation](https://html.spec.whatwg.org/#scroll-to-fragid).

- `formData`: a [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) object containing form submission data, or `null` if the navigation is not a form submission.

- `info`: any value passed by `appHistory.push({ url, state, navigateInfo })` or `appHistory.update({ url, state, navigateInfo })`, if the navigation was initiated by one of those methods and the `navigateInfo` option was supplied; otherwise, null. See [the example below](#example-using-navigateinfo) for more.

- `signal`: an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) which can be monitored for when the navigation gets aborted.

Note that you can check if the navigation will be [same-document or cross-document](#appendix-types-of-navigations) via `event.destination.sameDocument`.

The event is not fired in the following cases:

- User-initiated cross-document navigations via browser UI, such as the URL bar, back/forward button, or bookmarks.
- User-initiated same-document navigations via the browser back/forward buttons. (See discussion in [#32](https://github.com/WICG/app-history/issues/32).)

Whenever it is fired, the event is cancelable via `event.preventDefault()`, which prevents the navigation from going through. To name a few notable examples of when the event is fired, i.e. when you can intercept the navigation:

- User-initiated navigations via `<a>` and `<form>` elements, including both same-document fragment navigations and cross-document navigations.
- Programmatically-initiated navigations, via mechanisms such as `location.href = ...` or `aElement.click()`, including both same-document fragment navigations and cross-document navigations.
- Programmatically-initiated same-document navigations initiated via `appHistory.push()`, `appHistory.update()`, or their old counterparts `history.pushState()` and `history.replaceState()`.

(This list is not comprehensive; for the complete list of possible navigations on the web platform, see [this appendix](#appendix-types-of-navigations).)

Although the ability to intercept cross-document navigations, especially cross-origin ones, might be surprising, in general it doesn't grant additional power. That is, web developers can already intercept `<a>` `click` events, or modify their code that would set `location.href`, even if the destination URL is cross-origin.

On the other hand, cases that are not interceptable today, where the user is the instigator of the navigation through browser UI, are not interceptable. This ensures that web applications cannot trap the user on a given document by intercepting cross-document URL bar navigations, or disable the user's back/forward buttons. Note that, in the case of the back/forward buttons, even same-document interception isn't allowed. This is because it's easy to generate same-document app history entries (e.g., using `appHistory.push()` or `history.pushState()`); if we allowed intercepting traversal to them, this would allow sites to disable the back/forward buttons. We realize that this limits the utility of the `navigate` event in some cases, and are open to exploring other ways of combating abuse: see the discussion in [#32](https://github.com/WICG/app-history/issues/32).

Additionally, the event has a special method `event.respondWith(promise)`. If called for a same-origin navigation, this will:

- Cancel any fragment navigation or cross-document navigation.
- Immediately update the URL bar, `location.href`, and `appHistory.current`, but with `appHistory.current.finished` set to false.
- Wait for the promise to settle.
  - If it rejects, revert the URL bar, `location.href`, and `appHistory.current` to their previous values.
  - If it fulfills, update `appHistory.current.finished` to true, and fire [a variety of events](./interception-details.md).
- For the duration of the promise settling, any browser loading UI such as a spinner will behave as if it were doing a cross-document navigation.

Note that the browser does not wait for the promise to settle in order to update its UI (such as URL bar or back button).

_TODO: should we give direct control over when the browser UI updates, in case developers want to update it later in the lifecycle after they're sure the navigation will be a success? Would it be OK to let the UI get out of sync with the history list?_

#### Accessibility benefits of standardized single-page navigations

The `navigate` event's `event.respondWith()` method provides a helpful convenience for implementing single-page navigations, as discussed above. But beyond that, providing a direct signal to the browser as to the duration and outcome of a single-page navigation has benefits for accessibility technology users.

In particular, with [cross-document](#appendix-types-of-navigations) navigations, AT users get clear feedback that a navigation has occurred. But traditionally, single-page navigations have not been communicated in the same way to accessibility technology. This is in part because it is not clear to the browser when a user interaction causes a single-page navigation, because of the app-specific JavaScript that intermediates between such interactions and the eventual call to `history.pushState()`/`history.replaceState()`. In particular, it's unclear exactly when the navigation begins and ends: trying to use the URL change as a signal doesn't work, since when applications call `history.pushState()` during the content loading process varies.

Implementing single-page navigations by using the `navigate` event and its `respondWith()` function solves this part of the problem. It gives the browser clear insight into when a navigation is being handled as a single-page navigation, and the provided promise allows the browser to know how long the navigation takes, and whether or not it succeeds. We expect browsers to use these to update their own UI (including any loading indicators; see [whatwg/fetch#19](https://github.com/whatwg/fetch/issues/19) and [whatwg/html#330](https://github.com/whatwg/html/issues/330) for previous feature requests). And we expect browsers to communicate these signals to accessibility technology, in the same way they do for traditional cross-document navigations.

This does not yet solve all accessibility problems with single-page navigations. In particular, this proposal doesn't currently have a solution for focus management and placing the user's keyboard focus in the relevant place after navigation. However, we are very interested in finding a way to make usage of the app history API guide web developers toward creating accessible experiences, and would like to explore additions or changes that would help with these aspects of the problem as well. Please join us to discuss and brainstorm in [#25](https://github.com/WICG/app-history/issues/25).

#### Measuring standardized single-page navigations

Continuing with the theme of `respondWith()` giving ecosystem benefits beyond just web developer convenience, telling the browser about the start time, duration, end time, and success/failure if a single-page app navigation has benefits for metrics gathering.

In particular, analytics frameworks would be able to consume this information from the browser in a way that works across all applications using the app history API. See the example in the [Current entry change monitoring](#current-entry-change-monitoring) section for one way this could look; other possibilities include integrating into the existing [performance APIs](https://w3c.github.io/performance-timeline/).

This standardized notion of single-page navigations also gives a hook for other useful metrics to build off of. For example, you could imagine variants of the `"first-paint"` and `"first-contentful-paint"` APIs which are collected after the `navigate` event is fired. Or, you could imagine vendor-specific or application-specific measurements like [Cumulative Layout Shift](https://web.dev/cls/) or React hydration time being reset after such navigations begin.

This isn't a complete panacea: in particular, such metrics are gameable by bad actors. Such bad actors could try to drive down average measured "load time" by generating excessive `navigate` events that don't actually do anything. So in scenarios where the web application is less interested in measuring itself, and more interested in driving down specific metrics, those creating the metrics will need to take into account such misuse of the API. Some potential countermeasures against such gaming could include:

- Only using the start time of the navigation in creating such metrics, and not using the promise-settling time. This avoids gaming via code such as `event.respondWith(Promise.resolve()); await doActualNavigation()` which makes the navigation appear instant to the browser.

- Filtering to only count navigations where `event.userInitiated` is true.

- Filtering to only count navigations where the URL changes (i.e., `appHistory.current.url !== event.destination.url`).

- We hope that most analytics vendors will come to automatically track `navigate` events as page views, and measure their duration. Then, apps using such analytics vendors would have an incentive to keep their page view statistics meaningful, and thus be disincentivized to generate spurious navigations.

#### Example: replacing navigations with single-page app navigations

The following is the kind of code you might see in an application or framework's router:

```js
appHistory.addEventListener("navigate", e => {
  // Don't intercept cross-origin navigations; let the browser handle those normally.
  if (!e.sameOrigin) {
    return;
  }

  // Don't intercept fragment navigations.
  if (e.hashChange) {
    return;
  }

  if (e.formData) {
    e.respondWith(processFormDataAndUpdateUI(e.formData, e.signal));
  } else {
    e.respondWith(doSinglePageAppNav(e.destination, e.signal));
  }
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
- Same-document URL/state updates (via `history.pushState()`, `appHistory.update()`, etc.):
  1. Send the information about the URL/state update to `doSinglePageAppNav()`, which will use it to modify the current document.
  1. After that UI update is done, potentially asynchronously, notify the app and the browser about the navigation's success or failure.
- Cross-document normal navigations:
  1. Prevent the browser handling, which would unload the document and create a new one from the network.
  1. Instead, send the information about the navigation to `doSinglePageAppNav()`, which will use it to modify the current document.
  1. After that UI update is done, potentially asynchronously, notify the app and the browser about the navigation's success or failure.
- Cross-document form submissions:
  1. Prevent the browser handling, which would unload the document and create a new one from the network.
  1. Instead, send the form data to `processFormDataAndUpdateUI()`, which will use it to modify the current document.
  1. After that UI update is done, potentially asynchronously, notify the app and the browser about the navigation's success or failure.

Notice also how by passing through the `AbortSignal` found in `e.signal`, we ensure that any aborted navigations abort the associated fetch as well.

#### Example: single-page app "redirects"

A common scenario in web applications with a client-side router is to perform a "redirect" to a login page if you try to access login-guarded information. The following is an example of how one could implement this using the `navigate` event:

```js
appHistory.addEventListener("navigate", e => {
  const url = new URL(e.destination.url);
  if (url.pathname === "/user-profile") {
    // Cancel the navigation:
    e.preventDefault();

    // Do another navigation to /login, which will fire a new `navigate` event:
    location.href = "/login";
  }
});
```

_TODO: should these be combined into a helper method like `e.redirect("/login")`?_

In practice, this might be hidden behind a full router framework, e.g. the Angular framework has a notion of [route guards](https://angular.io/guide/router#preventing-unauthorized-access). Then, the framework would be the one listening to the `navigate` event, looping through its list of registered route guards to figure out the appropriate reaction.

NOTE: if you combine this example with the previous one, it's important that this route guard event handler be installed before the general single-page navigation event handler. Additionally, you'd want to either insert a call to `e.stopImmediatePropagation()` in this example, or a check of `e.defaultPrevented` in that example, to stop the other `navigate` event handler from proceeding with the canceled navigation. In practice, we expect there to be one large application- or framework-level `navigate` event handler, which would take care of ensuring that route guards happen before the other parts of the router logic, and preventing that logic from executing.

#### Example: cross-origin affiliate links

A common [query](https://stackoverflow.com/q/11798336/3191) is how to append affiliate IDs onto links. Although this can be done server-side, sometimes it is convenient to do so client side, especially in the case of dynamic content. Today, this requires intercepting `click` events on `<a>` elements, or using a `MutationObserver` to watch for new link insertions. The `navigate` event provides a simpler way to do this:

```js
appHistory.addEventListener("navigate", e => {
  const url = new URL(e.destination.url);
  if (url.hostname === "store.example.com") {
    url.queryParams.set("affiliateId", "ead21623-781e-442f-a2c4-6cc1b2a9fda2");

    e.preventDefault();
    location.href = url;
  }
});
```

_TODO: it feels like this should be less disruptive than a cancel-and-perform-new-navigation; it's just a tweak to the outgoing navigation. Using the same code as the previous example feels wrong. See discussion in [#5](https://github.com/WICG/app-history/issues/5)._

#### Example: using `navigateInfo`

As mentioned above, the `navigate` event has an `event.info` property containing data passed from `appHistory.push()` or `appHistory.update()`, when their caller uses the `navigateInfo` option. The intended use of this value is to convey transient information about this particular navigation, such as how it happened. In this way, it's different from the persistent `event.destination.state` property.

One example of how this might be used is to trigger different single-page navigation renderings depending on how a certain route was reached. For example, consider a photo gallery app, where you can reach the same photo URL and state via various routes:

- Clicking on it in a gallery view
- Clicking "next" or "previous" when viewing another photo in the album
- Etc.

Each of these wants a different animation at navigate time. This information doesn't make sense to store in the persistent URL or history entry state, but it's still important to communicate from the rest of the application, into the router (i.e. `navigate` event handler). This could be done using code such as

```js
document.addEventListener("keydown", async e => {
  if (e.key === "ArrowLeft" && hasPreviousPhoto()) {
    await appHistory.push({ url: getPreviousPhotoURL(), navigateInfo: { via: "go-left" } });
  }
  if (e.key === "ArrowRight" && hasNextPhoto()) {
    await appHistory.push({ url: getNextPhotoURL(), navigateInfo: { via: "go-right" } });
  }
});

photoGallery.addEventListener("click", e => {
  if (e.target.closest(".photo-thumbnail")) {
    await appHistory.push({ url: getPhotoURL(e.target), navigateInfo: { via: "gallery", thumbnail: e.target } });
  }
});

appHistory.addEventListener("navigate", e => {
  if (isPhotoNavigation(e)) {
    e.respondWith((async () => {
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
    })());
  }
});
```

### Navigations while a navigation is ongoing

**This section is under heavy construction. There are several open issues on it and it's not fully integrated with the latest thinking on the [detailed navigation interception lifecycle](./interception-details.md).**

Because this proposal makes the web-developer-facing concept of a navigation always asynchronous, i.e. from the start of the `navigate` event through to the end of any promise passed to `respondWith()` settling, it's possible for navigations to happen while an existing navigation is ongoing. Even very simple code like the following would trigger this:

```js
appHistory.push({ url: "/first" }); // intentionally no `await`
appHistory.push({ url: "/second" });
```

In this proposal, any [interceptable](#navigation-monitoring-and-interception) navigations are queued up, one after the other: thus, in the above code example, first one complete navigation (including the `navigate` event and any of its work) finishes for `/first`, and only after that's done does the navigation to `/second` go through. This is true regardless of how the navigation is triggered: i.e., the `location.href` setter, `<a>` clicks, and `history.pushState()` all result in such queued-up navigations.

Note that non-interceptable navigations, such as user-initiated navigations via the URL bar or back button, jump the queue and interrupt any ongoing or queued-up navigations. This prevents a deep queue from being used to trap the user on a page.

To give visibility into this queuing process, and allow applications and frameworks to manage the queue, there's an `upcomingnavigate` event. Inside the event handler, you can inspect both the upcoming (queued) navigation's `AppHistoryEntry`, and the `AppHistoryEntry` of the ongoing navigation. You can also discard the upcoming entry. It might be used as follows:

```js
appHistory.addEventListener("upcomingnavigate", e => {
  if (isNotImportant(e.upcoming.url) && isImportant(e.ongoing.url)) {
    e.discardUpcoming();
  }
});
```

### Queued up single-page navigations

**This section is under heavy construction. There are several open issues on it and it's not fully integrated with the latest thinking on the [detailed navigation interception lifecycle](./interception-details.md).**

Consider trying to code a "next" button that performs a single-page navigation. This can be prone to race conditions, since with the app history API, single-page navigations are asynchronous. For example, if you're on `/photos/1` and click the next button twice, the intended behavior is to end up at `photos/3`, even if `photos/2` takes a long time to load and the click handler executes while the URL bar still reads `/photos/1`.

Concretely, code such as the following is buggy:

```js
let currentPhoto = 1;

document.querySelector("#next").onclick = async () => {
  await appHistory.push({ url: `/photos/${currentPhoto + 1}` });
};

appHistory.addEventListener("navigate", e => {
  const photoNumber = photoNumberFromURL(e.destination.url);

  if (photoNumber) {
    e.respondWith((async () => {
      const blob = await (await fetch(`/raw-photos/${photoNumber}.jpg`)).blob();
      const url = URL.createObjectURL(blob);
      document.querySelector("#current-photo").src = url;

      currentPhoto = photoNumber;
    })());
  }
});

function photoNumberFromURL(url) {
  const result = /\/photos/(\d+)/.exec((new URL(url)).pathname);
  if (result) {
    return Number(result[1]);
  }
  return null;
}
```

To fix this, the `appHistory.push()` and `appHistory.update()` APIs have callback variants. The callback will only be called after all ongoing navigations have finished. This allows non-buggy code such as the following:

```js
document.querySelector("#next").onclick = async () => {
  await appHistory.push(() => {
    const photoNumber = photoNumberFromURL(appHistory.current.url);
    return { url: `/photos/${photoNumber + 1}` };
  });
};
```

Although not shown in the above example, the callback could also return a `state` value.

_TODO: should the callback be able to say "nevermind, I don't care anymore, please don't navigate"? We could let the *caller* do that by passing an `AbortSignal` after the callback... And the general *app* can do it using `upcomingnavigate`... Maybe throwing an exception??_

In general, the idea of these callback variants is that there are cases where the new URL or state is not determined synchronously, and is a function of the current state of the world at the time the navigation is ready to be performed.

### Per-entry events

Each `AppHistoryEntry` has a series of events which the application can react to. **We expect these to mostly be used by decentralized parts of the application's codebase, such as components, to synchronize their state with the history list.** Unlike the `navigate` event, these events are not cancelable. They are used only for reacting to state changes, not intercepting or preventing navigations.

The application can use the `navigateto` and `navigatefrom` events to update the UI in response to a given entry becoming the current app history entry. For example, consider a photo gallery application. One way of implementing this would be to store metadata about the photo in the corresponding `AppHistoryEntry`'s `state` property. This might look something like this:

```js
async function showPhoto(photoId) {
  // In our app, the `navigate` handler will take care of actually showing the photo and updating the content area.
  await appHistory.push({ url: `/photos/${photoId}`, state: {
    dateTaken: null,
    caption: null
  } });

  // When we navigate away from this photo, save any changes the user made.
  appHistory.current.addEventListener("navigatefrom", e => {
    e.target.state.dateTaken = document.querySelector("#photo-container > .date-taken").value;
    e.target.state.caption = document.querySelector("#photo-container > .caption").value;
  });

  // If we ever navigate back to this photo, e.g. using the browser back button or
  // appHistory.navigateTo(), restore the input values.
  appHistory.current.addEventListener("navigateto", e => {
    document.querySelector("#photo-container > .date-taken").value = e.target.state.dateTaken;
    document.querySelector("#photo-container > .caption").value = e.target.state.caption;
  });
}
```

Note how in the event handler for these events, `event.target` is the relevant `AppHistoryEntry`, so that the event handler can use its properties (like `state`, `key`, or `url`) as needed.

Additionally, there's a `dispose` event, which occurs when an app history entry is permanently evicted and unreachable: for example, in the following scenario.

```js
const startingKey = appHistory.current.key;

appHistory.push();
appHistory.current.addEventListener("dispose", () => console.log(1));

appHistory.push();
appHistory.current.addEventListener("dispose", () => console.log(2));

appHistory.push();
appHistory.current.addEventListener("dispose", () => console.log(3));

appHistory.navigateTo(startingKey);
appHistory.push();

// Logs 1, 2, 3 as that branch of the tree gets pruned.
```

This can be useful for cleaning up any information in secondary stores, such as `sessionStorage` or caches, when we're guaranteed to never reach those particular history entries again.

### Current entry change monitoring

The `window.appHistory` object has an event, `currentchange`, which allows the application to react to any updates to the `appHistory.current` property. This includes both navigations that change its value, and calls to `appHistory.update()` that change its `state` or `url` properties. This cannot be intercepted or canceled, as it occurs after the navigation has already happened; it's just an after-the-fact notification.

This event has one special property, `event.startTime`, which for [same-document](#appendix-types-of-navigations) navigations gives the value of `performance.now()` when the navigation was initiated. This includes for navigations that were originally [cross-document](#appendix-types-of-navigations), like the user clicking on `<a href="https://example.com/another-page">`, but were transformed into same-document navigations by [navigation interception](#navigation-monitoring-and-interception). For completely cross-document navigations, `startTime` will be `null`.

"Initiated" means either when the corresponding API was called (like `location.href` or `appHistory.push()`), or when the user activated the corresponding `<a>` element, or submitted the corresponding `<form>`. This allows it to be used for determining the overall time from navigation initiation to navigation completion, including the time it took for a promise passed to `e.respondWith()` to settle:

```js
appHistory.addEventListener("currentchange", e => {
  if (e.startTime) {
    const loadTime = e.timeStamp - e.startTime;

    document.querySelector("#status-bar").textContent = `Loaded in ${loadTime} ms!`;
    analyticsPackage.sendEvent("single-page-app-nav", { loadTime });
  } else {
    document.querySelector("#status-bar").textContent = `Welcome to this document!`;
  }
});
```

_TODO: reconsider cross-document navigations. There will only be one (the initial load of the page); should we even fire this event in that case? (That's [#31](https://github.com/WICG/app-history/issues/31).) Could we give `startTime` a useful value there, if we do?_

_TODO: is this property-on-the-event design the right one, or should we integrate with the performance timeline APIs, or...? Discuss in [#33](https://github.com/WICG/app-history/issues/33)._

_TODO: Add a non-analytics examples, similar to how people use `popstate` today._

### Complete event sequence

Between the per-`AppHistoryEntry` events and the `window.appHistory` events, as well as promise return values, there's a lot of events floating around. Here's how they all come together:

1. `navigate` fires on `window.appHistory`.
1. If the event is canceled using `event.preventDefault()`, then:
    1. If the process was initiated by a call to an `appHistory` API that returns a promise, then that promise gets rejected with an `"AbortError"` `DOMException`.
1. Otherwise:
    1. `appHistory.current` fires `navigatefrom`.
    1. `location.href` updates.
    1. `appHistory.current` updates. `appHistory.current.finished` is `false`.
    1. `currentchange` fires on `window.appHistory`.
    1. `appHistory.current` fires `navigateto`.
    1. Any now-unreachable `AppHistoryEntry` instances fire `dispose`.
    1. The URL bar updates.
    1. Any loading spinner UI starts, if a promise was passed to the `navigate` handler's `event.respondWith()`.
    1. After the promise passed to `event.respondWith()` fulfills, or after one microtask if `event.respondWith()` was not called:
        1. `appHistory.current.finished` changes to `true`.
        1. `appHistory.current` fires `finish`.
        1. `navigatefinish` is fired on `appHistory`.
        1. Any loading spinner UI stops.
        1. If the process was initiated by a call to an `appHistory` API that returns a promise, then that promise gets fulfilled.
    1. Alternately, if the promise passed to `event.respondWith()` rejects:
        1. `navigateerror` fires on `window.appHistory`.
        1. `location.href` changes back to the value it had previously.
        1. `appHistory.current` changes back to the previous entry, before the navigation.
        1. `currentchange` fires on `window.appHistory`.
        1. `appHistory.current` fires `navigateto`.
        1. The no-longer current `AppHistoryEntry` that was being navigated to fires `dispose`.
        1. Any loading spinner UI stops.
        1. If the process was initiated by a call to an `appHistory` API that returns a promise, then that promise gets rejected with the same rejection reason.

For more detailed analysis, including specific code examples, see [this dedicated document](./interception-details.md).

## Guide for migrating from the existing history API

For web developers using the API, here's a guide to explain how you would replace usage of `window.history` with `window.appHistory`.

### Performing navigations

Instead of using `history.pushState(state, uselessTitle, url)`, use `await appHistory.push({ state, url })`.

Instead of using `history.replaceState(state, uselessTitle, url)`, use `await appHistory.update({ state, url })`. Note that if you omit the state value, i.e. if you say `appHistory.update({ url })`, then unlike `history.replaceState()`, this will copy over the current entry's state.

Instead of using `history.back()` and `history.forward()`, use `await appHistory.back()` and `await appHistory.forward()`. Note that unlike the `history` APIs, the `appHistory` APIs will ignore other frames, and will only control the navigation of your frame. This means it might move through multiple entries in the joint session history, skipping over any entries that were generated purely by other-frame navigations.

Also note that if the navigation doesn't have an effect, the `appHistory` traversal methods will return a rejected promise, unlike the `history` traversal methods which silently do nothing. You can detect this as follows:

```js
try {
  await appHistory.back();
} catch (e) {
  if (e.name === "InvalidStateError") {
    console.log("We weren't able to go back, because there was nothing previous in the app history list");
  }
}
```

Note that unlike the `history` APIs, these `appHistory` APIs will not go to another origin. For example, trying to call `appHistory.back()` when the previous document in the joint session history is cross-origin will return a rejected promise, and trigger the `console.log()` call above.

Instead of using `history.go(offset)`, use `await appHistory.navigateTo(key)` to navigate to a specific entry. As with `back()` and `forward()`, `appHistory.navigateTo()` will ignore other frames, and will only control the navigation of your frame. If you specifically want to reproduce the pattern of navigating by an offset (not recommended), you can use code such as the following:

```js
const offsetIndex = appHistory.entries.indexOf(appHistory.current) + offset;
const entry = appHistory.entries[offsetIndex];
if (entry) {
  await appHistory.navigateTo(entry.key);
}
```

### Using `navigate` handlers plus non-history APIs

Many cases which use `history.pushState()` today can be replaced with `location.href`, or just deleted, when using `appHistory`. This is because if you have a listener for the `navigate` event on `appHistory`, that listener can use `event.respondWith()` to transform navigations that would normally be new-document navigations into same-document navigations. So for example, instead of

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
  location.href = "/success-page";
};

document.addEventListener("navigate", e => {
  if (shouldBeSinglePageNav(e.destination.url)) {
    e.respondWith((async () => {
      document.querySelector("main").innerHTML = await loadContentFor(e.destination.url);
    })());
  }
});
</script>
```

Note how in this case we don't need to use `appHistory.push()`, even though the original code used `history.pushState()`.

_TODO: we could also consider removing `appHistory.push()` if we're not sure about remaining use cases? Then we'd likely have to add a state argument to something like `location.assign()`..._

### Attaching and using history state

To update the current entry's state, instead of using `history.replaceState(newState)`, use `appHistory.update({ newState })`.

To read the current entry's state, instead of using `history.state`, use `appHistory.current.state`.

In general, state in app history is expected to be more useful than state in the `window.history` API, because:

- It can be introspected even for the non-current entry, e.g. using `appHistory.entries[i].state`.
- It is not erased by navigations that are not under the developer's control, such as fragment navigations (for which the state is copied over) and iframe navigations (which don't affect the app history list).

This means that the patterns that are often necessary to reliably store application and UI state with `window.history`, such as maintaining a side-table or using `sessionStorage`, should not be necessary with `window.appHistory`.

### Introspecting the history list

To see how many history entries are in the app history list, use `appHistory.entries.length`, instead of `history.length`. However, note that the semantics are different: app history entries only include same-origin contiguous entries for the current frame, and so that this doesn't reflect the history before the user arrived at the current origin, or the history of iframes. We believe this will be more useful for the patterns that people want in practice, such as showing an in-application back button if `appHistory.entries.length > 0`.

The app history API allows introspecting all entries in the app history list, using `appHistory.entries`. This should replace some of the workarounds people use today with the `window.history` API for getting a sense of the history list, e.g. as described in [whatwg/html#2710](https://github.com/whatwg/html/issues/2710).

Finally, note that `history.length` is highly non-interoperable today, in part due to the complexity of the joint session history model, and in part due to historical baggage. `appHistory`'s less complex model, and the fact that it will be developed in the modern era when there's a high focus on ensuring interoperability through web platform tests, means that using it should allow developers to avoid cross-browser issues with `history.length`.

### Watching for navigations

Today there are two events related to navigations, `hashchange` and `popstate`, both on `Window`. These events are quite problematic and hard to use; see, for example, [whatwg/html#5562](https://github.com/whatwg/html/issues/5562) or other [open issues](https://github.com/whatwg/html/issues?q=is%3Aissue+is%3Aopen+popstate) for some discussion. MDN's fourteen-step guide to ["When popstate is sent"](https://developer.mozilla.org/en-us/docs/Web/API/Window/popstate_event#when_popstate_is_sent), which [doesn't even match any browsers](https://docs.google.com/document/d/1Pdve-DJ1JCGilj9Yqf5HxRJyBKSel5owgOvUJqTauwU/edit#), is also indicative of the problem.

The app history API provides several replacements that subsume these events:

- To react to and potentially intercept navigations before they complete, use the `navigate` event on `appHistory`. See the [Navigation monitoring and interception](#navigation-monitoring-and-interception) section for more details, including how the event object provides useful information that can be used to distinguish different types of navigations.

- To react to navigations that have completed, use the `currentchange` event on `appHistory`. See the [Current entry change monitoring](#current-entry-change-monitoring) section for more details, including an example of how to use it to determine how long a same-document navigation took.

- To watch a particular entry to see when it's navigated to, navigated from, or becomes unreachable, use that `AppHistoryEntry`'s `navigateto`, `navigatefrom`, and `dispose` events. See the [Per-entry events](#per-entry-events) section for more details.

## Integration with the existing history API and spec

At a high level, app history is meant to be a layer on top of the HTML Standard's existing concepts. It does not require a novel model for session history, either in implementations or specifications. (Although, it will only be possible to specify it rigorously once the existing specification gets cleaned up, per the work we're doing in [whatwg/html#5767](https://github.com/whatwg/html/issues/5767).)

This is done through:

- Ensuring that app history entries map directly to the specification's existing history entries. The `appHistory.entries` API only presents a subset of them, namely same-frame contiguous, same-origin ones, but each is backed by an existing entry.

- Ensuring that traversal through app history always maps to a traversal through the joint session history, i.e. a traversal which is already possible today.

### Correspondence with session history entries

An `AppHistoryEntry` corresponds directly to a [session history entry](https://html.spec.whatwg.org/#session-history-entry) from the existing HTML specification. However, not every session history entry would have a corresponding `AppHistoryEntry` in a given `Window`: `AppHistoryEntry` objects only exist for session history entries which are same-origin to the current one, and contiguous within that frame.

Example: if a browsing session contains session history entries with the URLs

```
1. https://example.com/foo
2. https://example.com/bar
3. https://other.example.com/whatever
4. https://example.com/baz
```

then, if the current entry is 4, there would only be one `AppHistoryEntry` in `appHistory.entries`, corresponding to 4 itself. If the current entry is 2, then there would be two `AppHistoryEntries` in `appHistory.entries`, corresponding to 1 and 2.

To make this correspondence work, every spec-level session history entry would gain two new fields:

- key, containing a browser-generated UUID. This is what backs `appHistoryEntry.key`.
- app history state, containing a JavaScript value. This is what backs `appHistoryEntry.state`.

Note that the "app history state" field has no interaction with the existing "serialized state" field, which is what backs `history.state`. This route was chosen for a few reasons:

- The desired semantics of `AppHistoryEntry` state is that it be carried over on fragment navigations, whereas `history.state` is not carried over. (This is a hard blocker.)
- A clean separation can help when a page contains code that uses both `window.history` and `window.appHistory`. That is, it's convenient that existing code using `window.history` does not inadvertently mess with new code that does state management using `window.appHistory`.
- Today, the serialized state of a session history entry is only exposed when that entry is the current one. The app history API exposes `appHistoryEntry.state` for all entries, via `appHistory.entries[i].state`. This is not a security issue since all app history entries are same-origin contiguous, but if we exposed the serialized state value even for non-current entries, it might break some assumptions of existing code.
- We're still having some discussions about making `appHistoryEntry.state` into something more structured, like a key/value store instead of an arbitrary JavaScript value. If we did that, using a new field would be better, so that the structure couldn't be destroyed by code that does `history.state = "a string"` or similar.

Apart from these new fields, the session history entries which correspond to `AppHistoryEntry` objects will continue to manage other fields like document, scroll restoration mode, scroll position data, and persisted user state behind the scenes, in the usual way. The serialized state, title, and browsing context name fields would continue to work if they were set or accessed via the usual APIs, but they don't have any manifestation inside the app history APIs, and will be left as null by applications that avoid `window.history` and `window.name`.

_TODO: actually, we should probably expose scroll restoration mode, like `history.scrollRestoration`? That API has legitimate use cases, and we'd like to allow people to never touch `window.history`..._

### Correspondence with the joint session history

The view of history which the user sees, and which is traversable with existing APIs like `history.go()`, is the joint session history.

Unlike the view of history presented by `window.history`, `window.appHistory` only gives a view onto session history entries for the current browsing session. This view does not present the joint session history, i.e. it is not impacted by frames. Notably, this means `appHistory.entries.length` is likely to be quite different from `history.length`.

Example: consider the following setup.

1. `https://example.com/start` loads.
1. The user navigates to `https://example.com/outer` by clicking a link. This page contains an iframe with `https://example.com/inner-start`.
1. Code on `https://example.com/outer` calls `appHistory.push({ url: "/outer-pushed" })`.
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

The app history list (which also matches the existing spec's session history) for the outer frame looks like:

```
O1. https://example.com/start        (associated to A)
O2. https://example.com/outer        (associated to B)
O3. https://example.com/outer-pushed (associated to C and D)
```

The app history list for the inner frame looks like:

```
I1. https://example.com/inner-start  (associated to B and C)
I2. https://example.com/inner-end    (associated to D)
```

Traversal operates on the joint session history, which means that it's possible to impact other frames. Continuing with our previous setup, and assuming the current entry in the joint session history is D, then:

- If code in the outer frame calls `appHistory.back()`, this will take us back to O2, and thus take the joint session history back to B. This means the inner frame will be navigated from `/inner-end` to `/inner-start`, changing its current app history entry from I2 to I1.

- If code in the inner frame calls `appHistory.back()`, this will take us back to I1, and take the joint session history back to C. (This does not impact the outer frame.) The rule here for choosing C, instead of B, is that it moves the joint session history the fewest number of steps necessary to make I1 active.

- If code in either the inner frame or the outer frame calls `history.back()`, this will take the joint session history back to C, and thus update the inner frame's current app history entry from I2 to I1. (There is no impact on the outer frame.)

Note that as currently planned, any such programmatic navigations, including ones originating from other frames, are [interceptable and cancelable](#navigation-monitoring-and-interception) as part of the `navigate` event part of the proposal.

### Integration with navigation

To understand when navigation interception and queuing interacts with the existing navigation spec, see [the navigation types appendix](#appendix-types-of-navigations). In cases where interception is allowed and takes place, it is essentially equivalent to preventing the normal navigation and instead performing the [URL and history update steps](https://html.spec.whatwg.org/#url-and-history-update-steps). See more detail in the [dedicated document](./interception-details.md).

The way in which navigation interacts with session history entries generally is not meant to change; the correspondence of a session history entry to an `AppHistoryEntry` does not introduce anything novel there.

## Impact on the back button and user agent UI

The app history API doesn't change anything about how user agents implement their UI: it's really about developer-facing affordances. Users still care about the joint session history, and so that will continue to be presented in UI surfaces like holding down the back button. Similarly, pressing the back button will continue to navigate through the joint session history, potentially across origins and out of the current app history (into a new app history, on the new origin). The design discussed in [the previous section](#correspondence-with-the-joint-session-history) ensures that app history cannot get the browser into a strange novel state that has not previously been seen in the joint session history.

One consequence of this is that when iframes are involved, the back button may navigate through the joint session history, without changing the current _app history_ entry. This is because, for the most part, the behavior of the back button is the same as that of `history.back()`, which as the previous section showed, only impacts one frame (and thus one app history list) at a time.

Finally, note that user agents can continue to refine their mapping of UI to joint session history to give a better experience. For example, in some cases user agents today have the back button skip joint session history entries which were created without user interaction. We expect this heuristic would continue to be applied for `appHistory.push()`, just like it is for today's `history.pushState()`.

## Security and privacy considerations

Privacy-wise, this feature is neutral, due to its strict same-origin contiguous entry scoping. That is, it only exposes information which the application already has access to, just in a more convenient form. The storage of state in the `AppHistoryEntry`'s `state` property is a convenience with no new privacy concerns, since that state is only accessible same-origin; that is, it provides the same power as something like `sessionStorage` or `history.state`.

One particular point of interest is the user-agent generated `appHistoryEntry.key` field, which is a user-agent-generated UUID. Here again the strict same-origin contiguous entry scoping prevents this from being used for cross-site tracking or similar. Specifically:

- This key lives only for the duration of that app history entry, i.e. for the lifetime of the browsing session. For example, opening a new tab (or iframe) to the same URL will generate a different `key` value. So it is not a stable user-specific identifier.

- This information is not accessible across sites, as a given app history entry is specific to a frame and origin. That is, cross-site pages will always have different `key` values for all `AppHistoryEntry`s they can examine; there is no way to use app history entry `key`s to correlate users.

(Collaborating cross-origin same-site pages can inspect each other's `AppHistoryEntry`s using `document.domain`, but they can also inspect every other aspect of each others' global objects.)

Security-wise, this feature has been carefully designed to give no new abilities that might be disruptive to the user or to delicate parts of browser code. See, for example, the restrictions on [navigation monitoring and interception](#navigation-monitoring-and-interception) to ensure that it does not allow trapping the user, or the discussion of how this proposal [does not impact how browser UI presents session history](#impact-on-back-button-and-user-agent-ui).

See also the [W3C TAG security and privacy questionnaire answers](./security-and-privacy-questionnaire.md).

## Stakeholder feedback

- W3C TAG: [w3ctag/design-reviews#605](https://github.com/w3ctag/design-reviews/issues/605)
- Browser engines:
  - Chromium: Excited about the design space; has not yet investigated implementation implications in depth.
  - Gecko: No feedback so far
  - WebKit: No feedback so far
- Web developers: Generally positive; see e.g. reactions and replies to [WICG/proposals#20](https://github.com/WICG/proposals/issues/20), or the participation on this repository's issue tracker.

## Acknowledgments

This proposal is based on [an earlier revision](https://github.com/slightlyoff/history_api/blob/55b1d7a933cfd2dccddb16668b13dbc9ff06a3f2/navigator.md) by [@tbondwilkinson](https://github.com/tbondwilkinson), which outlined all the same capabilities in a different form. It also incorporates the ideas from [philipwalton@](https://github.com/philipwalton)'s [navigation event proposal](https://github.com/philipwalton/navigation-event-proposal/tree/aa0b688eab37f906660e60af8dc49df04d33c17f).

Thanks also to
[@chrishtr](https://github.com/chrishtr),
[@creis](https://github.com/creis),
[@dvoytenko](https://github.com/dvoytenko),
[@esprehn](https://github.com/esprehn),
[@housseindjirdeh](https://github.com/housseindjirdeh),
[@jakearchibald](https://github.com/jakearchibald),
[@matt-buland-sfdc](https://github.com/matt-buland-sfdc),
[@MelSumner](https://github.com/MelSumner),
[@mmocny](https://github.com/mmocny),
[@natechapin](https://github.com/natechapin),
[@slightlyoff](https://github.com/slightlyoff), and
[@Yay295](https://github.com/Yay295)
for their help in exploring this space and providing feedback.

## Appendix: types of navigations

The web platform has many ways of initiating a navigation. For the purposes of the app history API, the following is intended to be a comprehensive list:

- Users can trigger navigations via browser UI, including (but not necessarily limited to):
  - The URL bar
  - The back and forward buttons
  - The reload button
  - Bookmarks
- `<a>` and `<area>` elements (both directly by users, and programmatically via `element.click()` etc.)
- `<form>` elements (both directly by users, and programmatically via `element.submit()` etc.)
- `<meta http-equiv="refresh">`
- The `Refresh` HTTP response header
- The `window.location` setter, the various `location.*` setters, and the `location.replace()`, `location.assign()`, and `location.reload()` methods
- Calling `window.open(url, nameOfSomeWindow)` will navigate a window whose `window.name` is `nameOfSomeWindow`
- `history.back()`, `history.forward()`, and `history.go()`
- `history.pushState()` and `history.replaceState()`
- `appHistory.back()`, `appHistory.forward()`, `appHistory.navigateTo()`
- `appHistory.push()` and `appHistory.update()`
- [`document.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Document/open)

**Cross-document navigations** are navigations where, after the navigation completes, you end up in a different `Document` object than the one you are curently on. Notably, these unload the old document, and stop running any JavaScript code from there.

**Same-document** navigations are ones where, after the navigation completes, you stay on the same `Document`, with the same JavaScript environment.

Most navigations are cross-document navigations. Same-document navigations can happen due to:

- Any of the above navigation mechanisms only updating the URL's fragment, e.g. `location.hash = "foo"` or clicking on `<a href="#bar">` or calling `history.back()` after either of those two actions
- `history.pushState()` and `history.replaceState()`
- `appHistory.push()` and `appHistory.update()`
- `document.open()`
- [Intercepting a cross-document navigation](#navigation-monitoring-and-interception) using the `appHistory` object's `navigate` event, and calling `event.respondWith()`

Here's a summary table:

|Trigger|Cross- vs. same-document|Fires `navigate`?|`event.userInitiated`|
|-------|------------------------|-----------------|---------------------|
|Browser UI (back/forward)|Either|No|—|
|Browser UI (non-back/forward fragment change only)|Always same|Yes|Yes|
|Browser UI (non-back/forward other)|Always cross|No|—|
|`<a>`/`<area>`|Either|Yes|Yes|
|`<form>`|Either|Yes|Yes|
|`<meta http-equiv="refresh">`|Either|Yes|No|
|`Refresh` header|Either|Yes|No|
|`window.location`|Either|Yes|No|
|`window.open(url, name)`|Either|Yes|No|
|`history.{back,forward,go}()`|Either|Yes|No|
|`history.{pushState,replaceState}()`|Always same|Yes|No|
|`appHistory.{back,forward,navigateTo}()`|Either|Yes|No|
|`appHistory.{push,update}()`|Always same|Yes|No|
|`document.open()`|Always same|Yes|No|

Some notes:

- Regarding the "No" values for the "Fires `navigate`?" column: recall that we need to disallow abusive pages from trapping the user by intercepting the back button. To get notified of such non-interceptable cases after the fact, you can use `currentchange`.

- Today it is not possible to intercept cases where other frames or windows programatically navigate your frame, e.g. via `window.open(url, name)`, or `history.back()` happening in a subframe. So, firing the `navigate` event and allowing interception in such cases represents a new capability. We believe this is OK, but will report back after some implementation experience. See also [#32](https://github.com/WICG/app-history/issues/32).

_Spec details: the above comprehensive list does not fully match when the HTML Standard's [navigate](https://html.spec.whatwg.org/#navigate) algorithm is called. In particular, HTML does not handle non-fragment-related same-document navigations through the navigate algorithm; instead it uses the [URL and history update steps](https://html.spec.whatwg.org/#url-and-history-update-steps) for those. Also, HTML calls the navigate algorithm for the initial loads of new browsing contexts as they transition from the initial `about:blank`; our current thinking is that `appHistory` should just not work on the initial `about:blank` so we can avoid that edge case._

## Appendix: full API surface, in Web IDL format

```webidl
partial interface Window {
  readonly attribute AppHistory appHistory;
};

[Exposed=Window]
interface AppHistory : EventTarget {
  readonly attribute AppHistoryEntry current;
  readonly attribute FrozenArray<AppHistoryEntry> entries;

  Promise<undefined> update(optional AppHistoryEntryOptions options = {});
  Promise<undefined> update(AppHistoryNavigationCallback);

  Promise<undefined> push(optional AppHistoryEntryOptions options = {});
  Promise<undefined> push(AppHistoryNavigationCallback callback);

  Promise<undefined> navigateTo(DOMString key);
  Promise<undefined> back();
  Promise<undefined> forward();

  readonly attribute EventHandler onnavigate;
  readonly attribute EventHandler onupcomingnavigate;
  readonly attribute EventHandler oncurrentchange;
};

[Exposed=Window]
interface AppHistoryEntry : EventTarget {
  readonly attribute DOMString key;
  readonly attribute USVString url;
  readonly attribute any state;

  readonly attribute EventHandler onnavigateto;
  readonly attribute EventHandler onnavigatefrom;
  readonly attribute EventHandler ondispose;
};

dictionary AppHistoryEntryOptions {
  USVString url;
  any state;
  any navigateInfo;
};

callback AppHistoryNavigationCallback = AppHistoryEntryOptions ();

[Exposed=Window]
interface AppHistoryNavigateEvent : Event {
  constructor(DOMString type, optional AppHistoryNavigateEventInit eventInit = {});

  readonly attribute boolean userInitiated;
  readonly attribute boolean sameOrigin;
  readonly attribute boolean hashChange;
  readonly attribute AppHistoryEntry destination;
  readonly attribute AbortSignal signal;
  readonly attribute FormData? formData;
  readonly attribute any info;

  undefined respondWith(Promise<undefined> newNavigationAction);
};

dictionary AppHistoryNavigateEventInit : EventInit {
  boolean userInitiated = false;
  boolean sameOrigin = false;
  boolean hashChange = false;
  required AppHistoryEntry destination;
  required AbortSignal signal;
  FormData? formData = null;
  any info = null;
};

[Exposed=Window]
interface AppHistoryUpcomingNavigateEvent : Event {
  constructor(DOMString type, optional AppHistoryUpcomingNavigateEventInit eventInit = {});

  readonly attribute AppHistoryEntry upcoming;
  readonly attribute AppHistoryEntry ongoing;
};

dictionary AppHistoryUpcomingNavigateEventInit : EventInit {
  required AppHistoryEntry upcoming;
  required AppHistoryEntry ongoing;

  undefined discardUpcoming();
};

[Exposed=Window]
interface AppHistoryCurrentChangeEvent : Event {
  constructor(DOMString type, optional AppHistorycurrentChangeEventInit eventInit = {});

  readonly attribute DOMHighResTimeStamp? startTime;
};

dictionary AppHistoryCurrentChangeEventInit : EventInit {
  DOMHighResTimeStamp? startTime = null;
};
```
