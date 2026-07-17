# Big DASL (BDASL)

BDASL extends DASL CIDs with a new hash type that works better for large files but isn't available by default in browsers, and therefore not an appropriate option in most situations. BDASL also supports streaming verification.

## Introduction

BDASL extends DASL CIDs by adding BLAKE3 support (\[[blake3](#ref-blake3)\]). BLAKE3 is a powerful hashing framework that works well for progressive verification of large streams. Unfortunately, it isn't available in browser (and neither is streaming hashing in general) which makes it inappriopriate for inclusion as the primary hash function in DASL CIDs.

It is recommended to avoid using BDASL CIDs in arbitrary open environments, and rather to focus on using such CIDs in specific cases in which participants are likely to know how to handle them.

## Parsing BDASL CIDs

All the parsing works the same as for DASL CIDs (\[[cid](#ref-cid)\]) with one modification.

In the steps to [decode a CID](cid.html#decode-a-cid), the <var>hash type</var> may also be equal to `0x1e` (BLAKE3) (\[[blake3](#ref-blake3)\]).

## Streaming Verification

Some content is big. While this produces challenges in all contexts, it creates specific issues with content addressing. When retrieving content-addressed data, verifying the retrieval typically requires having all the bytes available. Not only may this be resource-intensive, it is also impractical: imagine watching a multi-hour video only to be told _when you're almost done watching the whole thing_, which is to say when the last bytes are buffered, that you got the wrong, possibly fraudulent video.

Streaming verification is a process that makes it possible to verify data incrementally or partially. The high level use cases for this are two-fold:

-   Check as you go: you stream data (presumably from the beginning) and the receiver is able to ensure that the data is correct in incremental chunks.
-   Check within ranges: the receiver retrieves arbitrary (or near-arbitrary) subsets of the sender's data, and is able to verify the retrieved chunks without seeing the whole thing or even the bytes that came before a given chunk.

This makes certain usages possible. Checking as you go, you can watch a video and verify it in flight, knowing that you're retrieving the correct, untampered resource as you go. Using ranges, you can query a remote petabyte-scale database simply by seeking inside its on-disk representation (with no server more specific than a range-capable HTTP server), while only sending the necessary data over the wire and verifying it as it comes.

It's important to keep in mind that streaming verification typically requires sidecar that provides information about the hash tree that describes the remote resource. This kind of sidecar incurs an overhead, but the overhead is justified by the streaming benefits.

The \[[blake3](#ref-blake3)\] spec outlines _Streaming Verification_, a process that allows the sender and receiver of a CID to incrementally verify data as it is being transferred. Applying this technique to CIDs is the core benefit of BDASL, which is well-suited to both fetching byte ranges within a CID, and verifying data where the cost of faulty transmission will impact the performance of an application. Verified streaming incurs minimal overhead on payloads of all sizes, and scales linearly as a small percentage of the size of the CID being verified.

Streaming verification rounds to the nearest kilobyte for verification. For more details and a reference implementation, see \[[iroh-blobs](#ref-iroh-blobs)\].

## Verifying HTTP Range Requests

\[[rfc9110](#ref-rfc9110)\] defines HTTP range requests for fetching a single contiguous set of bytes from a larger source held by a server. Range requests use a `Range` header: `Range: bytes={start}-{end}` Both <var>start</var> and <var>end</var> values are optional, and when missing indicate the first and last byte, respectively. Both are integers that map to bytes, with 0 indexing the first byte. The <var>end</var> integer is inclusive, such that ranging over the first 500 bytes would require a range specifier of `0-499`.

In this context, the HTTP server is _trusted_: the client is getting bytes back the integrity of which it cannot verify and has to trust the server to be correctly performing verification on behalf of the user, to not be malicious, to not introduce errors, and ultimately to serve as the authority for that content (\[[ipfs-principles](#ref-ipfs-principles)\]). Being able to support _trustless_ fetching requires the abilty to use verified streaming directly as described below.

### Fulfilling Range Requests

Under the hood, streaming verification works by verifying _chunks_ of a certain size. The chunks are the smallest level of granularity that can be verified. If the chunk size is 1024 bytes and the client requests range 900-1299, then the client needs to fetch two chunks (0-1023 and 1024-2047) for a total of 2048 bytes, verify those two chunks, and then return the subset of data corresponding to the requested range.

For a given byte range `(start: Option<u64>, end: Option<u64>)`, that byte range is mapped to a <var>chunk range</var>, which is the set of chunks that fully contains the set of bytes in the HTTP range request. The <var>chunk range</var> corresponding to a given byte range is calculated as follows:

_Start Chunk_:

-   If `start` is a number <var>s</var>, use `⌈s / 1024⌉` (ceiling division).
-   If `start` is empty, there is no lower bound, so begin the request from byte 0.

_End Chunk_:

-   If `end` is a number <var>s</var>, use `⌈s / 1024⌉` (ceiling division).
-   If `end` is empty, no upper bound, so request to the end of the byte array.

From here, construct a verified range request in accordance with the verified streaming protocol, as chunks arrive, check if the chunk responded intersects with either start or end chunks.

-   Truncate the <var>start</var> chunk to match the byte offset of the request.
-   Truncate the <var>end</var> chunk to match the byte offset of end of the request.
-   Any non start or end chunks are interior to the range, and returned as whole chunks.

### Example

For a request of `Range: bytes=500-1600` two chunks will be retrieved, chunk 0 and chunk 1.

-   **Chunk 0** (offset 0, 1024 bytes):
    -   Intersection: `[500, 1024)`
    -   Extracted: `chunk_data[500..1024]` (524 bytes)
-   **Chunk 1** (offset 1024, 1024 bytes):
    -   Intersection: `[1024, 1600)`
    -   Extracted: `chunk_data[0..577]` (577 bytes)

## References

<dfn id="ref-blake3">\[blake3\]</dfn>

J-P. Aumasson, S. Neves, J. O'Connor, Z. Wilcox. [The BLAKE3 Hashing Framework](https://www.ietf.org/archive/id/draft-aumasson-blake3-00.html). July 2024. URL: [https://www.ietf.org/archive/id/draft-aumasson-blake3-00.html](https://www.ietf.org/archive/id/draft-aumasson-blake3-00.html)

<dfn id="ref-cid">\[cid\]</dfn>

Robin Berjon & Juan Caballero. [Content IDs (CIDs)](https://dasl.ing/cid.html). 2026-07-17. URL: [https://dasl.ing/cid.html](https://dasl.ing/cid.html)

<dfn id="ref-ipfs-principles">\[ipfs-principles\]</dfn>

Robin Berjon. [IPFS Principles](https://specs.ipfs.tech/architecture/principles/). march 2023. URL: [https://specs.ipfs.tech/architecture/principles/](https://specs.ipfs.tech/architecture/principles/)

<dfn id="ref-iroh-blobs">\[iroh-blobs\]</dfn>

[iroh-blobs protocol specification](https://docs.rs/iroh-blobs/latest/iroh_blobs/protocol/index.html)

<dfn id="ref-rfc9110">\[rfc9110\]</dfn>

HTTP Semantics (Range Requests: Section 14) [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-14)