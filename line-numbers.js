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
		manualRender: "manual-render",
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

	static upgrade(node) {
		if(!node || node.closest(this.tagName)) {
			return;
		}

		let h = document.createElement("div");
		node.parentNode.insertBefore(h, node);

		let c = document.createElement(this.tagName);
		c.appendChild(node);
		h.replaceWith(c);
	}

	static getStyle() {
		return css`
${this.tagName} > :first-child {
	display: block;
	max-width: 100%;
}
${this.tagName} .${this.classes.target} {
	margin: 0;
	/* Warning: does not handle wrapping long lines */
	white-space: nowrap;
	white-space-collapse: preserve;
}
${this.tagName} pre.${this.classes.target} {
	/* Warning: does not handle wrapping long lines */
	white-space: pre;
}
`;
	}

	static globalStyleAdded = false;

	static getShadowStyle() {
		return css`
* {
	box-sizing: border-box;
}
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
	padding-block: var(--uln-padding-v, 0px);
	padding-inline: var(--uln-padding-h, .75em);
	margin: 0;
	line-height: var(--uln-lh, 1lh);
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
	}

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
		if(height || updateScrollbarHeight) {
			if(!overflowType) {
				overflowType = this.getOverflowType();
			}
		}
		if(height) {
			if(overflowType) {
				// TODO start here, disallow vertical overflow type here
				this.linesEl.style.setProperty("--uln-height", height + "px");
			} else {
				this.linesEl.style.removeProperty("--uln-height");
			}
		}

		if(updateScrollbarHeight) {
			if(overflowType === "horizontal" || overflowType === "both") {
				this.style.setProperty("--uln-scrollbar-height", Numbers.scrollbarDimensions[1] + "px");
			} else {
				this.style.removeProperty("--uln-scrollbar-height");
			}
		}
	}

	isObtrusive() {
		return this.hasAttribute(Numbers.attrs.obtrusive);
	}

	getOverflowType() {
		let target = this.scrollTargetEl;
		let isObtrusive = this.isObtrusive();

		if(isObtrusive) {
			this.linesEl.style.display = "none";
		}

		let isHorizontal = target?.scrollWidth > this.offsetWidth;
		let isVertical = target?.scrollHeight > this.offsetHeight;

		if(isObtrusive) {
			this.linesEl.style.display = "";
		}

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
			sheet.replaceSync(Numbers.getStyle());
			document.adoptedStyleSheets.push(sheet);
		}

		let shadowroot = this.attachShadow({ mode: "open" });
		let shadowSheet = new CSSStyleSheet();
		shadowSheet.replaceSync(Numbers.getShadowStyle());
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
		if(this.isObtrusive() || overflowType) {
			this.positionLines({
				updateScrollbarHeight: true,
				overflowType,
			});
		}

		if(Numbers.shouldWatchInput(this.targetEl) && !this.hasAttribute(Numbers.attrs.manualRender)) {
			this.targetEl.addEventListener("input", async () => {
				this.#positionPause = true;
				this.setupLines();
				this.positionLines({ force: true, updateScrollbarHeight: true });
				this.#positionPause = false;
			})
		}

		this.scrollTargetEl.addEventListener("scroll", () => {
			this.positionLines();
		}, {
			passive: true
		});
	}

	render() {
		this.setupLines();
		this.positionLines({ force: true, updateScrollbarHeight: true });
	}
}

if(!(new URL(import.meta.url)).searchParams.has("nodefine")) {
	Numbers.define();
}
