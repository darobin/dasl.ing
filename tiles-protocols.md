# Tiles Protocols

Tiles ([tiles]) are intended for use in a diversity of environements. Depending on the environment that they find themselves embedded in, they will have access to different capabilities that expose various features and communicate with the host environment. Tiles Protocols are the mechanisms through which these integrations are made available.

## Introduction

Tiles are intended to be embedded in many different contexts, but also to be strongly sandboxed to keep them from exfiltrating data. This means that features like passing data to and from a tile need specific handling. That's what Tiles Protocols are for.

Because a tile does not necessarily know what environment it's embedded in, it's up to the embedding environment to provide the implementation for a given protocol. The tile simply loads it according to a shared convention and then uses the documented interface to use the protocol implementation it has loaded as a black box.

## Protocol Loading

All protocols are loaded from resources under `/.well-known/web-tiles/`. Note that this path is reserved and that trying to include content under it in a tile will almost certainly fail. An imaginary Cat tiles protocol could be loaded for instance from `/.well-known/web-tiles/cats.js`. If the embeddeding environment supports cats, that resource will resolve, if it doesn't the load will error.

The JavaScript loading pattern for a protocol is always the same:

try {
  const protocolApi = await import('/.well-known/web-tiles/some-protocol.js');
  // Use protocolApi like the JS object it is.
}
catch (err) {
  // Handle whatever the tile does when this protocol isn't available.
  // If it's essential, at least show the user a message.
}
      

## Registered Protocols

This table lists all the currently registered resource name under `/.well-known/web-tiles/`. Note that some cannot be usefully loaded as protocols and just act as reserved paths that may be present in some environments.

name

source

notes

`index.html`

reserved

Loader in web contexts.

`shuttle.js`

reserved

Code for loader in web contexts.

`worker.js`

reserved

Service Worker in web contexts.

`data.js`

\[[tp-data](#ref-tp-data)\]

Data passing to and from tiles.

`store.js`

\[[tp-editable](#ref-tp-editable)\]

Self-editing tiles, the protocol can read and write from the tile's store.

## References

<dfn id="ref-tiles">\[tiles\]</dfn>

Robin Berjon. [Web Tiles](https://dasl.ing/tiles.html). 2026-07-10. URL: [https://dasl.ing/tiles.html](https://dasl.ing/tiles.html)

<dfn id="ref-tp-data">\[tp-data\]</dfn>

Robin Berjon. [Tiles Protocol: Data Loading](https://dasl.ing/tp-data.html). 2026-07-10. URL: [https://dasl.ing/tp-data.html](https://dasl.ing/tp-data.html)

<dfn id="ref-tp-editable">\[tp-editable\]</dfn>

Robin Berjon. [Tiles Protocol: Self-Editing Tiles](https://dasl.ing/tp-editable.html). 2026-07-10. URL: [https://dasl.ing/tp-editable.html](https://dasl.ing/tp-editable.html)