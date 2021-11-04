# Incubation Update: November 4, 2021

App history is starting to achieve its final form! Read on to find out what's new since [last time](./2021-06-28-incubation-update.md).

## Prototype implementation and origin trial

The app history implementation in Chromium recently hit an important milestone. In addition to being available behind the Experimental Web Platform features flag, it is now available as an [origin trial](https://github.com/GoogleChrome/OriginTrials/blob/gh-pages/developer-guide.md)! From Chromium versions 96–99, you can add a HTTP header or `<meta>` tag to your site to try out app history in production, against real users. [Sign up and get a token](https://developer.chrome.com/origintrials/#/view_trial/2347501305766871041) if you're ready to start experimenting!

At this point we believe all of the core API is ready, giving parity with `window.history` and, due to the `dispose` event, even exceeding it. You can see an update-to-date account of our progress in the [implementation plan document](https://docs.google.com/document/d/1vmxjUzn7qccn9xwVoIKRKVEPrIstrPzztg0chlgLAMY/edit#), but to summarize the stuff that's missing as of the time of this writing:

* Stop/reload/loading spinner integration with the promises passed to `event.transitionWhile()` (in progress, but not yet landed)
* Integration with accessibility technology
* `appHistory.transition.finished` and `appHistory.transition.rollback()`
* `AppHistoryEntry` events besides `dispose`, i.e. `navigateto`, `navigatefrom`, and `finish`
* The `dispose` event for cases besides forward-pruning, e.g. when the user clears their history
* [Performance timeline integration](./README.md#performance-timeline-api-integration)

We look forward to hearing about what you can build with app history. If you're running a site that might use app history, or maintaining a router library or framework, now is a great time to play around with the API, and get in touch with any feedback.

(By the way, if you use TypeScript, we now host [TypeScript definitions for the API](https://github.com/WICG/app-history/blob/main/app_history.d.ts) in this repository!)

## Design updates

Since last time, we've made the following substantial changes:

* Added `appHistory.updateCurrent()`, for specific use cases where you need to update app history state in response to a user action: [#146](https://github.com/WICG/app-history/pull/146)
* Added back the `currentchange` event, for when `appHistory.current` changes: [#171](https://github.com/WICG/app-history/pull/171)
* Added `key`, `id`, and `index` to `navigateEvent.destination` for `"traverse"` navigations: [#131](https://github.com/WICG/app-history/pull/131)
* Changed the return values of all the navigating methods from just a promise, to a pair of `{ committed, finished }` promises: [#164](https://github.com/WICG/app-history/pull/164)
* Renamed `navigateEvent.respondWith()` and `navigateEvent.canRespond` to `transitionWhile()` and `canTransition`: [#151](https://github.com/WICG/app-history/pull/151)
* Renamed the `navigateInfo` option to just `info`: [#145](https://github.com/WICG/app-history/pull/145)
* Started firing the `navigate` event for all traversals, but making it non-cancelable for now: [#182](https://github.com/WICG/app-history/pull/182)
* Disabled most of the API for opaque-origin pages: [#169](https://github.com/WICG/app-history/pull/169)

## The road toward shipping?

As mentioned above, at this point we believe the core API is ready to experiment with, including in production evironments using origin trials or similar time-limited measures. What remains for us to do, before we could consider shipping the API?

We've collated a list of ["Might block v1"](https://github.com/WICG/app-history/milestone/1) issues on the issue tracker. Most of them are related to things that, if we changed them after shipping, could cause compatibility problems: so, we need to figure them out, and finalize the spec/implementation/tests. This includes the still-ongoing [API naming discussion](https://github.com/WICG/app-history/issues/83) 😅. If all goes well, including reviews with other browsers, it's conceivable we could solve these issues in time for Chromium 100 in March 2022.

That list is just the bare minimum, however. Based on feedback from developers and other browser vendors, a few other things are on our radar as high priority, which we might try to finish up before the initial release or at least shortly afterward:

* Updating, deleting, and rearranging non-current entries is a common developer pain point, with solid use cases: [#9](https://github.com/WICG/app-history/issues/9)
* Canceling browser UI-initiated back/forward navigations, to implement "are you sure you want to leave this page?", is technically difficult but definitely planned: see [#32](https://github.com/WICG/app-history/issues/32) and also some discussion in [#178](https://github.com/WICG/app-history/issues/178)
* Ensuring `appHistory.navigate()` has parity with `<a>` by adding download, form data, and referrer policy options, would not be hard and would round out the API nicely: [#82](https://github.com/WICG/app-history/issues/82)
* Adding an easy way to do "client-side redirects" would solve a sharp edge; you can do these with the current API but it's trickier than it should be: [#124](https://github.com/WICG/app-history/issues/124)

These and many other such ideas are under the ["addition"](https://github.com/WICG/app-history/labels/addition) label in the issue tracker. If any such additions would be especially helpful to your project, please let us know with either a thumbs-up or, better yet, a comment describing your use case.
