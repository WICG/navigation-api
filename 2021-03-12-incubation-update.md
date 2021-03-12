# Incubation Update: March 12, 2021

A lot of progress has been on app history since it's initial publication and move to WICG! Here's an update.

## Prototype implementation

[@natechapin](https://github.com/natechapin) has been hard at work prototyping app history in Chromium, behind the Experimental Web Platform features flag. You can try it yourself by using the latest build of [Chrome Canary](https://www.google.com/chrome/canary/) and flipping the flag in `chrome://flags`. There's a [demo site](https://gigantic-honored-octagon.glitch.me/) which we intend to keep updating.

So far the implementation has focused on the `navigate` event and its `respondWith()` function, and especially on the complex [restrictions](./README.md#restrictions-on-firing-canceling-and-responding) on when the event fires, when it's cancelable, and when `respondWith()` can be called. Our rough plan for implementation (very subject to change!) is:

* Continue filling out properties of the `AppHistoryNavigateEvent` object (e.g. today Nate is [working on `userInitiated`](https://chromium-review.googlesource.com/c/chromium/src/+/2757310)).
* Implement accessibility technology integration.
* Implement `appHistory.entries`.
* Implement `event.destination` for `AppHistoryNavigateEvent`.
* Implement `appHistory.push()` and `appHistory.update()`.
* ... more ...

You can watch our progress by starring [Chromium bug 1183545](https://bugs.chromium.org/p/chromium/issues/detail?id=1183545). Feel free to build your own demos to experiment, although keep in mind it's very early days and some basic things like `event.destination` don't work yet!

## Specification

We have [an initial specification](https://wicg.github.io/app-history/)! It's roughly focused on the same area as the implementation, so that we can have the implementation serve as a check on the spec, and the spec serve as a check on the implementation. We expect this pattern to continue, with sometimes the spec being a bit ahead, and sometimes a bit behind.

## Design issues

We've been resolving a lot of interesting design issues by updating the explainer. Here I'll provide links to the pull requests; if you want to see the deliberations that led to those conclusions, follow the links to the issues that each PR closes.

* We realized that making all navigations async was not going to work, and instead made all `navigate`-intercepted navigations synchronous: [#46](https://github.com/WICG/app-history/pull/46).
* We further pushed toward a `navigate`-centric model by making `appHistory.push()` and `appHistory.update()` do a full-page navigation, unless `navigate` intercepts them: [#54](https://github.com/WICG/app-history/pull/54).
* A series of pull requests settled on the latest semantics for when navigations can be intercepted, and when they can be canceled: [#26](https://github.com/WICG/app-history/pull/26), [#56](https://github.com/WICG/app-history/pull/56), [#65](https://github.com/WICG/app-history/pull/65).
* The API has gotten cleaner and easier to use through some renames and tweaks: [#35](https://github.com/WICG/app-history/pull/35), [#49](https://github.com/WICG/app-history/pull/49), [#55](https://github.com/WICG/app-history/pull/55).
* We changed how state is retrieved: [#54](https://github.com/WICG/app-history/pull/54) (which was partially rolled back in [#61](https://github.com/WICG/app-history/pull/61)).
* We resolved how app history interacts with the joint session history: it is purely a layer on top of it. See [#29](https://github.com/WICG/app-history/pull/29) and especially [#29 (comment)](https://github.com/WICG/app-history/pull/29#issuecomment-777773026).

Next up is trying to resolve the following:

* [#68](https://github.com/WICG/app-history/pull/68) attempts to solve a constellation of issues around interrupted and aborted navigations.
* [#5](https://github.com/WICG/app-history/issues/5) contains good discussion about how to support the URL-rewriting case, although not yet a firm conclusion.
* [#32](https://github.com/WICG/app-history/issues/32) discusses how we can allow back button interception, specifically for the "are you sure you want to abandon this filled-out form?" case. We have [a tentative idea](https://github.com/WICG/app-history/issues/32#issuecomment-789944257) that might work.
* [#7](https://github.com/WICG/app-history/issues/7) is about the semantics of what updating or replacing an app history entry means, and how we should model that in a way that fits well with what apps need and are doing today.
* [#33](https://github.com/WICG/app-history/issues/33) and [#59](https://github.com/WICG/app-history/issues/59) note that our current design for reporting the time a single-page navigation takes does not make sense; likely we will work with [the folks maintaining other performance measurement APIs](https://www.w3.org/webperf/) to come up with a more principled alternative.

There are plenty of other open issues which have good discussion on them too, so feel free to check out [the issue tracker](https://github.com/WICG/app-history/issues) to get a more complete view.

## Thank you!

I want to close with a thank you to the community that has been so engaged and helpful, on the issue tracker and elsewhere! It's exciting to know that we've hit a chord, and are solving a problem web developers are passionate about. Keep the great feedback coming!
