// Single gettext store shared by every module.
//
// Each module used to declare its own `_` (an identity fallback) plus an
// `init()` that swapped it for the extension's gettext. That meant extension.ts
// had to hand gettext to all of them or their strings silently stayed in
// English. They now import `_` from here, so one `init()` call is enough.
//
// `_` is exported as a live binding: consumers importing it see the gettext
// function assigned by init().
export let _ = (s: string) => s;

export function init(gettextFunc: (s: string) => string) {
    _ = gettextFunc;
}
