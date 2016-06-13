# msgr

> Nifty worker/client postMessage utility

Made with ❤ at [@outlandish](http://www.twitter.com/outlandish)

<a href="http://badge.fury.io/js/msgr"><img alt="npm version" src="https://badge.fury.io/js/msgr.svg"></a>
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

## Table of Contents

- [Initialise](#initialise)
- [API](#api)
- [Channel API](#channel-api)

## Initialise

### Example

__Client: `msgr.client()`__

Pass in reference to the worker and a collection of message handlers:

    const recipient = navigator.serviceWorker.controller

    const channel = msgr.client(recipient, {
      // Predefined message handlers
      SAY_HELLO: (data) => console.log('Hello, ' + data) //=> 'Hello, World!'
    })

    // Send something "unknown" to the worker.
    // Notice it does not have a tag.
    channel.send({
      username: 'Flanders',
      location: 'Springfield'
    })

__Worker: `msgr.worker()`__

On the worker you just pass in your message handlers:

    const channel = msgr.worker({
      CACHE_WEB_PAGE: cacheWebPage
    })

    channel.receive(function (data) {
      // Do something with an "unknown" message
      // that does not have a predefined handler.
      console.log(data) //=> { username: 'Flanders', ... }
    })

    // Send something "known" to the client using a tag.
    channel.send('SAY_HELLO', 'World!')

## API

### `msgr([worker,] handlers) : Channel`

Initialise `msgr`.

- [__worker__] {ServiceWorkerRegistration} _(optional)_ Worker that will receive messages sent via channel
- __handlers__ {Object} An object of message type/handler mappings

The handler is given an argument `respond` which allows the recipient to respond once to the message.
See the [Message API Docs](#message-api) for more details.

Returns a Channel. See the [Channel API Docs](#channel-api) for more details.

Example:

    msgr(navigator.serviceWorker.controller, {
      NOTIFY: function (respond) {
        new Notification('You have a notification!')
        respond('GOT_THE_NOTIFICATION')
      }
    })

## Channel API

### `channel.ready(handler)`

Register a handler to be called when the channel is opened between client and worker.

- __handler__ {Function} The ready handler

Although you can register ready handlers, you can send messages before the channel is open using
`channel.send()` and these will be queued and sent as soon as the channel is ready.

Example:

    channel.ready(function () {
      application.start()
    })

### `channel.send([type,] data) : Promise`

Send a message through the channel to the worker/client.

- [__type__] {String} _(optional)_ The message type
- __data__ {Any} The message data

Returns a Message. See the [Message API Docs](#message-api) for more details.

If `data` is not a string it will be stringified by calling `data.toString()`.

If called before the channel is ready the message will be queued and sent as soon as the channel is open.

Example:

    // Tagged
    channel.send('NOTIFY_USER', { message: 'Update complete' })

    // Untagged
    channel.send('This is the untagged data')

### `channel.receive(handler)`

Handle an "unknown" message that is not tagged.

- __handler__ {Function} The message handler

The handler receives two arguments: the `data` of the message and a `respond` function.

Example:

    channel.receive(function (data, respond) {
      console.log('Got some unknown data: ' + data)
    })

## Message API

### `message.then(handler)`

Register a handler to receive the response to a message.

- __handler__ {Function} Response handler

Note: a message can only have one `then` handler. Registering more than one will throw an error.

Example:

    // In client message handlers
    msgr({
      NOTIFY_USER: function (data, respond) {
        new Notification('Job ' + data.id + ' was completed')
        respond('From worker: job deleted') // ACK
      }
    })

    // In worker
    channel.send('NOTIFY_USER', { id: 1337 }).then((data) => {
      console.log(data) //=> 'From worker: job deleted'
    })

### `respond([data])`

Send a response to a received message.

This function is passed as the second argument to both "known" and "unknown" message handlers.

- [__data__] {Any} _(optional)_ The data to respond to the message with

## Contributing

All pull requests and issues welcome!

If you're not sure how, check out Kent C. Dodds'
[great video tutorials on egghead.io](https://egghead.io/lessons/javascript-identifying-how-to-contribute-to-an-open-source-project-on-github)!

## Author & License

`msgr` was created by [Sam Gluck](https://twitter.com/sdgluck) and is released under the MIT license.

