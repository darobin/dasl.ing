# Content-Addressable aRchives (CAR)

The CAR format offers a serialized representation of set of content-addressed resources in one single concatenated stream, alongside a header that describes that content.

## Introduction

The CAR format (Content Addressable aRchives) is used to store series of content-addressable objects as a sequence of bytes. It packages that stream of objects with a header.

Much of the content of this specification was initially developed as part of the [IPLD](https://github.com/ipld/ipld) project. This specification was developed based on demand from the community to have just the one simplified document. Note that a CARv2 specification was developed at some point to add support for an index trailer, but it met with limited adoption and so was not considered when bringing CAR into DASL.

## Parsing CAR

The CAR format is made of a Header followed by a Body. The Header is a length-prefixed chunk of DRISL (\[[drisl](#ref-drisl)\]) and the Body is a sequence of zero or more length-prefixed blocks that contain a tuple of a DASL CID (\[[cid](#ref-cid)\]) which is always 36 bytes long and the data addressed by that CID. The length prefix in a CAR is encoded as an unsigned variable-length integer (\[[varint](#ref-varint)\], a variant of [LEB128](https://en.wikipedia.org/wiki/LEB128)). This integer specifies the number of remaining bytes, excluding the bytes used to encode the integer.

```
|--- Header --| |------------------- Body -------------------|
[ int | DRISL ] [ int | CID | data ] [ int | CID | data ] …
      
```

The steps to <dfn id="dfn-parse-a-car">parse a CAR</dfn> are:

1.  Accept a byte stream <var>bytes</var> that is consumed with every step that reads from it.
2.  Run the steps to [parse a CAR header](#dfn-parse-a-car-header) with <var>bytes</var> to obtain <var>metadata</var>.
3.  Set up array <var>blocks</var> and run these substeps:
    1.  If <var>bytes</var> is empty, terminate these substeps.
    2.  Run the steps to [parse a CAR block](#dfn-parse-a-car-block) with <var>bytes</var> to obtain <var>cid</var>, <var>data size</var>, and <var>data</var>.
    3.  Push an entry onto <var>blocks</var> containing <var>cid</var>, <var>data size</var>, and <var>data</var>.
    4.  Return to the beginning of these substeps.
4.  Return <var>metadata</var> and <var>blocks</var>.

Note that the CAR header contains a near-arbitrary DRISL object that is to be treated as metadata (\[[drisl](#ref-drisl)\]). For historical reasons, there are two constraints on the header:

-   The object must contain a `version` map entry, the value of which is always integer-type `1`. Version numbers in data formats are an anti-pattern, and as a result this number is guaranteed never to change.
-   The object must contain a `roots` entry, which must be of type array. It may be empty, but if it isn't then it must be an array of CIDs encoded using tag 42 (\[[cid](#ref-cid)\]). A CAR can be used to contain one or more DAGs of \[[drisl](#ref-drisl)\] content and the purpose of the `roots` is to list one or more roots for those DAGs. The array may be empty if you do not care about encoding DAGs.

Some historical implementations will only return <var>version</var> and <var>roots</var>, but it is recommended that they make the entire <var>metadata</var> object available. A best practice for authors is to use the <var>metadata</var> to capture MASL content, which is able to provide metadata and a pathing mapping for the entire content of the CAR stream if needed (\[[masl](#ref-masl)\]).

The steps to <dfn id="dfn-parse-a-car-header">parse a CAR header</dfn> are:

1.  Accept a byte stream <var>bytes</var>.
2.  Read an unsigned varint <var>length</var> from <var>bytes</var> (\[[varint](#ref-varint)\]).
3.  If <var>length</var> is 0, throw an error.
4.  Read <var>length</var> bytes from <var>bytes</var> and decode them as DRISL (\[[drisl](#ref-drisl)\]) into <var>metadata</var>. If <var>metadata</var> is not a map, throw an error.
5.  If <var>metadata</var> does not have a `version` key entry with integer value `1`, throw an error. Otherwise, store `version` in <var>version</var>.
6.  If <var>metadata</var> does not have a `roots` key entry that is an array, or if that array contains anything other than DASL CIDs, throw an error. Otherwise, store `roots` in <var>roots</var>.
7.  Return <var>metadata</var>. (For implementations that only report `version` and `roots`, return those.)

After its header, CAR contains a series of blocks each of which is length-prefixed.

The steps to <dfn id="dfn-parse-a-car-block">parse a CAR block</dfn> are:

1.  Accept a byte stream <var>bytes</var>.
2.  Read an unsigned varint <var>length</var> from <var>bytes</var> (\[[varint](#ref-varint)\]).
3.  If <var>length</var> is less than 36, throw an error.
4.  Read a CID (\[[cid](#ref-cid)\]) from <var>bytes</var> and store it in <var>cid</var>. Note: the length of the CID is always 36 bytes.
5.  Set <var>data size</var> to <var>length</var> minus 36 (the CID length).
6.  Read <var>data size</var> bytes from <var>bytes</var> and store the result in <var>data</var>.
7.  Return <var>cid</var>, <var>data size</var>, and <var>data</var>.

## Additional Considerations

### Conformance

A CAR stream must only feature DASL CIDs.

A CAR stream must have CIDs that match the data body that follows them. A CAR implementation should verify that CIDs match block body data, though it may delegate verification to other components. (Keep in mind that not verifying at all negates the value of content addressing.)

A CAR stream's stated roots must match CIDs contained in the Body. However, implementations frequently operate in a streaming fashion such that they have no way of knowing whether a CAR stream conforms to this requirement before having processed the entire stream. Checking correctness with respect to this requirement may therefore be more readily performed via a warning (at end of processing) or a dedicated validator.

### Determinism

Deterministic CAR creation is not covered by this specification. However, deterministic generation of a CAR from a given graph is possible and is relied upon by certain uses of the format, most notably, [Filecoin](https://filecoin-project.github.io/specs). dCAR may be the topic of a future specification.

Care regarding the ordering of the `roots` array in the Header and avoidance of duplicate blocks may also be required for strict determinism.

### Security & Verifiability

The `roots` specified by the Header of a CAR is expected to appear somewhere in its Body section, however there is no requirement that the roots define entire DAGs, nor that all blocks in a CAR must be part of DAGs described by the root CIDs in the Header. Therefore, the `roots` must not be used alone to determine or differentiate the contents of a CAR.

The CAR format contains no internal means, beyond the blocks and their CIDs, to verify or differentiate contents. Where such a requirement exists, this must be performed externally, such as creating a digest of the entire CAR (and refer to it using a CID).

## Appendix: Media Type

The media type for CAR is [`application/vnd.ipld.car`](https://www.iana.org/assignments/media-types/application/vnd.ipld.car).

The conventional file extension for CAR is `.car`.

## References

<dfn id="ref-cid">\[cid\]</dfn>

Robin Berjon & Juan Caballero. [Content IDs (CIDs)](https://dasl.ing/cid.html). 2026-07-01. URL: [https://dasl.ing/cid.html](https://dasl.ing/cid.html)

<dfn id="ref-drisl">\[drisl\]</dfn>

Robin Berjon & Juan Caballero. [DRISL — Deterministic Representation for Interoperable Structures & Links](https://dasl.ing/drisl.html). 2026-07-01. URL: [https://dasl.ing/drisl.html](https://dasl.ing/drisl.html)

<dfn id="ref-masl">\[masl\]</dfn>

Robin Berjon & Juan Caballero. [MASL — Metadata for Arbitrary Structures & Links](https://dasl.ing/masl.html). 2026-07-01. URL: [https://dasl.ing/masl.html](https://dasl.ing/masl.html)

<dfn id="ref-varint">\[varint\]</dfn>

[unsigned varint](https://github.com/multiformats/unsigned-varint). URL: [https://github.com/multiformats/unsigned-varint](https://github.com/multiformats/unsigned-varint)