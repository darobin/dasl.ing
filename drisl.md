# DRISL — Deterministic Representation for Interoperable Structures & Links

DRISL is a serialization format that is deterministic (so that the same data will have the same CID) and that features native support for using CIDs as links. It is based on CBOR, using a narrow profile of CBOR's "Core" featureset called "[cborc-42]", specified formally in this IETF document.

## Introduction

Deterministic encodings that produce the same stream of bytes for any given data with the same semantics are particularly useful in a content-addressed context. DRISL provides that, compactly encoded as CBOR. Additionally, it supports CBOR's Tag 42 to compactly encode CIDs (\[[cid](#ref-cid)\]) as bytestreams. This CID can be used for content-addressed linking between DRISL documents (such as MASL documents), or to resources (best wrapped in MASL documents where renderability as web documents or web apps is desired).

DRISL does not fork CBOR, CDE, or dCBOR (\[[cbor](#ref-cbor)\], \[[cde](#ref-cde)\], \[[dcbor](#ref-dcbor)\]), but it is a subset of features defined in CBOR "Core" (\[[cborc](#ref-cborc)\]), first defined in the earliest CBOR RFC and largely unaffected by refinements made since. Any decoder for any version of CBOR since v1 will be able to read DRISL content as conformant CBOR, and with enough carefully configuration of a powerful CBOR library and in some case pre-processing of the data, DRISL can be encoded anywhere CBOR can.

## Format

DRISL is an application profile of CBOR (\[[cbor](#ref-cbor)\]) that mostly subsets the more established \[[cborc](#ref-cborc)\] profile, with the following additional constraints:

-   Implementations must support Tag 42 in the [CBOR Tag registry](https://www.iana.org/assignments/cbor-tags/cbor-tags.xhtml); this tag compactly encodes CIDs as bytestrings, as specified below.
-   Implementations must reject all other tags, including any of the tags listed in the [section 3.4 of RFC 8949](https://tools.ietf.org/html/rfc8949#section-3.4).
-   Implementations must reject map keys that are not strings.
-   Floating-point numbers must always be encoded as a 64-bit IEEE 754 binary floating-point, never as a "half-precision" (16-byte, major 7-25) or "single-precision (32-byte, major 7-26)" CBOR key. **NOTE**: It is recommended that users avoid encoding floating-point numbers as much as possible to minimize interoperability and tooling issues.
    -   Completely avoiding floating-point numbers is recommended to minimize interoperability and tooling issues.
    -   Even where floating-point numbers are used, most of the IEEE 754 "special" floating points (infinity, negative infinity, minimal NaN, and NaN with payloads) must not be encoded. Negative zero is the only allowed special floating point.
-   Indefinite-length arrays (and the "break" code making them usable, in major type 7) are not allowed.
-   Similarly, indefinite, incomplete, or streaming CBOR cannot be hashed and thus cannot be referenced by CID; for this reason, DRISL can only encode finite, bounded documents and resources.
-   Concatenation of DRISL objects is generally discouraged and incurs both performance and interoperability risks.
    -   Note that DRISL objects cannot be streamed as CBOR streams (defined in RFC 8742) except in MIME-type aware contexts, as per the CBOR streams specification.
    -   Applications are discouraged from handling concatenated DRISL objects or appending extra bytes of any kind to a DRISL object in memory or across interfaces, as doing so breaks the DRISL-wide assumption that each CID refers to one complete, discrete, and valid CBOR object, and that DRISL systems only ever will be expected to handle such objects.
-   Encoders must not encode any simple values other than `true`, `false`, and `null` (20, 21, and 22 in section 3.3 of \[[rfc8949](#ref-rfc8949)\]).

All other requirements are as CBOR/c (\[[cborc](#ref-cborc)\]).

## CIDs in CBOR

CIDs in CBOR are stored in binary format, as CBOR bytestrings under custom tag 42. For historical reasons the null byte `0x00` is prepended to the binary CID before storing in CBOR.

For more information, see the \[[cbor-tag42](#ref-cbor-tag42)\] appendix to the \[[drisl](#ref-drisl)\] specification.

## Conversion with JSON

JSON lacks a native way to encode tag 42 for CIDs (\[[cbor-tag42](#ref-cbor-tag42)\], \[[cid](#ref-cid)\]). Historically, there have been different conventions to represent CIDs in JSON. For example, DAG-JSON, part of IPLD, used an object with a single `/` key pointing to the stringified CID.

The AT Protocol uses an object with a `$link` key pointing to the stringified DASL CID:

{
  "someSrc": {
    "$link": "bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4"
  }
}
      

This specification recommends that implementations default to the AT Protocol `$link` convention, but may offer the option to support DAG-JSON or other conventions as well.

## References

<dfn id="ref-cbor">\[cbor\]</dfn>

C. Bormann. & P. Hoffman. [Concise Binary Object Representation (CBOR)](https://www.rfc-editor.org/info/rfc8949). October 2024. URL: [https://www.rfc-editor.org/info/rfc8949](https://www.rfc-editor.org/info/rfc8949)

<dfn id="ref-cbor-tag42">\[cbor-tag42\]</dfn>

J. Caballero. [Binary Content Identifiers](https://www.ietf.org/archive/id/draft-caballero-cbor-cborc42-00.html#name-binary-content-identifiers). May 2025. URL: [https://www.ietf.org/archive/id/draft-caballero-cbor-cborc42-00.html#name-binary-content-identifiers](https://www.ietf.org/archive/id/draft-caballero-cbor-cborc42-00.html#name-binary-content-identifiers)

<dfn id="ref-cborc">\[cborc\]</dfn>

A. Rundgren. [Core CBOR Platform Profile](https://datatracker.ietf.org/doc/draft-rundgren-cbor-core/). April 2025. URL: [https://datatracker.ietf.org/doc/draft-rundgren-cbor-core/](https://datatracker.ietf.org/doc/draft-rundgren-cbor-core/)

<dfn id="ref-cborc-42">\[cborc-42\]</dfn>

J. Caballero, R. Berjon. [The tag-42 profile of CBOR Core](https://datatracker.ietf.org/doc/draft-caballero-cbor-cborc42/). May 2025. URL: [https://datatracker.ietf.org/doc/draft-caballero-cbor-cborc42/](https://datatracker.ietf.org/doc/draft-caballero-cbor-cborc42/)

<dfn id="ref-cde">\[cde\]</dfn>

C. Bormann. [CBOR Common Deterministic Encoding (CDE)](https://datatracker.ietf.org/doc/html/draft-ietf-cbor-cde-06). October 2024. URL: [https://datatracker.ietf.org/doc/html/draft-ietf-cbor-cde-06](https://datatracker.ietf.org/doc/html/draft-ietf-cbor-cde-06)

<dfn id="ref-cid">\[cid\]</dfn>

Robin Berjon & Juan Caballero. [Content IDs (CIDs)](https://dasl.ing/cid.html). 2026-07-01. URL: [https://dasl.ing/cid.html](https://dasl.ing/cid.html)

<dfn id="ref-dcbor">\[dcbor\]</dfn>

W. McNally, C. Allen, C. Bormann, & L. Lundblade. [dCBOR: A Deterministic CBOR Application Profile](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/). October 2024. URL: [https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/](https://datatracker.ietf.org/doc/draft-mcnally-deterministic-cbor/)

<dfn id="ref-drisl">\[drisl\]</dfn>

Robin Berjon & Juan Caballero. [DRISL — Deterministic Representation for Interoperable Structures & Links](https://dasl.ing/drisl.html). 2026-07-01. URL: [https://dasl.ing/drisl.html](https://dasl.ing/drisl.html)

<dfn id="ref-rfc8949">\[rfc8949\]</dfn>

C. Bormann, P. Hoffman. [Concise Binary Object Representation (CBOR)](https://www.rfc-editor.org/rfc/rfc8949). December 2020. URL: [https://www.rfc-editor.org/rfc/rfc8949](https://www.rfc-editor.org/rfc/rfc8949)