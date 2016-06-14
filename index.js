/* global Promise:false, define:false, module:false */

'use strict'

var shortid = require('shortid')
var defer = require('mini-defer')

// Proxy references for testing
var self = self || {}
var MessageChannel = self.MessageChannel

if (typeof define === 'function' && define.amd) {
  define('msgr', function () { return msgr })
} else if (typeof module === 'object' && module.exports) {
  module.exports = msgr
} else {
  self.msgr = msgr
}

/**
 * Initialise a client or worker to send and receive messages.
 * @param {Object} messageHandlers
 * @param {ServiceWorkerRegistration} worker
 * @returns {Channel}
 */
function msgr (messageHandlers, worker) {
  return new Channel(messageHandlers, worker)
}

/**
 * Initialise a worker to send and receive messages to and from the client.
 * @param {Object} messageHandlers
 * @returns {Channel}
 */
msgr.worker = function (messageHandlers) {
  return msgr(messageHandlers, null)
}

/**
 * Initialise a client to send and receive messages to and from the worker.
 * @param {ServiceWorkerRegistration} worker
 * @param {Object} messageHandlers
 * @returns {Channel}
 */
msgr.client = function (worker, messageHandlers, __mockMessageChannel) {
  MessageChannel = __mockMessageChannel || MessageChannel
  return msgr(messageHandlers, worker)
}

// Reserved message types
msgr.types = {
  CONNECT: '@@MSGR/CONNECT',
  UNKNOWN: '@@MSGR/UNKNOWN',
  RESPONSE: '@@MSGR/RESPONSE'
}

// ---
// App
// ---

function Channel (handlers, worker) {
  this.handlers = handlers
  this.isClient = Boolean(worker)
  this.isWorker = !this.isClient

  // Is the comms channel open?
  this.open = defer()

  // Handlers for unknown message types
  this.receiveHandlers = []

  // ID/response handlers use for handling `responds()`s
  // key = id string, value = function
  this.responseHandlers = {}

  if (this.isClient) {
    this.open.resolve()
    this.recipient = worker
    this.messageChannel = new MessageChannel()
    this.messageChannel.port1.onmessage = this._handleMessage.bind(this)
    this.send(msgr.types.CONNECT, 'connect')
  } else {
    self.onmessage = this._handleMessage.bind(this)
  }
}

/**
 * Handle a message received from the client or worker.
 * @param {Object} event
 * @private
 */
Channel.prototype._handleMessage = function (event) {
  try {
    var request = JSON.parse(event.data)
    var id = request.id
  } catch (err) {
    throw new Error('msgr: ignoring malformed message')
  }

  var responder = function (data) {
    this.send(msgr.types.RESPONSE, data, id)
  }.bind(this)

  if (this.isWorker && request.type === msgr.types.CONNECT) {
    // Special init message type that gives us the port
    // that we will be sending messages to the client over
    this.recipient = event.ports[0]
    this.open.resolve()
  }

  if (request.type in this.handlers) {
    // Known message type, invoke registered handler
    this.handlers[request.type](request.data, responder)
  } else if (id && id in this.responseHandlers) {
    // Response to a message, invoke registered response handler
    var handler = this.responseHandlers[id]
    handler(request.data)
    this.responseHandlers[id] = null
  } else {
    // Unknown message type, invoke receive handlers
    this.receiveHandlers.forEach(function (handler) {
      handler(request.data, responder)
    })
  }
}

Channel.prototype.ready = function (fn) {
  this.open.promise.then(fn)
}

/**
 * Receive an "unknown" message that does not have a predefined handler.
 * @param {Function} handler
 */
Channel.prototype.receive = function (handler) {
  if (typeof handler !== 'function') {
    throw new Error('msgr: expecting handler to be a function')
  }
  this.receiveHandlers.push(handler)
}

/**
 * Send a message.
 * @param {String|*} type The message type or message data
 * @param {*} [data] The message data
 * @param {String} [_id] Message ID if this is a response
 * @returns {{then: then}}
 */
Channel.prototype.send = function (type, data, _id) {
  _id = _id || shortid.generate()

  var _this = this

  if (!data) {
    data = type
    if (type !== msgr.types.RESPONSE) {
      type = msgr.types.UNKNOWN
    }
  }

  var payload = JSON.stringify({
    type: type,
    data: data,
    id: _id
  })

  var args = [payload]

  if (this.isClient) {
    args.push([this.messageChannel.port2])
  }

  this.open.promise.then(function () {
    this.recipient.postMessage.apply(this.recipient, args)
  }.bind(this))

  return {
    /**
     * Register a one-off response handler for a message.
     * @param {Function} handler
     */
    then: function (handler) {
      if (_this.responseHandlers[_id]) {
        throw new Error('msgr: you can register only one response handler')
      }
      _this.responseHandlers[_id] = handler
    }
  }
}
