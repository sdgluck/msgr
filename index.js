/* global Promise:false, define:false, module:false, self:false, MessageChannel:false */

'use strict'

var shortid = require('shortid')
var defer = require('mini-defer')

// Proxy references for testing
try {
  var _self = self
  var _MessageChannel = MessageChannel
} catch (err) {}

// ---
// API
// ---

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
  _self = __mockMessageChannel ? {} : self
  _MessageChannel = __mockMessageChannel || MessageChannel
  return msgr(messageHandlers, worker)
}

// Reserved message types
msgr.types = {
  CONNECT: '@@MSGR/CONNECT',
  UNKNOWN: '@@MSGR/UNKNOWN',
  RESPONSE: '@@MSGR/RESPONSE'
}

// ---
// Channel
// ---

function Channel (handlers, worker) {
  this.handlers = handlers
  this.isClient = Boolean(worker)
  this.isWorker = !this.isClient

  // Is the comms channel open?
  this.open = defer()

  // Handlers for unknown message types
  this.receiveHandlers = []

  // Deferreds for sent messages so we can resolve
  // the promise if they receive a response
  this.promises = {}

  if (this.isClient) {
    this.open.resolve()
    this.recipient = worker
    this.messageChannel = new _MessageChannel()
    this.messageChannel.port1.onmessage = this._handleMessage.bind(this)
    this.send(msgr.types.CONNECT)
  } else {
    _self.onmessage = this._handleMessage.bind(this)
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
    var type = request.type
    if (!id || !type) throw new Error()
  } catch (err) {
    throw new Error('msgr: malformed message')
  }

  var responder = function (data) {
    this.send(msgr.types.RESPONSE, data, id)
  }.bind(this)

  if (this.isWorker && request.data === msgr.types.CONNECT) {
    // Special init message type that gives us the port
    // that we will be sending messages to the client over
    this.recipient = event.ports[0]
    this.open.resolve()
  }

  if (request.type === msgr.types.UNKNOWN && request.data in this.handlers) {
    // Known message type without data, invoke registered handler
    this.handlers[request.data](null, responder)
  } else if (request.type in this.handlers) {
    // Known message type with data, invoke registered handler
    this.handlers[request.type](request.data, responder)
  } else if (id && id in this.promises) {
    // Response to a message, invoke registered response handler
    var promise = this.promises[id]
    promise.resolve(request.data)
    this.promises[id] = null
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
 * @returns {Object}
 */
Channel.prototype.send = function (type, data, _id) {
  var id = _id || shortid.generate()

  if (!data) {
    data = type
    if (type !== msgr.types.RESPONSE) {
      type = msgr.types.UNKNOWN
    }
  }

  var deferred = defer()

  var payload = JSON.stringify({
    __msgr: true,
    id: id,
    type: type,
    data: data
  })

  var args = [payload]

  if (this.isClient && data === msgr.types.CONNECT) {
    args.push([this.messageChannel.port2])
  }

  this.open.promise.then(function () {
    this.recipient.postMessage.apply(this.recipient, args)
  }.bind(this))

  this.promises[id] = deferred

  return deferred.promise
}

// ---
// Export
// ---

var api = {
  client: msgr.client,
  worker: msgr.worker,
  types: msgr.types
}

if (typeof define === 'function' && define.amd) {
  define('msgr', function () { return api })
} else if (typeof module === 'object' && module.exports) {
  module.exports = api
} else {
  self.msgr = api
}
