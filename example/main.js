/* global NodeList, Element, Event, define */

(function (global) {
  'use strict';

  var FOCUSABLE_ELEMENTS = [
    'a[href]:not([tabindex^="-"]):not([inert])',
    'area[href]:not([tabindex^="-"]):not([inert])',
    'input:not([disabled]):not([inert])',
    'select:not([disabled]):not([inert])',
    'textarea:not([disabled]):not([inert])',
    'button:not([disabled]):not([inert])',
    'iframe',
    // 'iframe:not([tabindex^="-"]):not([inert])',
    'audio:not([tabindex^="-"]):not([inert])',
    'video:not([tabindex^="-"]):not([inert])',
    '[contenteditable]:not([tabindex^="-"]):not([inert])',
    '[tabindex]:not([tabindex^="-"]):not([inert])'
  ];

  var IFRAME_ORIGIN = 'http://kmv.google.com:8000';
  var TAB_KEY = 9;
  var ESCAPE_KEY = 27;
  var focusedBeforeDialog;

  /**
   * Define the constructor to instantiate a dialog
   *
   * @constructor
   * @param {Element} node
   * @param {(NodeList | Element | string)} targets
   */
  function A11yDialog(node, targets) {
    this._show = this.show.bind(this);
    this._hide = this.hide.bind(this);
    this.hide = this.hide.bind(this);

    this._maintainFocus = this._maintainFocus.bind(this);

    // Keep a reference of the node and the actual dialog on the instance
    this.container = node;


    //inject HTML to iframe
    this.iframe = document.getElementById("iframe");

    // Initialise everything needed for the dialog to work properly
    this.create(targets);
  }

  /**
   * Set up everything necessary for the dialog to be functioning
   *
   * @param {(NodeList | Element | string)} targets
   * @return {this}
   */
  A11yDialog.prototype.create = function (targets) {
    // Keep a collection of nodes to disable/enable when toggling the dialog
    this._targets = collect(targets);

    // Set the `shown` property to match the status from the DOM
    this.shown = this.iframe.hasAttribute('open');

    this.iframe.style.visibility = 'collapse';

    // Keep a collection of dialog openers, each of which will be bound a click
    // event listener to open the dialog
    this._openers = $$('[data-a11y-dialog-show="' + this.container.id + '"]');
    this._openers.forEach(
      function (opener) {
        opener.addEventListener('click', this._show);
      }.bind(this)
    );

    window.addEventListener('message', (e) => {
      if (e.origin !== IFRAME_ORIGIN) {
        return;
      }
      this[e.data.type]();
    })

    return this;
  };

  /**
   * Show the dialog element, disable all the targets (siblings), trap the
   * current focus within it, listen for some specific key presses and fire all
   * registered callbacks for `show` event
   *
   * @param {Event} event
   * @return {this}
   */
  A11yDialog.prototype.show = function (event) {
    // If the dialog is already open, abort
    if (this.shown) {
      return this;
    }

    this.shown = true;

    // Keep a reference to the currently focused element to be able to restore
    // it later
    focusedBeforeDialog = document.activeElement;
    this.iframe.style.visibility = 'visible';
    this.container.setAttribute('open', '');
    this.container.setAttribute('aria-hidden', 'false');

    // Iterate over the targets to disable them by setting their `aria-hidden`
    // attribute to `true`
    this._targets.forEach(function (target) {
      target.setAttribute('aria-hidden', 'true');
    });

    this.iframe.contentWindow.postMessage({type: 'show'}, IFRAME_ORIGIN);

    window.addEventListener('focus', this._maintainFocus, true);

    this.container.focus();

    return this;
  };

  /**
   * Hide the dialog element, enable all the targets (siblings), restore the
   * focus to the previously active element, stop listening for some specific
   * key presses and fire all registered callbacks for `hide` event
   *
   * @param {Event} event
   * @return {this}
   */
  A11yDialog.prototype.hide = function (event) {
    // If the dialog is already closed, abort
    if (!this.shown) {
      return this;
    }

    this.shown = false;


    this.container.removeAttribute('open');
    this.iframe.style.visibility = 'collapse';
    this.container.setAttribute('aria-hidden', 'true');

    // Iterate over the targets to enable them by remove their `aria-hidden`
    // attribute
    this._targets.forEach(function (target) {
      target.removeAttribute('aria-hidden');
    });

    // If their was a focused element before the dialog was opened, restore the
    // focus back to it
    if (focusedBeforeDialog) {
      focusedBeforeDialog.focus();
    }

    window.removeEventListener('focus', this._maintainFocus);

    return this;
  };

  A11yDialog.prototype._maintainFocus = function(event) {
    if (!this.shown || this.iframe.contains(document.activeElement)) {
      return;
    }
    this.container.focus();
  }

  /**
   * Convert a NodeList into an array
   *
   * @param {NodeList} collection
   * @return {Array<Element>}
   */
  function toArray(collection) {
    return Array.prototype.slice.call(collection);
  }

  /**
   * Query the DOM for nodes matching the given selector, scoped to context (or
   * the whole document)
   *
   * @param {String} selector
   * @param {Element} [context = document]
   * @return {Array<Element>}
   */
  function $$(selector, context) {
    return toArray((context || document).querySelectorAll(selector));
  }

  /**
   * Return an array of Element based on given argument (NodeList, Element or
   * string representing a selector)
   *
   * @param {(NodeList | Element | string)} target
   * @return {Array<Element>}
   */
  function collect(target) {
    if (NodeList.prototype.isPrototypeOf(target)) {
      return toArray(target);
    }

    if (Element.prototype.isPrototypeOf(target)) {
      return [target];
    }

    if (typeof target === 'string') {
      return $$(target);
    }
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = A11yDialog;
  } else if (typeof define === 'function' && define.amd) {
    define('A11yDialog', [], function () {
      return A11yDialog;
    });
  } else if (typeof global === 'object') {
    global.A11yDialog = A11yDialog;
  }
})(typeof global !== 'undefined' ? global : window);