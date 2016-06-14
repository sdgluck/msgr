'use strict'

var test = require('tape')
var sinon = require('sinon')
var msgr = require('./index')

// ---
// Mocks
// ---

var client_knownMessageTypeStub = sinon.stub()
var client_unknownMessageTypeStub = sinon.stub()

var worker_knownMessageTypeStub = sinon.stub()
var worker_unknownMessageTypeStub = sinon.stub()

var serviceWorker = {
  postMessage: function (message) {
    worker._handleMessage.call(worker, {
      data: message,
      ports: [{
        postMessage: function (message) {
          client._handleMessage.call(client, {data: message})
        }
      }]
    })
  }
}

var MessageChannel = function () {
  this.port1 = {onmessage: null}
}

function resetStubs () {
  worker_knownMessageTypeStub.reset()
  worker_unknownMessageTypeStub.reset()
  client_knownMessageTypeStub.reset()
  client_unknownMessageTypeStub.reset()
}

// ---
// Client
// ---

var clientHandlers = {CLIENT_KNOWN_MESSAGE_TYPE: client_knownMessageTypeStub}
var client = msgr.client(serviceWorker, clientHandlers, MessageChannel)

client.receive(client_unknownMessageTypeStub)

// ---
// Worker
// ---

var workerHandlers = {WORKER_KNOWN_MESSAGE_TYPE: worker_knownMessageTypeStub}
var worker_connectSpy = workerHandlers[msgr.types.CONNECT] = sinon.spy()
var worker = msgr.worker(workerHandlers)

worker.receive(worker_unknownMessageTypeStub)

// ---
// Tests
// ---

test('Runs ready handler once channel is open', function (t) {
  client.ready(function () {
    t.end()
  })
})

test('Message handler throws on malformed message', function (t) {
  try {
    client._handleMessage({data: 'blergh'})
  } catch (err) {
    t.equal(err.message, 'msgr: malformed message')
    t.end()
  }
})

test('Client sends CONNECT, worker receives', function (t) {
  t.equal(worker_connectSpy.callCount, 1)
  client.ready(function () {
    t.end()
  })
})

test('Client sends known message with data, worker receives', function (t) {
  resetStubs()
  client.send('WORKER_KNOWN_MESSAGE_TYPE', 'data')
  client.ready(function () {
    t.equal(worker_knownMessageTypeStub.callCount, 1)
    t.end()
  })
})

test('Client sends known message without data, worker receives', function (t) {
  resetStubs()
  client.send('WORKER_KNOWN_MESSAGE_TYPE')
  client.ready(function () {
    t.equal(worker_knownMessageTypeStub.callCount, 1)
    t.end()
  })
})

test('Worker sends known message, client receives', function (t) {
  resetStubs()
  worker.send('CLIENT_KNOWN_MESSAGE_TYPE', 'data')
  worker.ready(function () {
    t.equal(client_knownMessageTypeStub.callCount, 1)
    t.end()
  })
})

test('Client sends known message, worker responds', function (t) {
  resetStubs()
  var message = client.send('WORKER_KNOWN_MESSAGE_TYPE', 'data')
  client.ready(function () {
    worker_knownMessageTypeStub.callArg(1)
    message.then(function () {
      t.end()
    })
  })
})

test('Worker sends known message, client responds', function (t) {
  resetStubs()
  var message = worker.send('CLIENT_KNOWN_MESSAGE_TYPE', 'data')
  worker.ready(function () {
    client_knownMessageTypeStub.callArg(1)
    message.then(function () {
      t.end()
    })
  })
})

test('Client sends unknown message, worker receives', function (t) {
  resetStubs()
  client.send('data')
  client.ready(function () {
    t.equal(worker_unknownMessageTypeStub.callCount, 1)
    t.end()
  })
})

test('Worker sends unknown message, client receives', function (t) {
  resetStubs()
  worker.send('data')
  worker.ready(function () {
    t.equal(client_unknownMessageTypeStub.callCount, 1)
    t.end()
  })
})

test('Client sends unknown message, worker responds', function (t) {
  resetStubs()
  var message = client.send('data')
  client.ready(function () {
    worker_unknownMessageTypeStub.callArg(1)
    message.then(function () {
      t.end()
    })
  })
})

test('Worker sends unknown message, client responds', function (t) {
  resetStubs()
  var message = worker.send('data')
  worker.ready(function () {
    client_unknownMessageTypeStub.callArg(1)
    message.then(function () {
      t.end()
    })
  })
})
