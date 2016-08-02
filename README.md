# msgr

> Nifty service worker/client message utility

Made with ❤ at [@outlandish](http://www.twitter.com/outlandish)

<a href="http://badge.fury.io/js/msgr"><img alt="npm version" src="https://badge.fury.io/js/msgr.svg"></a>
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)

Makes communication between a client and service worker super easy...

- Send messages from `client -> worker` and vice-versa with `channel.send()`
- Accommodates complex communications with a simple API:
    - anonymous, data-only messages
    - typed-only messages 
    - typed messages with data
- Easily respond to any message by calling `respond()` in the handler
- Receive one-off responses using `channel.send(<options>).then(<response_handler>)`

_To see it being used in the wild, check out the source code of [`fetch-sync`](https://github.com/sdgluck/fetch-sync)._

## Table of Contents

- [Import](#import)
- [Initialise & Example](#initialise-&-example)
- [Sending Messages](#sending-messages)
- [Receiving Messages](#receiving-messages)
- [msgr API](#msgr-api)
- [Channel API](#channel-api)
- [Message API](#message-api)

## Import

__Client__

```js
// ES6
import msgr from 'msgr'

// CommonJS
var msgr = require('msgr')

// RequireJS
define(['msgr'], function (msgr) {/*...*/})
```

```html
<!-- Script, available as `window.msgr` -->
<script src="/node_modules/msgr/index.js"></script>
```

__Worker__

If you are bundling your SW then you can use the Import methods above.

Otherwise...

```js
// importScripts
importScripts('/node_modules/msgr/index.js')
```

## Initialise & Example

__Client: `msgr.client()`__

Pass in reference to the worker and a collection of message handlers:

```js
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

// Send a "known" message to the worker
channel.send('CACHE_ASSET', '/cat.gif').then(function (message) {
  console.log(message) //=> 'Caching complete!'
})
```

__Worker: `msgr.worker()`__

On the worker you just pass in your message handlers:

```js
const channel = msgr.worker({
  CACHE_ASSET: (url, respond) => {
    cache(url).then(function () {
      respond('Caching complete!')
    })
  }
})

channel.receive(function (data) {
  // Do something with an "unknown" message
  // that does not have a predefined handler.
  console.log(data) //=> { username: 'Flanders', ... }
})

// Send something "known" to the client using a tag.
channel.send('SAY_HELLO', 'World!')
```

## Sending Messages

- Anonymous, data-only message:

    ```js
    channel.send({ requestId: '123' })
    ```
    
- Type-only message:

    ```js
    channel.send('RE_CACHE')
    ```

- Typed message with data:

    ```js
    channel.send('RE_CACHE', { assetUrl: '/cat.gif' })
    ```
    
## Receiving Messages

The API for receiving messages is the same for both the worker and client.

- Anonymous, data-only message:

    ```js
    channel.receive((data) => {
      console.log(data.requestId) //=> '123'
    })
    ```
    
- Type-only message:

    ```js
    msgr.client({
      RE_CACHE: (data, respond) => {
        console.log(data) //=> null
      }
    })
    ```

- Typed message with data:

    ```js
    
    msgr.client({
      RE_CACHE: (data, respond) => {
        console.log(data.assetUrl) //=> '/cat.gif'
      }
    })
    ```

## msgr API

### `msgr.client(serviceWorker, handlers) : Channel`

Initialise a `msgr` client.

- __serviceWorker__ {ServiceWorkerRegistration} Worker that will receive messages sent via channel
- __handlers__ {Object} An object of message type/handler mappings

Returns a Channel. See the [Channel API Docs](#channel-api) for more details.

Example:

```js
msgr.client(navigator.serviceWorker.controller, {
  NOTIFY: function (respond) {
    new Notification('You have a notification!')
    respond('GOT_THE_NOTIFICATION')
  }
})
```

### `msgr.worker(handlers) : Channel`

Initialise a `msgr` worker.

- __handlers__ {Object} An object of message type/handler mappings

Returns a Channel. See the [Channel API Docs](#channel-api) for more details.

Example:

```js
msgr.worker({
  NOTIFY: function (respond) {
    new Notification('You have a notification!')
    respond('GOT_THE_NOTIFICATION')
  }
})
```

## Channel API

### `channel.ready(handler)`

Register a handler to be called when the channel is opened between client and worker.

- __handler__ {Function} The ready handler

Although you can register ready handlers, you can send messages before the channel is open using
`channel.send()` and these will be queued and sent as soon as the channel is ready.

Example:

```js
channel.ready(function () {
  application.start()
})
```

### `channel.send([type,] data) : Promise`

Send a message through the channel to the worker/client.

- [__type__] {String} _(optional)_ The message type
- __data__ {Any} The message data (it will be JSON.stringify'd)

Returns a Message. See the [Message API Docs](#message-api) for more details.

If called before the channel is ready the message will be queued and sent as soon as the channel is open.

Example:

```js
// Typed message, will invoke registered type handlers
channel.send('NOTIFY_USER')

// Typed message with data, will invoke registered type handlers
channel.send('NOTIFY_USER', { message: 'Update complete' })

// Anonymous, will invoke `receive` handlers
channel.send('This is the untagged data')
```

### `channel.receive(handler)`

Handle an "unknown" message that is not tagged.

- __handler__ {Function} The message handler

The handler receives two arguments: the `data` of the message and a `respond` function.

Example:

```js
channel.receive(function (data, respond) {
  console.log('Got some unknown data: ' + data)
})
```

## Message API

### `message.then(handler)`

Register a handler to receive the response to a message.

- __handler__ {Function} Response handler

Example:

```js
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
```

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

