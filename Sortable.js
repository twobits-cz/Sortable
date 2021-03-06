/**!
 * Sortable
 * @author	RubaXa   <trash@rubaxa.org>
 * @license MIT
 */


(function (factory){
	"use strict";

	if( typeof define === "function" && define.amd ){
		define("Sortable", [], factory);
	}
	else if( typeof module != "undefined" && typeof module.exports != "undefined" ){
		module.exports = factory();
	}
	else {
		window["Sortable"] = factory();
	}
})(function (){
	"use strict";

	var
		  dragEl
		, ghostEl
		, rootEl
		, nextEl

		, lastEl
		, lastCSS
		, lastRect

		, activeGroup

		, tapEvt
		, touchEvt

		, expando = 'Sortable' + (new Date).getTime()

		, win = window
		, document = win.document
		, parseInt = win.parseInt
		, supportIEdnd = !!document.createElement('div').dragDrop

		, _isTouch = !!('ontouchstart' in window)
		, _silent = false

		, _createEvent = function (event/**String*/, item/**HTMLElement*/){
			var evt = document.createEvent('Event');
			evt.initEvent(event, true, true);
			evt.item = item;
			return evt;
		}

		, noop = function (){}
		, slice = [].slice

		, touchDragOverListeners = []
	;


	/**
	 * @class  Sortable
	 * @param  {HTMLElement}  el
	 * @param  {Object}  [options]
	 * @constructor
	 */
	function Sortable(el, options){
		this.el = el; // root element
		this.options = options = (options || {});


		// Defaults
		options.group = options.group || Math.random();
		options.handle = options.handle || null;
		options.draggable = options.draggable || el.children[0] && el.children[0].nodeName || (/[uo]l/i.test(el.nodeName) ? 'li' : '*');
		options.ghostClass = options.ghostClass || 'sortable-ghost';
		options.ghostInBottom = options.ghostInBottom || 5;
		options.scrollableContainer = options.scrollableContainer || null;
		options.scrollableContainerArea = options.scrollableContainerArea || 60;

		options.onAdd = _bind(this, options.onAdd || noop);
		options.onUpdate = _bind(this, options.onUpdate || noop);
		options.onRemove = _bind(this, options.onRemove || noop);


		el[expando] = options.group;


		// Bind all prevate methods
		for( var fn in this ){
			if( fn.charAt(0) === '_' ){
				this[fn] = _bind(this, this[fn]);
			}
		}


		// Bind events
		_on(el, 'add', options.onAdd);
		_on(el, 'update', options.onUpdate);
		_on(el, 'remove', options.onRemove);

		_on(el, 'mousedown', this._onTapStart);
		_on(el, 'touchstart', this._onTapStart);
		supportIEdnd && _on(el, 'selectstart', this._onTapStart);

		_on(el, 'dragover', this._onDragOver);
		_on(el, 'dragenter', this._onDragOver);

		touchDragOverListeners.push(this._onDragOver);
	}


	Sortable.prototype = {
		constructor: Sortable,


		_applyEffects: function (){
			_toggleClass(dragEl, this.options.ghostClass, true);
		},


		_onTapStart: function (evt/**TouchEvent*/){
			var
				  touch = evt.touches && evt.touches[0]
				, target = (touch || evt).target
				, options =  this.options
				, el = this.el
			;

			if( options.handle ){
				target = _closest(target, options.handle, el);
			}

			target = _closest(target, options.draggable, el);

			// IE 9 Support
			if( target && evt.type == 'selectstart' ){
				if( target.tagName != 'A' && target.tagName != 'IMG'){
					target.dragDrop();
				}
			}

			if( target && !dragEl && (target.parentNode === el) ){
				tapEvt = evt;
				target.draggable = true;


				// Disable "draggable"
				_find(target, 'a', _disableDraggable);
				_find(target, 'img', _disableDraggable);


				if( touch ){
					// Touch device support
					tapEvt = {
						  target:  target
						, clientX: touch.clientX
						, clientY: touch.clientY
					};
					this._onDragStart(tapEvt, true);
					evt.preventDefault();
				}


				_on(this.el, 'dragstart', this._onDragStart);
				_on(this.el, 'dragstart', this.options.onStart);
				_on(this.el, 'mouseup', this._onDrop);
				_on(this.el, 'dragend', this._onDrop);
				_on(this.el, 'dragend', this.options.onEnd);
				_on(document, 'dragover', _globalDragOver);


				try {
					if( document.selection ){
						document.selection.empty();
					} else {
						window.getSelection().removeAllRanges()
					}
				} catch (err){ }
			}
		},


		_emulateDragOver: function (){
			if( touchEvt ){
				_css(ghostEl, 'display', 'none');

				var
					  target = document.elementFromPoint(touchEvt.clientX, touchEvt.clientY)
					, parent = target
					, group = this.options.group
					, i = touchDragOverListeners.length
				;

				if( parent ){
					do {
						if( parent[expando] === group ){
							while( i-- ){
								touchDragOverListeners[i]({
									clientX: touchEvt.clientX,
									clientY: touchEvt.clientY,
									target: target,
									rootEl: parent
								});
							}
							break;
						}

						target = parent; // store last element
					}
					while( parent = parent.parentNode );
				}

				_css(ghostEl, 'display', '');
			}
		},


		_onTouchMoveStart: function (evt){
			this.options.onStart(evt);
			_off(document, 'touchmove', this._onTouchMoveStart);
		},


		_onTouchMove: function (evt){
			if( tapEvt ){
				var touch = evt.touches[0];
				touchEvt = touch;
				_css(ghostEl, 'webkitTransform', 'translate3d('+(touch.clientX-tapEvt.clientX)+'px,'+(touch.clientY-tapEvt.clientY)+'px,0)');
			}
		},


		_onDragStart: function (evt/**Event*/, isTouch){
			var
				  target = evt.target
				, dataTransfer = evt.dataTransfer
			;

			rootEl = this.el;
			dragEl = target;
			nextEl = target.nextSibling;
			activeGroup = this.options.group;

			if( isTouch ){
				var
					  rect = target.getBoundingClientRect()
					, css = _css(target)
					, ghostRect
				;

				ghostEl = target.cloneNode(true);

				_css(ghostEl, 'top', target.offsetTop - parseInt(css.marginTop, 10));
				_css(ghostEl, 'left', target.offsetLeft - parseInt(css.marginLeft, 10));
				_css(ghostEl, 'width', rect.width);
				_css(ghostEl, 'height', rect.height);
				_css(ghostEl, 'opacity', '0.8');
				_css(ghostEl, 'position', 'absolute');
				_css(ghostEl, 'zIndex', '100000');

				rootEl.appendChild(ghostEl);

				// Fixing dimensions.
				ghostRect = ghostEl.getBoundingClientRect();
				_css(ghostEl, 'width', rect.width*2 - ghostRect.width);
				_css(ghostEl, 'height', rect.height*2 - ghostRect.height);

				// Bind touch events
				_on(document, 'touchmove', this._onTouchMove);
				_on(document, 'touchmove', this._onTouchMoveStart);
				_on(document, 'touchend', this._onDrop);

				this._loopId = setInterval(this._emulateDragOver, 150);
			}
			else {
				dataTransfer.effectAllowed = 'move';
				dataTransfer.setData('Text', target.textContent);

				_on(document, 'drop', this._onDrop);
			}

			this._scrollInterval = Date.now();
			setTimeout(this._applyEffects);
		},

		_onDragOver: function (evt){
			if( !_silent && (activeGroup === this.options.group) && (evt.rootEl === void 0 || evt.rootEl === this.el) ){
				var
					  el = this.el
					, target = _closest(evt.target, this.options.draggable, el)
				;

				if( el.children.length === 0 || el.children[0] === ghostEl || _checkExpandoEqual(target, dragEl.parentNode) || (el === evt.target) && _ghostInBottom(el, evt, this.options.ghostInBottom) ){
					el.appendChild(dragEl);
				}
				else if( target && target !== dragEl && (target.parentNode[expando] !== void 0) ){
					if( lastEl !== target ){
						lastEl = target;
						lastCSS = _css(target);
						lastRect = target.getBoundingClientRect();
					}


					var
						  rect = lastRect
						, width = rect.right - rect.left
						, height = rect.bottom - rect.top
						, floating = /left|right|inline/.test(lastCSS.cssFloat + lastCSS.display)
						, skew = (floating ? (evt.clientX - rect.left)/width : (evt.clientY - rect.top)/height) > .5
						, isWide = (target.offsetWidth > dragEl.offsetWidth)
						, isLong = (target.offsetHeight > dragEl.offsetHeight)
						, nextSibling = target.nextSibling
						, after
					;

					_silent = true;
					setTimeout(_unsilent, 30);

					if( floating ){
						after = (target.previousElementSibling === dragEl) && !isWide || (skew > .5) && isWide
					} else {
						after = (target.nextElementSibling !== dragEl) && !isLong || (skew > .5) && isLong;
						//WAS FIXED BY TH TO after = false;
					}

					if( after && !nextSibling ){
						el.appendChild(dragEl);
					} else {
						try {
							target.parentNode.insertBefore(dragEl, after ? nextSibling : target);
						} catch (e) {
							// thrown when you try to put node into nasted group
						}
					}
				}

				this._detectScroll(evt);
			}
		},

		_detectScroll: function (event){
			if (this.options.onDrag) {
				this.options.onDrag(event);
			}
			if (!this.options.scrollableContainer) {
				return;
			}

			if (Date.now() < this._scrollInterval + 250) {
				return;
			}
			this._scrollInterval = Date.now();

			var container = this.options.scrollableContainer,
				scrollTopFrom = container.getBoundingClientRect().top + this.options.scrollableContainerArea, // holder's top position
				scrollBottomFrom = container.getBoundingClientRect().top + container.clientHeight - this.options.scrollableContainerArea - 60; // must subtract trash height (60px)

			if (_isTouch) {
				// Scroll to bottom
				if (touchEvt.clientY > scrollBottomFrom) {
					if (container.scrollHeight == container.scrollTop + container.clientHeight) {
						return;
					}
					_scrollTo(container, 100, 200);
					tapEvt.clientY -= 100;
					_css(ghostEl, 'webkitTransform', 'translate3d('+(touch.clientX-tapEvt.clientX)+'px,'+(touch.clientY-tapEvt.clientY)+'px,0)');

				// Scroll to top
				} else if (touchEvt.clientY < scrollTopFrom) {
					if (container.scrollTop == 0) {
						return;
					}
					_scrollTo(container, -100, 200);
					tapEvt.clientY += 100;
					_css(ghostEl, 'webkitTransform', 'translate3d('+(touch.clientX-tapEvt.clientX)+'px,'+(touch.clientY-tapEvt.clientY)+'px,0)');
				}
			} else {
				// Scroll to bottom
				if (event.clientY > scrollBottomFrom) {
					_scrollTo(container, 100, 200);

				// Scroll to top
				} else if (event.clientY < scrollTopFrom) {
					_scrollTo(container, -100, 200);
				}
			}
		},

		_onDrop: function (evt/**Event*/){
			if (this.options.onEnd) {
				this.options.onEnd(evt);
			}
			clearInterval(this._loopId);

			// Unbind events
			_off(document, 'drop', this._onDrop);
			_off(document, 'dragover', _globalDragOver);

			_off(this.el, 'mouseup', this._onDrop);
			_off(this.el, 'dragend', this._onDrop);
			_off(this.el, 'dragend', this.options.onEnd);
			_off(this.el, 'dragstart', this._onDragStart);
			_off(this.el, 'dragstart', this.options.onStart);
			_off(this.el, 'selectstart', this._onTapStart);


			_off(document, 'touchmove', this._onTouchMove);
			_off(document, 'touchend', this._onDrop);


			if( evt ){
				evt.preventDefault();
				evt.stopPropagation();

				if( ghostEl ){
					ghostEl.parentNode.removeChild(ghostEl);
				}

				if( dragEl ){
					_disableDraggable(dragEl);
					_toggleClass(dragEl, this.options.ghostClass, false);

					if( !rootEl.contains(dragEl) ){
						// Remove event
						rootEl.dispatchEvent(_createEvent('remove', dragEl));

						// Add event
						dragEl.dispatchEvent(_createEvent('add', dragEl));
					}
					else if( dragEl.nextSibling !== nextEl ){
						// Update event
						dragEl.dispatchEvent(_createEvent('update', dragEl));
					}
				}

				// Set NULL
				rootEl =
				dragEl =
				ghostEl =
				nextEl =

				tapEvt =
				touchEvt =

				lastEl =
				lastCSS =

				activeGroup = null;
			}
		},


		destroy: function (){
			var el = this.el, options = this.options;

			_off(el, 'add', options.onAdd);
			_off(el, 'update', options.onUpdate);
			_off(el, 'remove', options.onRemove);

			_off(el, 'mousedown', this._onTapStart);
			_off(el, 'touchstart', this._onTapStart);
			_off(el, 'selectstart', this._onTapStart);

			_off(el, 'dragover', this._onDragOver);
			_off(el, 'dragenter', this._onDragOver);

			//remove draggable attributes
			Array.prototype.forEach.call(el.querySelectorAll('[draggable]'), function(el) {
				el.removeAttribute('draggable');
			});

			touchDragOverListeners.splice(touchDragOverListeners.indexOf(this._onDragOver), 1);

			this._onDrop();

			this.el = null;
		}
	};


	function _bind(ctx, fn){
		var args = slice.call(arguments, 2);
		return	fn.bind ? fn.bind.apply(fn, [ctx].concat(args)) : function (){
			return fn.apply(ctx, args.concat(slice.call(arguments)));
		};
	}


	function _closest(el, selector, ctx){
		if( selector === '*' ){
			return el;
		}
		else if( el ){
			ctx = ctx || document;
			selector = selector.split('.');

			var
				  tag = selector.shift().toUpperCase()
				, re = new RegExp('\\s('+selector.join('|')+')\\s', 'g')
				, className
			;

			do {
				className = el.className;

				if (className && className.baseVal) { // SVG
					className = className.baseVal;
				}

				if(
					   (tag === '' || el.nodeName == tag)
					&& (!selector.length || ((' '+className+' ').match(re) || []).length == selector.length)
				){
					return	el;
				}
			}
			while( el !== ctx && (el = el.parentNode) );
		}

		return	null;
	}


	function _globalDragOver(evt){
		evt.dataTransfer.dropEffect = 'move';
		evt.preventDefault();
	}


	function _on(el, event, fn){
		el.addEventListener(event, fn, false);
	}


	function _off(el, event, fn){
		el.removeEventListener(event, fn, false);
	}


	function _toggleClass(el, name, state){
		if( el ){
			if( el.classList ){
				el.classList[state ? 'add' : 'remove'](name);
			}
			else {
				var className = (' '+el.className+' ').replace(/\s+/g, ' ').replace(' '+name+' ', '');
				el.className = className + (state ? ' '+name : '')
			}
		}
	}


	function _css(el, prop, val){
		if( el && el.style ){
			if( val === void 0 ){
				if( document.defaultView && document.defaultView.getComputedStyle ){
					val = document.defaultView.getComputedStyle(el, '');
				}
				else if( el.currentStyle ){
					val	= el.currentStyle;
				}
				return	prop === void 0 ? val : val[prop];
			} else {
				el.style[prop] = val + (typeof val === 'string' ? '' : 'px');
			}
		}
	}


	function _find(ctx, tagName, iterator){
		if( ctx ){
			var list = ctx.getElementsByTagName(tagName), i = 0, n = list.length;
			if( iterator ){
				for( ; i < n; i++ ){
					iterator(list[i], i);
				}
			}
			return	list;
		}
		return	[];
	}


	function _disableDraggable(el){
		return el.draggable = false;
	}


	function _unsilent(){
		_silent = false;
	}

	function _scrollTo(element, difference, duration) {
		if (duration <= 0) {
			return;
		}
		var stepDuration = 10,
			steps = (duration / stepDuration),
			stepChange = difference / steps;

		_scrollToTick(element, steps, stepDuration, stepChange);
	}

	function _scrollToTick(element, steps, stepDuration, stepChange) {
		if (steps == 0) {
			return;
		}
		setTimeout(function() {
			element.scrollTop += stepChange;
			_scrollToTick(element, steps - 1, stepDuration, stepChange);
		}, stepDuration);
	}


	function _ghostInBottom(el, evt, delta){
		var last = el.lastElementChild.getBoundingClientRect();
		return evt.clientY - (last.top + last.height) > delta; // min delta
	}

	function _checkExpandoEqual(elm1, elm2 ) {
		return typeof elm1 == "object"
			&& elm1 != null
			&& typeof elm2 == "object"
			&& elm2 != null
			&& typeof elm1[expando] == "string"
			&& elm1[expando] === elm2[expando];
	};


	// Export utils
	Sortable.utils = {
		on: _on,
		off: _off,
		css: _css,
		find: _find,
		bind: _bind,
		closest: _closest,
		toggleClass: _toggleClass,
		checkExpandoEqual: _checkExpandoEqual
	};


	Sortable.version = '0.1.9';

	// Export
	return	Sortable;
});
