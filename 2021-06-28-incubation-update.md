# Incubation Update: June 28, 2021

App history is happening! 🥳🥳🥳 Read on to find out what's new since [last time](./2021-03-12-incubation-update.md).

## Prototype implementation

We continue to prototype app history in Chromium, behind the Experimental Web Platform features flag. You can try it yourself by using the latest build of [Chrome Canary](https://www.google.com/chrome/canary/) and flipping the flag in `chrome://flags`.

And as of today, we feel that we've reached a milestone where people can seriously experiment with app history, and try to prototype real apps and libraries! We've implemented the core features of the proposal: introspection into the app history list, conversion of cross-document navigations into same-document navigations, and the `appHistory.navigate()` API. You can check out the following demos to see these in action:

* [Basic SPA nav demo](https://gigantic-honored-octagon.glitch.me/)
* [Form data handling demo](https://selective-heliotrope-dumpling.glitch.me/)

(Note that unlike the last time you saw those demos, now [the back button works](https://bugs.chromium.org/p/chromium/issues/detail?id=1186299).)

At this point it's easier to list what we haven't implemented, than what we have. The following APIs from the explainer are not yet in Chromium:

* `appHistory.reload()`
* `appHistory.transition`
* `appHistoryNavigateEvent.navigationType`
* `appHistoryNavigateEvent.signal`, and stop button integration
* Integration of `navigate` events with accessibility technology
* `appHistoryEntry` events
* [Performance timeline integration](./README.md##performance-timeline-api-integration)

Additionally, we have a number of open issues about updating to the exact spec semantics, especially in edge cases. Follow our progress in [Chromium bug 1183545](https://bugs.chromium.org/p/chromium/issues/detail?id=1183545) and its BlockedOn issues!

## Specification and tests

The [specification](https://wicg.github.io/app-history/) continues to mostly track the prototype implementation. However, [specifying `goTo()`/`back()`/`forward()`](https://github.com/WICG/app-history/pull/109) is proving tricky, due to [shaky spec foundations](https://github.com/whatwg/html/issues/5767) around history traversal in general. We're taking care to stabilize the foundations beforehand, before building new features on top of them.

We also [fixed an issue with the base navigation spec](https://github.com/whatwg/html/pull/6714) which was preventing us from confidently upstreaming our tests, since until recently the tests technically did not match the HTML spec. Now our tests are [headed to the web platform tests repository](https://chromium-review.googlesource.com/c/chromium/src/+/2991902), to better enable sharing with other browser vendors and with polyfill authors.

## Design issues

Since [last time](./2021-03-12-incubation-update.md#design-issues), the substantial design changes worth noting include:

* Specifying that any new navigation will interrupt an ongoing one, including firing `abort` on its `event.signal` property: [#68](https://github.com/WICG/app-history/pull/68)
* Adding `appHistoryEntry.id` alongside `appHistoryEntry.key`: [#88](https://github.com/WICG/app-history/pull/88)
* Renaming `appHistory.navigateTo()` to `appHistory.goTo()`, and combined `appHistory.push()` and `appHistory.update()` into `appHistory.navigate()`, both based on feedback from Mozilla: [#84](https://github.com/WICG/app-history/pull/84)
* Subsequently splitting out `appHistory.reload()` from `appHistory.navigate()`: [#118](https://github.com/WICG/app-history/pull/118)
* Introducing performance timeline API integration to replace the `currentchange` event: [#125](https://github.com/WICG/app-history/pull/125)
* Allowing multiple calls to `appHistoryNavigateEvent.respondWith()`: [#126](https://github.com/WICG/app-history/pull/126)

We still haven't settled on solutions for [URL-rewriting use cases](https://github.com/WICG/app-history/issues/5) or [back-button prevention](https://github.com/WICG/app-history/issues/32), but they remain on our radar. And the [naming discussion](https://github.com/WICG/app-history/issues/83) for the whole API continues; we were [considering](https://github.com/WICG/app-history/issues/83#issuecomment-839901780) renaming the API to `window.navigation`—Mozilla is especially enthusiastic—but haven't pulled the trigger yet due to concerns about it being confusing with `window.navigator`.

New design issues which have cropped up include:

* Since `appHistoryNavigateEvent.respondWith()`'s semantics have changed, the `respondWith()` name is no longer very good: [#94](https://github.com/WICG/app-history/issues/94#issuecomment-854929003)
* How should `someOtherWindow.appHistory.navigate()`'s returned promise behave? [#95](https://github.com/WICG/app-history/issues/95)
* `appHistoryNavigateEvent.destination` currently contains only `url`, `sameDocument`, and `getState()`. Are there use cases for more? [#97](https://github.com/WICG/app-history/issues/97)
* How should `appHistory.navigate(currentURL, { replace: false })` behave? [#111](https://github.com/WICG/app-history/issues/111)
* Should we expand the definition of `appHistoryNavigateEvent.userInitiated`? [#127](https://github.com/WICG/app-history/issues/127)

Finally, we're contemplating the following additions based on what we've seen so far:

* [#101](https://github.com/WICG/app-history/issues/101) is about allowing more powerful `<a>` navigations, e.g. `<a href="..." navigateinfo="..." replace>` or maybe even `<a key="an app history key">`.
* [#115](https://github.com/WICG/app-history/issues/115) claims that we probably need to introduce the ability to modify an `AppHistoryEntry`'s state, even without performing an intercepted navigation.
* [#124](https://github.com/WICG/app-history/issues/124) discusses introducing a more first-class API for single-page app "redirects".

Note that these days we're maintaining a [feedback wanted](https://github.com/WICG/app-history/labels/feedback%20wanted) label, which lists all the issues where community feedback would be especially helpful.

## Go forth and prototype

We've reached a new stage in the app history proposal, where we've got the core API implemented and now need to validate that it works for real apps and libraries. If you work on a router or history library, or a framework that manages those aspects, consider spinning up a branch to test out whether app history will help your users. Even if you don't want to fully buy into the [`navigate` event lifestyle](./README.md#using-navigate-handlers), consider sprinkling in a few uses of `appHistory.entries()`, using app history state instead of `history.state`, or enabling new experiences like [making your in-page back button sync with the session history](./README.md#sample-code).

Similarly, if you have a hobby application, consider trying to use app history API directly so you can give us feedback. What works well? What works poorly? What's missing? Did you gain a new perspective on any of the [feedback wanted](https://github.com/WICG/app-history/labels/feedback%20wanted) issues?

In all such cases, the [polyfill](https://github.com/frehner/appHistory) might be helpful. The author, [@frehner](https://github.com/frehner), has been heavily involved in the app history repository, and although at this stage we can't guarantee it always matches the spec or Chromium behavior, as the spec and implementation firm up we do plan to collaborate more closely with @frehner on the polyfill to make it production-ready.
