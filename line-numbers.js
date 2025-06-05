//! <line-numbers>
const css = String.raw;

function getObtrusiveScrollbarSize() {
	let [w, h] = [40, 40];
	let d = document;
	let parent = d.createElement("div");
	parent.setAttribute("style", `width:${w}px;height:${h}px;overflow:auto;`);
	let child = d.createElement("div");
	child.setAttribute("style", `width:${w+10}px;height:${h+10}px;`);
	parent.appendChild(child);
	d.body.appendChild(parent);
	let dims = [w - parent.clientWidth, h - parent.clientHeight];
	parent.remove();
	return dims;
}

class Numbers extends HTMLElement {
	#positionPause = false;
	#target;
	#scrollTarget;

	static attrs = {
		targetSelector: "target",
		scrollTargetSelector: "scroll-target",
		startIndex: "start",
		obtrusive: "obtrusive",
	}
	static classes = {
		target: "uln-target",
	}
	static tagName = "line-numbers";

	static define(registry = window.customElements) {
		if(!registry.get(this.tagName)) {
			registry.define(this.tagName, this);
		}
	}

	static style = css`
${this.tagName} > :first-child {
	display: block;
  max-width: 100%;
}
${this.tagName} .${this.classes.target} {
	margin: 0;
	/* Warning: does not handle wrapping long lines */
	white-space: nowrap;
}
${this.tagName} pre.${this.classes.target} {
	/* Warning: does not handle wrapping long lines */
	white-space: pre;
}
`;
	static globalStyleAdded = false;

	static shadowStyle = css`
:host {
	display: flex;
	position: relative;
}
.lines {
	position: absolute;
	left: 0;
	top: calc(-1 * var(--uln-top, 0px));
	height: 100%;
	translate: -100% 0;
	clip-path: inset(var(--uln-top) 0 calc(-1 * var(--uln-top, 0px) + var(--uln-scrollbar-height, 0px)) 0);
	pointer-events: none;
	border-radius: var(--uln-border-radius);
	font: var(--uln-font, inherit);
	color: var(--uln-color);
	padding: 0 var(--uln-padding, .75em);
	margin: 0;
	line-height: 1lh;
	list-style: none;
	list-style-position: inside;
	counter-reset: decimal-without-dot var(--uln-number-start, 0);
	font-variant-numeric: tabular-nums;
}
:host([obtrusive]) .lines {
	position: relative;
	height: var(--uln-height, auto);
	translate: 0;
}
.lines li {
	text-align: right;
	counter-increment: decimal-without-dot;
}
.lines li:before {
	content: counter(decimal-without-dot, var(--uln-number-type, decimal));
}
`;

	get targetEl() {
		if(!this.#target) {
			let targetSelector = this.getAttribute(Numbers.attrs.targetSelector);
			let target = this.querySelector(targetSelector || ":scope > :first-child");
			target.classList.add(Numbers.classes.target);
			this.#target = target;
		}
		return this.#target;
	}

	get scrollTargetEl() {
		if(!this.#scrollTarget) {
			let scrollTargetSelector = this.getAttribute(Numbers.attrs.scrollTargetSelector);
			if(scrollTargetSelector) {
				this.#scrollTarget = this.querySelector(scrollTargetSelector);
			}
		}
		return this.#scrollTarget || this.targetEl;
	}

	get linesEl() {
		return this.shadowRoot.querySelector(".lines")
	}

	static isTextarea(el) {
		return el.tagName === "TEXTAREA";
	}

	static shouldWatchInput(el) {
		return this.isTextarea(el); // || el.isContentEditable;
	}

	getSourceContent() {
		if(Numbers.isTextarea(this.targetEl)) {
			return this.targetEl.value;
		}
		return this.targetEl.innerText;
	}

	setupLines() {
		let lines = this.getSourceContent().split("\n");
		if(this.linesEl.childElementCount !== lines.length) {
			this.linesEl.innerHTML = lines.map(noop => "<li></li>").join("");
		}
	}

	positionLines(opts = {}) {
		let { force, updateScrollbarHeight, overflowType } = Object.assign({
			force: false,
			updateScrollbarHeight: false,
		}, opts);
		if(this.#positionPause && !force) {
			return;
		}
		let top = Math.max(this.scrollTargetEl.scrollTop, 0);
		this.linesEl.style.setProperty("--uln-top", top + "px");

		// only required for obtrusive
		let height = this.scrollTargetEl.offsetHeight;
		if(height) {
			this.linesEl.style.setProperty("--uln-height", height + "px");
		}

		if(updateScrollbarHeight) {
			if(!overflowType) {
				overflowType = this.getOverflowType();
			}
			if(overflowType === "horizontal" || overflowType === "both") {
				this.linesEl.style.setProperty("--uln-scrollbar-height", Numbers.scrollbarDimensions[1] + "px");
			} else {
				this.linesEl.style.removeProperty("--uln-scrollbar-height");
			}
		}
	}

	getOverflowType() {
		let target = this.scrollTargetEl;
		let isHorizontal = target?.scrollWidth > this.offsetWidth;
		let isVertical = target?.scrollHeight > this.offsetHeight;

		if(isHorizontal && isVertical) {
			return "both";
		}
		if(isHorizontal) {
			return "horizontal";
		}
		if(isVertical) {
			return "vertical";
		}
	}

	async connectedCallback() {
		if (!("replaceSync" in CSSStyleSheet.prototype) || this.shadowRoot) {
			return;
		}

		if(!Numbers.scrollbarDimensions) {
			Numbers.scrollbarDimensions = getObtrusiveScrollbarSize();
		}

		if(!Numbers.globalStyleAdded) {
			Numbers.globalStyleAdded = true;
			let sheet = new CSSStyleSheet();
			sheet.replaceSync(Numbers.style);
			document.adoptedStyleSheets.push(sheet);
		}

		let shadowroot = this.attachShadow({ mode: "open" });
		let shadowSheet = new CSSStyleSheet();
		shadowSheet.replaceSync(Numbers.shadowStyle);
		shadowroot.adoptedStyleSheets = [shadowSheet];

		let template = document.createElement("template");
		template.innerHTML = `<ol class="lines" aria-hidden="true"></ol><slot></slot>`;
		shadowroot.appendChild(template.content.cloneNode(true));

		let startIndex = parseInt(this.getAttribute(Numbers.attrs.startIndex), 10);
		if(!isNaN(startIndex)) {
			this.linesEl.style.setProperty("--uln-number-start", startIndex - 1);
		}

		this.setupLines();

		let overflowType = this.getOverflowType();
		// Obtrusive type pretends not to have overflow due to height of numbers during init
		if(this.hasAttribute(Numbers.attrs.obtrusive) || overflowType) {
			this.positionLines({
				updateScrollbarHeight: true,
				overflowType,
			});
		}

		if(Numbers.shouldWatchInput(this.targetEl)) {
			this.targetEl.addEventListener("input", async () => {
				this.#positionPause = true;
				this.setupLines();
				this.positionLines({ force: true, updateScrollbarHeight: true });
				this.#positionPause = false;
			})
		}

		if(overflowType) {
			this.scrollTargetEl.addEventListener("scroll", () => {
				this.positionLines();
			}, {
				passive: true
			});
		}
	}
}

if(!(new URL(import.meta.url)).searchParams.has("nodefine")) {
	Numbers.define();
}
