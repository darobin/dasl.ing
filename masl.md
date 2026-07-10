# MASL — Metadata for Arbitrary Structures & Links

MASL is a CBOR-based metadata system that is designed to work well with content-addressed and decentralised systems, to enable fully self-contained, self-certified content distribution.

## Introduction

Anywhere you have resources that will be deployed in real-world systems, the potential metadata needs of those systems are effectively unbounded. This is particularly true of decentralised systems that need to exhibit "web-like" behaviour: in order to have reproducible and safe execution when content is sourced from arbitrary origins, it is necessary to have an equivalent to HTTP headers that is as verifiable as the content itself and not suffer the lossy behaviour that can occur when one treats the web as a file system (which it is not).

Designing or constraining a syntax for all metadata needs would be hubris and madness. Instead, this document tries to minimally constrain applications while illustrating "where to stick" that metadata, as there are so few layers and hiding places in the DASL system.

## How to use a MASL document

The recommended structure for DASL metadata is to insert a \[[drisl](#ref-drisl)\] document "between" each CID and its resource(s), essentially using DRISL to encode headers for one or more CID-addressed resources. To do this, simply replace the CID of a resource with the CID of a DRISL object that contains a top-level (tag 42) property named `src`. To bundle a set of CIDs in a logical unit, drop the top-level `src` and replace it with a mapping of paths-from-domain-root to DRISL metadata objects including a `src` property containing the resource's CID.

It is preferable to nest any metadata in a top-level object to namespace your own metadata vocabulary (inside an object named, for example, \`my-cool-project-v1\`) rather than using opaque UUIDs, version-bits inserted into values, or magic numbers. There are a few reserved words at the top-level, but even these can be avoided by nesting any conflicts as needed.

There are many metadata standards that can be embedded in this way to facilitate the preservation of metadata at ingress as well as translatability. For example, the IPFS-based storage system Storacha has a robust CID-based metadata system called [content credentials](https://github.com/storacha/content-claims) which includes UCAN-based permissioning, inclusion attestations, and CID "equivalences," e.g. mappings of multiple IPFS CIDs equivalent to each other and/or to a given DASL CID.

### Using MASL with CAR

CAR files (\[[car](#ref-car)\]) have a space reserved for metadata in their header. A MASL metadata document can occupy that metadata header-space, and the variant using a `resources` map is particularly well-suited to be used there. The <var>resources</var> field can be used to map paths to the CIDs of resources contained in subsequent CAR blocks after the metadata header.

In order to be inserted directly as metadata object within CAR files, MASL documents need to contain a top-level `version` property whose value must be set to integer `1` and a top-level `roots` array that must contain 0 or more tag 42 CIDs and nothing else. Neither of these fields has any meaning in MASL, but they must be provided in the context of a CAR header for historical compatibility reasons. Note that there is no requirements that all the CIDs in a `roots` array also appear in the `resources` mapping or vice versa.

## Fields

MASL is designed to host arbitrary metadata but for interoperability purposes a number of root fields have predetermined values. Authors are invited to add their own metadata by creating namespaced objects at the top level.

**NOTE**: In examples below, whenever we represent a CID as JSON for, say, field `src`, we use `"src": { "$link": "CID value…" }` as a readability convention.

### Single or Multiple Resources

MASL documents are primarily used to wrap around other resources for which they provide metadata. This can happen in one of two modes:

-   **Single Mode** (using `src`): the metadata is only for _one_ resource, which is the one that can be retrieved from the CID pointed to by `src`. HTTP metadata, if specified, goes at the root. App manifest metadata on a single resource can be used if that resource a fully standalone document (e.g. a PDF).
-   **Bundle Mode** (using `resources`): the metadata is used to describe a whole set of resources. These resources will typically be related to one another in some way (e.g. components that go into building an app or document). The keys of the `resources` map are complete paths that must start with `/` and the values are metadata objects that must have an `src` field pointing to the resource's CID and should have a `content-type` field giving its MIME type, along with other HTTP headers. Any other properties present which do not map to HTTP headers must be ignored.

Note that if both `src` and `resources` are specified, then `src` must be ignored.

The Bundle Mode has some specific processing rules:

-   Default: The entry with path `/` is the default path that is loaded if the bundle itself gets rendered, e.g. in a browser or other user-agent. Implementations must only recognise this as the default and must not automatically decide to pick a given entry (e.g. `/index.html`).
-   Relative: When loading a bundle into a web context, the root of the bundle is given an opaque origin, and all internal links are resolved relative to that.
-   No directory: There is no notion of directory. If a resource is indicated as sitting at `/cats/reds/kitsune.jpg` this does not entail that `/cats/` or `/cats/reds/` somehow exist. As in web contexts, it is the full path that is matched, not `/`\-separated subsets. URLs do _not_ map to file systems.
-   Query strings: When resolving a URL inside of a bundle, implementation must only make use of the URL's pathname and must ignore the query string. (Note that this departs from typical URL processing but makes it easier to pass parameters between resources internally.)

There is no requirement in MASL that bundles have to be stored or dereferenced in any specific manner. The relevant CIDs may be loaded through whatever way the implementation knows about such as RASL (\[[rasl](#ref-rasl)\]) or may be provided in a CAR file (\[[car](#ref-car)\]). Note that one value of this approach when compared to bundling resources for instance into Zip archives (or CAR files!) is that the resource map can contain an arbitrarily high number or volume of resources; an implementation may load an arbitrary subset of the resources, may parallelize loading, in an arbitrary order informed by types and HTTP headers, or load some resources on-demand.

Specify a scheme and fetch rules properly.

Example with `src`:

{
  "src": { "$link": "bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4" },
  "content-type": "application/pdf",
}
        

Example with `resources`:

{
  "name": "A Simple Page With Pic",
  "resources": {
    "/": {
      "src": { "$link": "bafk…" },
      "content-type": "text/html"
    },
    "/picture.jpg": {
      "src": { "$link": "bafk…" },
      "content-type": "image/jpeg"
    }
  }
}
        

### HTTP Headers

MASL supports a subset of HTTP response headers that are meaningful in decentralised contexts. This doesn't preclude headers not listed here from being used, but implementations that support using HTTP headers should not reflect the value of arbitrary HTTP headers without considering the potential attack surface they create.

When using HTTP headers as MASL metadata, there are two modes. If the MASL document contains a root `resources` field then it is a MASL document for multiple resources and the HTTP headers are only meaningful if they are set on values of the `resources` map (and must be ignored if set on the root object). Conversely, if this MASL document contains a `src` field (and no `resources`) then the HTTP headers must be set on the root and ignored otherwise. If neither `src` nor `resources` are specified, the meaning of HTTP fields is undefined.

All HTTP headers, where specified, are lowercased. Implementations must ignore headers with a different casing.

Supported headers:

-   `content-disposition`
-   `content-encoding`
-   `content-language`
-   `content-security-policy`: keep in mind however that runtime contexts are likely to already have a strict CSP that will override or constrain this one.
-   `content-type`
-   `link`
-   `permissions-policy`
-   `referrer-policy`
-   `service-worker-allowed`
-   `sourcemap`: this must point to another resource in the `resources` map. Implementations must verify that this is the case and ignore the header otherwise as source maps could be used to exfiltrate information.
-   `speculation-rules`: this must point to another resource in the `resources` map.
-   `supports-loading-mode`
-   `x-content-type-options`

Example with `src`:

{
  "src": { "$link": "bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4" },
  "content-type": "text/html",
  "content-language": "en",
  "service-worker-allowed": "/"
}
        

Example with `resources`:

{
  "name": "My Doc",
  "resources": {
    "/": {
      "src": { "$link": "bafk…" },
      "content-type": "text/html",
      "content-encoding": "gzip",
      "content-language": "fr"
    },
    "/interactive.js": {
      "src": { "$link": "bafk…" },
      "content-type": "application/javascript",
      "sourcemap": "/interactive.js.map"
    },
    "/interactive.js.map": {
      "src": { "$link": "bafk…" },
      "content-type": "application/json"
    },
    "/picture.jpg": {
      "src": { "$link": "bafk…" },
      "content-type": "image/jpeg"
    }
  }
}
        

### App Manifest

One useful pattern with MASL is to describe an entire app or document, with all of its resources available for content addressing, possibly within a common CAR (\[[car](#ref-car)\]). Such docs or apps should use Web App Manifest metadata (\[[manifest](#ref-manifest)\]) as it is widely understood.

The following manifest fields are guaranteed to be usable: `background_color`, `categories`, `description`, `icons`, `id`, `name`, `screenshots`, `short_name`, and `theme_color`. Note: other manifest fields may be used, but their behaviour is not guaranteed in the kind of web and web-like contexts for which MASL is optimized.

For both `icons` and `screenshots`, the `src` field must be a path that matches an entry in the `resources` map, and the `type` field that is normally accepted in manifests there must not be used and must be ignored if specified. Media type information for that resource is specific on the resource entry that `src` maps to.

Example:

{
  "name": "Unicorn Editor",
  "short\_name": "Unicorn",
  "description": "This is simply the best app to edit unicorns with.",
  "background\_color": "#00ff75",
  "icons": \[{ "src": "/unicorn.svg" }\],
  "resources": {
    "/": {
      "src": { "$link": "bafk…" },
      "content-type": "text/html"
    },
    "/unicorn.svg": {
      "src": { "$link": "bafk…" },
      "content-type": "image/svg"
    }
  }
}
        

### CAR Compatibility

As indicated in the CAR specification (\[[car](#ref-car)\]), the metadata object in the CAR header must contain a `version` field set to integer `1` and a `roots` field set to an array (that may be empty) of tag 42 CIDs. These fields have no meaning for MASL, but are expected to be set when MASL is used for CAR metadata for historical compatibility. Note that using versions in this way is an antipattern, and we expect the value never to change.

Example:

{
  "name": "Get in the CAR if you want to live",
  "version": 1,
  "roots": \[\]
}
        

### AT Compatibility

When used with the AT Protocol (\[[at](#ref-at)\]), it is common that objects will need to feature a `$type` field. If present, it must be a string and must be set to the value `ing.dasl.masl`.

### Versioning

When manipulating DAGs, it can be useful to keep track of history by referencing earlier versions of the same data or metadata. This can be done using the `prev` field, which if present must be a tag 42 CID pointing to a previous MASL document.

Example:

{
  "name": "Unicorn Editor",
  "prev": { "$link": "bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4" }
}
        

## Lexicon

Making a precise lexicon (\[[lexicon](#ref-lexicon)\]) for MASL is impossible because lexicons lack a way of constraining objects with arbitrary keys. However, the following may still prove useful when MASL is integrated with the AT Protocol (\[[at](#ref-at)\]).

{
  "lexicon": 1,
  "id": "ing.dasl.masl",
  "defs": {
    "main": {
      "type": "object",
      "properties": {
        "src": { "type": "cid-link" },
        "resources": {
          "type": "unknown"
        },
        // HTTP
        "content-type": { "type": "string" },
        "content-disposition": { "type": "string" },
        "content-encoding": { "type": "string" },
        "content-language": { "type": "string" },
        "content-security-policy": { "type": "string" },
        "link": { "type": "string" },
        "permissions-policy": { "type": "string" },
        "referrer-policy": { "type": "string" },
        "service-worker-allowed": { "type": "string" },
        "sourcemap": { "type": "string" },
        "speculation-rules": { "type": "string" },
        "supports-loading-mode": { "type": "string" },
        "x-content-type-options": { "type": "string" },
        // Manifest
        "background\_color": {
          "type": "string"
        },
        "categories": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "description": {
          "type": "string"
        },
        "icons": {
          "type": "array",
          "items": {
            "type": "object",
            "required": \["src"\],
            "properties":{
              "src": { "type": "string" },
              "sizes": { "type": "string" },
              "purpose": { "type": "string" }
            }
          }
        },
        "name": {
          "type": "string"
        },
        "screenshots": {
          "type": "array",
          "items": {
            "type": "object",
            "required": \["src"\],
            "properties":{
              "src": { "type": "string" },
              "sizes": { "type": "string" },
              "label": { "type": "string" },
              "form\_factor": {
                "type": "string",
                "knownValues": \["narrow", "wide"\]
              },
              "platform": {
                "type": "string",
                "knownValues": \["android", "chromeos", "ios", "ipados", "kaios", "macos", "windows", "xbox", "chrome\_web\_store", "itunes", "microsoft", "microsoft", "play"\]
              }
            }
          }
        },
        "short\_name": {
          "type": "string"
        },
        "theme\_color": {
          "type": "string"
        },
        // CAR compatibility
        "version": {
          "type": "integer",
          "const": 1
        },
        "roots": {
          "type": "array",
          "items": { "type": "cid-link" }
        },
        // versioning
        "prev": { "type": "cid-link" }
      }
    }
  }
}
      

## References

<dfn id="ref-at">\[at\]</dfn>

[AT Protocol](https://atproto.com/specs/atp). URL: [https://atproto.com/](https://atproto.com/)

<dfn id="ref-car">\[car\]</dfn>

Robin Berjon & Juan Caballero. [Content-Addressable aRchives (CAR)](https://dasl.ing/car.html). 2026-07-10. URL: [https://dasl.ing/car.html](https://dasl.ing/car.html)

<dfn id="ref-drisl">\[drisl\]</dfn>

Robin Berjon & Juan Caballero. [DRISL — Deterministic Representation for Interoperable Structures & Links](https://dasl.ing/drisl.html). 2026-07-10. URL: [https://dasl.ing/drisl.html](https://dasl.ing/drisl.html)

<dfn id="ref-lexicon">\[lexicon\]</dfn>

[AT Protocol: Lexicon](https://atproto.com/specs/lexicon).

<dfn id="ref-manifest">\[manifest\]</dfn>

M. Cáceres, K. Rohde Christiansen, D. González, D. Murphy, C. Liebel. [Web Application Manifest](https://www.w3.org/TR/appmanifest/). March 2025. URL: [https://www.w3.org/TR/appmanifest/](https://www.w3.org/TR/appmanifest/)

<dfn id="ref-rasl">\[rasl\]</dfn>

Robin Berjon & Juan Caballero. [RASL — Retrieval of Arbitrary Structures & Links](https://dasl.ing/rasl.html). 2026-07-10. URL: [https://dasl.ing/rasl.html](https://dasl.ing/rasl.html)