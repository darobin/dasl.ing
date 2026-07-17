# Tiles Protocol: Data Passing

Passsing data to and from tiles is key to integrating tiles in arbitrary environments. This protocol specifies precisely that.

## Introduction

Since tiles are cut off from the network, they cannot load data for themselves or post it to servers. This protocol enables a tile and its hots environment to exchange data so that the tile may process or render it and so that it can hand results back to its host.

## Data Loading Protocol

The data protocol is loaded from `/.well-known/web-tiles/data.js`. The interface exported from that has the following functions:

-   `addDataHandler(handler)`: sets function `handler` up to receive data sent by the host. The data is provided to the function as an object that is the structured clone of whatever the host sent.
-   `removeDataHandler(handler)`: removes function `handler` from the list of functions that can receive data payloads from the host.
-   `listen()`: tells the host that the tile is all set up and ready to start receiving data. This is necessary in some environments in which the host may not easily know that a tile has loaded. Always call it when ready.
-   `sendData(payload)`: sends data back to the host, with `payload` being structured-cloned on the way there.

A simple example:

```
try {
  const { listen, addDataHandler, sendData } = await import('/.well-known/web-tiles/data.js');
  addDataHandler((payload) => {
    alert(`Hello ${payload.name}!`);
    sendData({ response: 'How do you do?' });
  });
  listen();
}
catch (err) {
  alert("Sorry, this tile can't receive data.");
}
```

## Web Runtime Context Notes

Tiles may be embedded in all kinds of contexts, and those may determine the exact way in which the `/.well-known/web-tiles/data.js` resource is implemented. This section only gives guidance for web runtimes as they are likely to mostly work in similar ways.

In web runtime contexts, the integration works in the following way:

-   The tile signals that it's ready to engage with data (`listen()`) by sending a message with `action` set to `tiles-protocol-up-data-ready` and no `payload`.
-   The tile receives data (handlers are called) by receiving a message with `action` set to `tiles-protocol-down-data-payload` and `payload` set to the content that the handler receives.
-   The tile sends data (`sendData()`) by sending a message with `action` set to `tiles-protocol-up-data-payload` and `payload` set to the content being sent.

`action`