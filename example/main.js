/* global NodeList, Element, Event, define */

(function(global) {
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
    // Prebind the functions that will be bound in addEventListener and
    // removeEventListener to avoid losing references
    this._maintainFocus = this._maintainFocus.bind(this);
    this._bindKeypress = this._bindKeypress.bind(this);

    // Keep a reference of the node and the actual dialog on the instance
    this.container = node;
    

    //inject HTML to iframe
    this.iframe = document.getElementById("iframe");

    // Keep an object of listener types mapped to callback functions
    this._listeners = {};

    // Initialise everything needed for the dialog to work properly
    this.create(targets);
  }

  /**
   * Set up everything necessary for the dialog to be functioning
   *
   * @param {(NodeList | Element | string)} targets
   * @return {this}
   */
  A11yDialog.prototype.create = function(targets) {
    // Keep a collection of nodes to disable/enable when toggling the dialog
    this._targets =
      this._targets || collect(targets) || getSiblings(this.container);

    // Set the `shown` property to match the status from the DOM
    this.shown = this.iframe.hasAttribute('open');

    this.iframe.style.visibility = 'collapse';
    console.log("this.iframe:", this.iframe);
    // Keep a collection of dialog openers, each of which will be bound a click
    // event listener to open the dialog
    this._openers = $$('[data-a11y-dialog-show="' + this.container.id + '"]');
    this._openers.forEach(
      function(opener) {
        opener.addEventListener('click', this._show);
      }.bind(this)
    );

    // Keep a collection of dialog closers, each of which will be bound a click
    // event listener to close the dialog
    this._closers = $$('[data-a11y-dialog-hide]', this.container).concat(
      $$('[data-a11y-dialog-hide="' + this.container.id + '"]')
    ).concat(
      $$('[data-a11y-dialog-hide]', this.iframe.contentWindow.document.body)
    );
    this._closers.forEach(
      function(closer) {
        closer.addEventListener('click', this._hide);
      }.bind(this)
    );

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
  A11yDialog.prototype.show = function(event) {
    // If the dialog is already open, abort
    if (this.shown) {
      return this;
    }

    this.shown = true;

    // Keep a reference to the currently focused element to be able to restore
    // it later
    focusedBeforeDialog = document.activeElement;
    this.container.setAttribute('open', '');
    this.iframe.style.visibility = 'visible';
    this.container.removeAttribute('aria-hidden');

    // Iterate over the targets to disable them by setting their `aria-hidden`
    // attribute to `true`
    this._targets.forEach(function(target) {
      target.setAttribute('aria-hidden', 'true');
    });

    //Set focus on container
    // console.log("IFRAME BODY: ", this.iframe.contentWindow.document.body);
    this.iframe.focus();

    // Bind a focus event listener to the body element to make sure the focus
    // stays trapped inside the dialog while open, and start listening for some
    // specific key presses (TAB and ESC)
    document.body.addEventListener('focus', this._maintainFocus, true);
    document.addEventListener('keydown', this._bindKeypress);

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
  A11yDialog.prototype.hide = function(event) {
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
    this._targets.forEach(function(target) {
      target.removeAttribute('aria-hidden');
    });

    // If their was a focused element before the dialog was opened, restore the
    // focus back to it
    if (focusedBeforeDialog) {
      focusedBeforeDialog.focus();
    }

    // Remove the focus event listener to the body element and stop listening
    // for specific key presses
    document.body.removeEventListener('focus', this._maintainFocus, true);
    document.removeEventListener('keydown', this._bindKeypress);

    return this;
  };

  /**
   * Private event handler used when listening to some specific key presses
   * (namely ESCAPE and TAB)
   *
   * @access private
   * @param {Event} event
   */
  A11yDialog.prototype._bindKeypress = function(event) {
    // If the dialog is shown and the ESCAPE key is being pressed, prevent any
    // further effects from the ESCAPE key and hide the dialog, unless its role
    // is 'alertdialog', which should be modal
    if (this.shown && event.which === ESCAPE_KEY) {
      event.preventDefault();
      this.hide();
    }

    // If the dialog is shown and the TAB key is being pressed, make sure the
    // focus stays trapped within the dialog element
    if (this.shown && event.which === TAB_KEY) {
      trapTabKey(this.iframe, event);
    }
  };

  /**
   * Private event handler used when making sure the focus stays within the
   * currently open dialog
   *
   * @access private
   * @param {Event} event
   */
  A11yDialog.prototype._maintainFocus = function(event) {
    // If the dialog is shown and the focus is not within the dialog element,
    // move it back to its first focusable child
    if (this.shown && !this.container.contains(event.target)) {
      setFocusToFirstItem(this.iframe);
    }
  };

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

  /**
   * Set the focus to the first element with `autofocus` or the first focusable
   * child of the given element
   *
   * @param {Element} node
   */
  function setFocusToFirstItem(node) {
    var focusableChildren = getFocusableChildren(node);
    var focused = node.querySelector('[autofocus]') || focusableChildren[0];

    if (focused) {
      focused.focus();
    }
  }

  /**
   * Get the focusable children of the given element
   *
   * @param {Element} node
   * @return {Array<Element>}
   */
  function getFocusableChildren(node) {
    console.log("NODE: ", node);
    return $$(FOCUSABLE_ELEMENTS.join(','), node).filter(function(child) {
      return !!(
        child.offsetWidth ||
        child.offsetHeight ||
        child.getClientRects().length
      );
    });
  }

  /**
   * Trap the focus inside the given element
   *
   * @param {Element} node
   * @param {Event} event
   */
  function trapTabKey(node, event) {
    var focusableChildren = getFocusableChildren(node);
    var focusedItemIndex = focusableChildren.indexOf(document.activeElement);

    // If the SHIFT key is being pressed while tabbing (moving backwards) and
    // the currently focused item is the first one, move the focus to the last
    // focusable item from the dialog element
    if (event.shiftKey && focusedItemIndex === 0) {
      focusableChildren[focusableChildren.length - 1].focus();
      event.preventDefault();
      // If the SHIFT key is not being pressed (moving forwards) and the currently
      // focused item is the last one, move the focus to the first focusable item
      // from the dialog element
    } else if (
      !event.shiftKey &&
      focusedItemIndex === focusableChildren.length - 1
    ) {
      focusableChildren[0].focus();
      event.preventDefault();
    }
  }

  /**
   * Retrieve siblings from given element
   *
   * @param {Element} node
   * @return {Array<Element>}
   */
  function getSiblings(node) {
    var nodes = toArray(node.parentNode.childNodes);
    var siblings = nodes.filter(function(node) {
      return node.nodeType === 1;
    });

    siblings.splice(siblings.indexOf(node), 1);

    return siblings;
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = A11yDialog;
  } else if (typeof define === 'function' && define.amd) {
    define('A11yDialog', [], function() {
      return A11yDialog;
    });
  } else if (typeof global === 'object') {
    global.A11yDialog = A11yDialog;
  }
})(typeof global !== 'undefined' ? global : window);
