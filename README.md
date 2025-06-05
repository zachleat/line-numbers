# Unencumbered Line Numbers

- ✅ `<textarea>` supported (even when adding or removing lines)
- ✅ `<pre>` supported
- ✅ CSS `overflow` supported
- ✅ Numbers are excluded from content flow (not selectable, important in copy paste)
- ✅ Obtrusive and nonobtrusive scrollbars supported
- ✅ Use _any_ [CSS counter style](https://developer.mozilla.org/en-US/docs/Web/CSS/counter#counter-style) via `--uln-number-type`
- ✅ Change the starting index for counter
- ✅ Numbers are unobtrusive by default to reduce layout shift (opt-in to obtrusive behavior via `<line-numbers obtrusive>`)

## Limitations

Trying to keep this one as simple as possible, so please note the following:

- Line wrapping is **not** supported (`white-space: pre` or `white-space: nowrap` only, enforced by the component)
- CSS `contenteditable` **not** supported