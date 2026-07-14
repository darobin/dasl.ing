# Web Tiles

Tiles are composable web docs and apps that can safely be used in arbitrary contexts and assembled from multiple sources to carry out complex user interface tasks. Their composability, security, and privacy properties make them ideal for use in social media, chat, agents, and malleable software.

## Introduction

The web is a powerful platform that makes it possible to create high-quality content and applications. It would be desirable to be able to use it for social media posts, so that they could feature arbitrary content, and to be able to compose multiple small web apps together by having them talk to one another. Unfortunately, the dominant web security model is a poor fit for such tasks because it makes it way too easy to exfiltrate data, and is generally a privacy nightmare.

Tiles change this by offering an environment in which arbitrary web content can be executed, while protecting against the egress of data by simply locking down the tile to whatever content is pre-listed in its manifest. The embedding app or context mediates all communication. This makes it possible to safely embed tiles in social media, chats, LLM interactions, or to compose them with one another.

While the lack of network interaction is limiting, tile execution contexts can then make tiles powerful all the same. For instance, consider a poll tile in a group chat app: when one participant votes, their tile instance posts the vote to a communication channel provided by the chat application. The chat app then broadcasts this vote to all other participants' tile instances, keeping the poll results synchronized.

## Tile Manifests

A tile manifest is simply a [MASL document](masl.html), using the Bundle Mode. The manifest must have a `name` and a `resources` entry, and `resources` must include a `/` entry for the root.

That's all that's needed. The mechanism for obtaining the manifest depends on the context that the tile is loaded from, as detailed in the following sections.

## Tiles on AT Protocol

A key use case for tiles is publishing them on the [AT Protocol](https://atproto.com/) (\[[at](#ref-at)\]). Publishing a tile on AT is conceptually simple: every entry in `resources` must get uploaded as a blob to the relevant PDS and then the tile itself must be posted to the account's repository as a record containing the manifest.

The details of the record and the MASL variant used on AT are specified in [the relevant appendix](#lexicon). Please pay particular attention to the details provided there about the manner in which `resources` need to point to blobs in order to operate correctly in an AT context.

## Tiles in CAR

Tiles can be stored as files by packing them into [CARballs](car.html) (\[[car](#ref-car)\]). All the resources must be in the CAR, and the CAR header must be the [MASL](masl.html) metadata, along with the `roots` and `version` fields that CAR requires (\[[masl](#ref-masl)\]).

As a convention, the tile carball may be named with a `.tile` extension. No particular media type is recommended at this time, the preferred way of publishing tiles online being over AT.

## Tile Execution Contexts

In order to guarantee that tiles run in as safe and private a manner as possible, the web context into which they are loaded must meet restrictions that correspond to the following headers:

```
content-security-policy:
    default-src 'self' blob: data:;
    script-src 'self' blob: data: 'unsafe-inline' 'wasm-unsafe-eval';
    script-src-attr 'none';
    style-src 'self' blob: data: 'unsafe-inline';
    form-src 'self';
    manifest-src 'none';
    object-src 'none';
    base-uri 'none';
    sandbox allow-downloads
            allow-forms
            allow-modals
            allow-popups
            allow-popups-to-escape-sandbox
            allow-same-origin
            allow-scripts
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: cross-origin
origin-agent-cluster: ?1
permissions-policy: interest-cohort=(), browsing-topics=()
referrer-policy: no-referrer
x-content-type-options: nosniff
x-dns-prefetch-control: off
```

In the current state of browser technology, loading tiles in a web context requires setting up an origin that is unique to the tile (currently it is random, though it may become derived from its CID), which in turn requires touching the network. It is recommended to use a server that is trusted by the user for this purpose (i.e. one that cannot learn more than what the embedding context already knows).

Because the lack of network access is restrictive, tiles can be granted additional contextual access. A future version of this specification will add support for chat channels (to sync between tile instances in a chat) and an intent-based way for tiles to call one another.

## Appendix: Decision Tree

The design of web tiles can be surprising to people who are used to typical apps. A core part of the model is that, while they can have access to relatively powerful capabilities, they are completely cut off from network access beyond loading their own pre-declared dependencies (and barring gating access through specific user action).

This can feel restrictive, but two things mitigate those restrictions. First, depending on context, tiles can be granted access to functions that allow them to perform things that regular pages cannot, such as communicating with other instances of the same tile in a chat or invoking other tiles. And second — and most importantly — this restriction makes new applications possible. In many cases it's simply inconceivable to run a full-fledged web frame simply because it could exfiltrate too much sensitive data too easily. But since tiles have very constrained exfiltration paths, they are safe for use in private environments.

To better understand this, we've made a decision tree that maps the design space for embedded apps and docs. You'll notice the tree omits whether users should be prompted for access to powerful capabilities as a load-bearing component of access to anything dangerous, including exfiltration. This is intentional: relying on users to correctly evaluate permission requests for powerful capabilities has repeatedly failed in practice.

Do you want to build atop web technology?

No. That’s respectable, good luck to you. You’ll probably have make similar trade-offs from the rest of the tree, but they’ll depend a lot on the architectural fundamentals that you select and so it’s hard to discuss that in meaningful detail. You exit the tree here.

Yes. Reuse is good. Painful, but good.

What networking security model do you want?

At least partly arbitrary network access. This may be somewhat restricted (SOP, CORS, etc.) but you can touch the network, which means that you can exfiltrate sensitive information from powerful APIs and generally violate privacy.

Is installation gated to verify some degree of safety of the content?

No. This is basically the web as supported by today’s browsers. You can change some things about how it’s implemented, what the UX is, but in general you will need to limit access to many powerful features, you will need to be careful to limit the loading of content not initially triggered by user action, etc. Nothing new here.

Yes. This is an app store. We know where it ends.

No network access beyond pre-determined content. This makes it possible to expose much more powerful APIs and much more private information, up to and including granting access for instance to a full private chat. The lack of access to the network is limiting, but it also renders the system composable and predictable.

What kind of packaging tech do you use?

Zip-like. This is essentially WebXDC. It’s a fine approach and has seen variants implemented. The downside is that loading content becomes tied to loading the whole bundle or playing challenging games with built-in Zip manifests and range requests. It makes including large content (e.g. parquet, video) difficult and in the general case it will murder the latency of your first paint and interactivity.

Manifest-like. The limits to content loading are not defined by a packaging format but by a manifest that will map the bundle’s internal paths to loading mechanisms, ideally content addressed. The full content can be bundled if desired (e.g. into a CAR) but it can also be loaded through content-addressing indirection mechanisms, for instance from a PDS over AT. This is web tiles.

## Appendix: Tiles Lexicon

Note that lexica are not flexible enough to be able to describe the `resources` map. Importantly, whereas regular MASL uses a CID to reference content, when in an AT record it does not use the `cid` type but rather the `blob` type (\[[masl](#ref-masl)\], \[[cid](#ref-cid)\], \[[at](#ref-at)\]). This is because a PDS will not pay particular attention to a CID but will need an uploaded blob to be referenced by a blob type in a record.

This has important implications with how MASL needs to be used over AT in order to work correctly with deployed PDSs. An example `resources` entry for a root HTML document looks as follows:

```
{
  …
  "resources": {
    "/": {
      "src": {
        "$type": "blob",
        "ref": {
         "$link":"bafkreicknles2uzv7sruakcbjtn5pnoc4rqmgkvnavuq4raxexjvcn7osq"
        },
        "size": 20,
        "mimeType": "application/octet-stream"
      },
      "content-type": "text/html"
    },
    …
  }
}
```

A few things are worth noting in the above:

-   The `$type` is required.
-   The `ref` is what's used to link to the CID.
-   The `size` is required by the PDS and it must be correct (in bytes).
-   The `mimeType` is required by at least some PDS versions and implementations. Note that it doesn't need to match the _actual_ `content-type` that is provided separately. In fact, in some PDS versions it _cannot_ match it in many cases. It is recommended, wherever possible, to just use `application/octet-stream` there.

The full lexicon is:

```
{
  "id": "ing.dasl.masl",
  "description": "Lexicon for DASL (https://dasl.ing/) types used on AT, notably for Web Tiles.",
  "defs": {
    "masl": {
      "type": "object",
      "description": "MASL metadata as defined in https://dasl.ing/masl.html",
      "properties": {
        "name": {
          "type": "string",
          "description": "The name for the tile, can be a title or app name",
          "maxLength": 1000,
          "maxGraphemes": 100
        },
        "description": {
          "type": "string",
          "description": "Short overview of the content",
          "maxLength": 3000,
          "maxGraphemes": 300
        },
        "categories": {
          "type": "array",
          "description": "Tags categorising the tile",
          "items": {
            "type": "string"
          }
        },
        "background\_color": {
          "type": "string",
          "description": "A colour for the background of the tile"
        },
        "icons": {
          "type": "array",
          "description": "Icons for the tile",
          "items": {
            "type": "object",
            "required": \["src"\],
            "properties": {
              "src": { type: "string" }, // has to be in resources
              "sizes": { type: "string" },
              "purpose": { "type": "string" }
            }
          }
        },
        "screenshots": {
          "type": "array",
          "description": "Screenshots, can be used for banner or card images",
          "items": {
            "type": "object",
            "required": \["src"\],
            "properties": {
              "src": { "type": "string" },
              "sizes": { "type": "string" },
              "label": { "type": "string" }
            }
          }
        },
        "sizing": {
          "type": "object",
          "description": "Requesting sizing properties for the content",
          "properties": {
            "width": {
              "type": "integer",
              "mininum": 1
            },
            "height": {
              "type": "integer",
              "mininum": 1
            }
          },
          "required": \["width", "height"\]
        },
        "resources": {
          "type": "unknown",
          "description": "A mapping of path to object with a CID src and HTTP headers"
        },
        "short\_name": {
          "type": "string",
          "description": "A name, in case the basic name cannot fit"
        },
        "theme\_color": {
          "type": "string",
          "description": "Theme colour"
        },
        "prev": {
          "type": "cid-link",
          "description": "In case there are multiple versions of this tile, this is the CID of the previous one"
        },
        // CAR compatibility
        "version": {
          "type": "integer",
          "description": "The CAR version — avoid using this",
          "const": 1
        },
        "roots": {
          "type": "array",
          "description": "The CAR roots — avoid using this",
          "items": { "type": "cid-link" }
        },
      },
      "required": \["name", "resources"\]
    },
    "main": {
      "type": "record",
      "description": "A tile, instantiating MASL metadata into a record",
      "key": "tid",
      "record": {
        "type": "object",
        "required": \["cid", "tile", "createdAt"\],
        "properties": {
          "cid": {
            "type": "string",
            "description": "The DRISL CID of the MASL for the tile",
            "format": "cid"
          },
          "tile": {
            "type": "ref",
            "description": "The MASL content",
            "ref": "ing.dasl.masl#masl"
          },
          "createdAt": {
            "type": "string",
            "description": "Timestamp",
            "format": "datetime"
          }
        }
      }
    }
  }
}
```

## References

<dfn id="ref-at">\[at\]</dfn>

[AT Protocol](https://atproto.com/specs/atp). URL: [https://atproto.com/](https://atproto.com/)

<dfn id="ref-car">\[car\]</dfn>

Robin Berjon & Juan Caballero. [Content-Addressable aRchives (CAR)](https://dasl.ing/car.html). 2026-07-14. URL: [https://dasl.ing/car.html](https://dasl.ing/car.html)

<dfn id="ref-cid">\[cid\]</dfn>

Robin Berjon & Juan Caballero. [Content IDs (CIDs)](https://dasl.ing/cid.html). 2026-07-14. URL: [https://dasl.ing/cid.html](https://dasl.ing/cid.html)

<dfn id="ref-masl">\[masl\]</dfn>

Robin Berjon & Juan Caballero. [MASL — Metadata for Arbitrary Structures & Links](https://dasl.ing/masl.html). 2026-07-14. URL: [https://dasl.ing/masl.html](https://dasl.ing/masl.html)