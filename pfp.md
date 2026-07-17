# Perceptual Fingerprint (PFP)

DASL PFPs are a simple structured identifier for referring to similar media using perceptual hashing. They are extensible and algorithm-agnostic, supporting image, video, or other kinds of content fingerprinting.

## Introduction

DASL PFPs are a simple structured identifier for referring to similar media using perceptual hashing. They are extensible and algorithm-agnostic, supporting image, video, or other kinds of content fingerprinting.

Unlike a \[[cid](#ref-cid)\], a PFP does not refer to any single file or sequence of bits. It refers to a set of similar content files that have the same or similar PFPs. You must be able to parse and understand the hash algorithm referred to within the PFP to use it; simply comparing strings is not enough.

A DASL PFP can be represented as a string or as an array of bytes. It has the following structure:

1.  A `p` prefix (only in string form) to differentiate it from CIDs.
2.  An algorithm type, indicating which perceptual hashing algorithm was used.
3.  A length for the rest of the identifier.
4.  The data, which is either the algorithm output hash or a CID of that hash, depending on the algorithm type.

The data can be a CID for cases where the algorithm's data is too long to include directly. For example a video perceptual hash may be 256 KiB in size. The CID allows the data to be retrieved from content-addressed storage, wherever your application stores its data. You could use \[[rasl](#ref-rasl)\] to retrieve it, for example.

## Parsing PFPs

Use the following steps to <dfn id="dfn-parse-a-string-encoded-pfp">parse a string-encoded PFP</dfn>, i.e. translate it to a bytestring:

1.  Accept a string <var>PFP</var>.
2.  Remove the first character from <var>PFP</var> and store it in <var>prefix</var>.
3.  If <var>prefix</var> is not equal to `p`, throw an error.
4.  Decode the rest of <var>PFP</var> using [the base32 algorithm from RFC4648](https://datatracker.ietf.org/doc/html/rfc4648#section-6) with a lowercase alphabet and store the result in <var>PFP bytes</var> (\[[rfc4648](#ref-rfc4648)\]).
5.  This results in <var>PFP bytes</var>, which can be used to [decode a PFP](#dfn-decode-a-pfp).

Use the following steps to <dfn id="dfn-decode-a-pfp">decode a PFP</dfn>:

1.  Accept an array of bytes <var>PFP bytes</var>.
2.  Read a \[[varint](#ref-varint)\] from <var>PFP bytes</var> and store it in <var>algorithm type</var>. For most use cases, you can assume it's a single byte and reject unknown integers (unknown algorithm types).
3.  Check <var>algorithm type</var> against the [algorithm registry](#registry). If it is not a supported algorithm, throw an error.
4.  Read a varint from <var>PFP bytes</var> and store it in <var>length</var>.
5.  Verify that <var>length</var> matches the expected length for the <var>algorithm type</var> as specified in the registry. If it does not match, throw an error.
6.  Read <var>length</var> bytes from <var>PFP bytes</var> and store them in <var>data</var>. If there are fewer than <var>length</var> bytes remaining, throw an error.
7.  If the algorithm type specifies that <var>data</var> contains a \[[cid](#ref-cid)\], parse it according to that specification. Otherwise, <var>data</var> contains the perceptual hash directly.
8.  Return <var>algorithm type</var>, <var>length</var>, and <var>data</var>.

## AT Protocol

When storing PFPs in an AT Protocol record, using a pseudo-type is recommended to make them easier to identify by consumers who are not familiar with your lexicon schema. The type for PFPs is `{"__pfp": "p..."}`. This disambiguates PFPs from any other string that starts with `p` in your record.

An example:

```
{
  "$type": "baz.bar.myrecord",
  "foo": "bar",
  "my cid": {"$link": "bafkreiapgas3dluwwzthuv2fnc475ytvve3xd5acoproje3lr2446yno3q"},
  "my pfp": {"__pfp": "paeqo5rgntyjx44a5dse6zygcmprz2ym7rxrbym6ogpzt44mgetbam3a"},
}
```

Here is the lexicon for using that custom type:

```
{
  "lexicon": 1,
  "id": "ing.dasl.pfpRef",
  "defs": {
    "main": {
      "type": "object",
      "description": "Reference to a perceptual fingerprint (PFP).",
      "required": ["__pfp"],
      "properties": {
        "__pfp": {
          "type": "string",
          "description": "Perceptual fingerprint per DASL spec. Format: p<base32-payload>."
        }
      }
    }
  }
}
```

## Registry

The following table lists the officially registered perceptual hashing algorithms. Note number 0x00 is reserved and must be considered invalid if parsed.

The length column refers to the length of the raw hash in the PFP, or the length of the CID (fixed at 36 bytes). If a CID is used, the length of the data the CID points to is not defined.

Algorithm

Number

Content type

Hash or CID

Length

[PDQ](https://github.com/facebook/ThreatExchange/tree/main/pdq)

0x01

Image

Hash

32 bytes

[TMK+PDQF](https://github.com/facebook/ThreatExchange/tree/main/tmk)

0x02

Video

CID

36 bytes

## References

<dfn id="ref-cid">\[cid\]</dfn>

Robin Berjon & Juan Caballero. [Content IDs (CIDs)](https://dasl.ing/cid.html). 2026-07-17. URL: [https://dasl.ing/cid.html](https://dasl.ing/cid.html)

<dfn id="ref-rasl">\[rasl\]</dfn>

Robin Berjon & Juan Caballero. [RASL — Retrieval of Arbitrary Structures & Links](https://dasl.ing/rasl.html). 2026-07-17. URL: [https://dasl.ing/rasl.html](https://dasl.ing/rasl.html)

<dfn id="ref-rfc4648">\[rfc4648\]</dfn>

S. Josefsson. [The Base16, Base32, and Base64 Data Encodings](https://www.rfc-editor.org/rfc/rfc4648). October 2006. URL: [https://www.rfc-editor.org/rfc/rfc4648](https://www.rfc-editor.org/rfc/rfc4648)

<dfn id="ref-varint">\[varint\]</dfn>

[unsigned varint](https://github.com/multiformats/unsigned-varint). URL: [https://github.com/multiformats/unsigned-varint](https://github.com/multiformats/unsigned-varint)