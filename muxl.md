# MUXL — Media Uniform eXact Layout

MUXL is a deterministic and highly-restrictive subset of ISO-BMFF, enabling stable content-addressed identifiers for video and audio. It's like DRISL for MP4 files!

Video is the most important media format on the web, but content-addressed systems don't know what to do with it. DASL gives us DRISL for deterministic serialization of structured data (\[[drisl](#ref-drisl)\]) and CIDs for content identifiers (\[[cid](#ref-cid)\]). But MP4 files — the dominant container format for video — resist content-addressing. Run the same video through ffmpeg twice with identical settings and you'll get different bytes and no stable CID. MUXL solves this problem by introducing a deterministic, highly-restrictive subset of ISO-BMFF.

This format attempts to fulfill three design goals: our format should be _concatenatable_, _self-contained_, and _maximally-compatible_. Achieving all three of these goals is impossible for a single MP4 format due to restrictions in the spec. To resolve this, MUXL introduces two presentation formats, which bridge the gap between our base format and media playback software. These presentation formats are prepended onto the canonical MUXL segments themselves, providing maximal compatibility while leaving the underlying format intact.

## Design goals

-   **Concatenatable:** it's really nice if our segments can be naively combined by adding new bytes to the end. It lets us use BLAKE-3 hashing (\[[blake3](#ref-blake3)\]) and BDASL CIDs (\[[bdasl](#ref-bdasl)\]) for verifiable transfer of subsets of the input.
-   **Self-contained:** Every piece of media needs to be self-contained, independently playable and interpretable without other external data. (HLS spells this property `EXT-X-INDEPENDENT-SEGMENTS`.) This is important to make our segments self-certifying and prevent bad actors from distorting the data.
-   **Maximally-compatible:** We don't want to invent a new bespoke media format. A long video should present to users as one big MP4 file.

## Base Format: MUXL fragments

The foundational format of MUXL is the <dfn id="dfn-muxl-fragment">MUXL fragment</dfn>. Incoming frames are stripped of all metadata and wrapped in a CMAF format inspired by moq-lite's Hang CMAF format (\[[hang](#ref-hang)\]). The MP4 atoms are:

```
[moof][mdat]
```

Once incoming data is wrapped like this, it's _minted_ and may never change. All derived formats work with these; this is the "minting" process for MUXL. Each fragment has exactly two pieces of metadata: a decoding timestamp and a sequence number.

Technical details

A fragment is one `moof` followed by one `mdat`, carrying exactly one sample.

-   `moof` contains exactly one `mfhd` and one `traf`.
-   `mfhd.sequence_number`: per-track, 1-based, +1 per fragment within the track.
-   `traf` contains exactly `tfhd`, `tfdt`, and `trun`:
    -   `tfhd`: `track_id`; `flags = 0x020000` (`default-base-is-moof`); no default sample values.
    -   `tfdt.base_media_decode_time`: absolute decode time of the sample, in the track's media timescale.
    -   `trun`: one sample. Flags `data_offset | sample_duration | sample_size | sample_flags`, plus `sample_composition_time_offset` iff the composition offset is non-zero. `data_offset` is measured from the start of `moof` to the sample bytes in `mdat`.
-   `sample_flags`: sync sample (keyframe) = `0x02000000`; non-sync = `0x01010000`.
-   `mdat`: one sample's encoded bytes; 8-byte header (size + `mdat`) then payload.

## Segmentation Format: MUXL segments

Unfortunately, MUXL fragments can't be played without some additional metadata. The raw video data is present, but the media data, such as the resolution, orientation, and pixel format is absent. We borrow another term from Hang (\[[hang](#ref-hang)\]) and call this the "catalog data".

Traditionally in MP4 and CMAF, this would be provided from "init segment" data: basically an MP4 file header containing a `moov` atom that identifies the media type. Usually, this init segment is provided out-of-band in an HLS playlist. That doesn't work for us because it means our segments are no longer self-contained. And doing it in-band doesn't work either: an MP4 file cannot contain multiple `ftyp` and `moov` atoms, so we'd be breaking concatenatability.

We've instead opted to include the catalog data as CBOR and prepend it to every segment using BMFF's path for generic extensibility: the `uuid` atom. This makes a small size tradeoff; each MUXL segment for a stream now contains redundant catalog data, but this is necessary to make the segments self-contained. As a bonus, we can use the presence of the `uuid` atom as a segmentation heuristic; when you encounter a `uuid` atom in a MUXL stream you know you've encountered a new self-contained set of fragments.

When minting new segments that contain video, it is encouraged to cut all tracks based on video keyframe boundaries to facilitate efficient playback. Video segments should not be minted without keyframe data. Audio-only segments without a reference video track should segment at 1-second intervals.

So, this gives us the definition of a <dfn id="dfn-muxl-segment">MUXL segment</dfn>: a `uuid` atom containing the catalog data followed by some MUXL fragments for one track of the input stream. To make this as minimal and deterministic as possible, we encode it with DRISL CBOR (\[[drisl](#ref-drisl)\]). So, a MUXL segment becomes:

```
[uuid-muxl][moof][mdat][moof][mdat][moof][mdat]....
```

This segment is now a self-contained `.m4s` file, suitable as a signing target and also freely concatenatable with other MUXL segments. Multiple tracks may be combined in a single blob by interleaving segments by timestamp.

Technical details

`uuid` identifier: `e6404ea2-8f01-4305-98da-7bec3c2a9173`. The box body is a DRISL-encoded catalog and nothing else.

A canonical segment's catalog is single-track: exactly one entry under `video.renditions` _or_ one under `audio.renditions`, never both.

```
Catalog {
  video?: { renditions: { <name>: VideoConfig }, display?, rotation?, flip? }
  audio?: { renditions: { <name>: AudioConfig } }
}
```

-   **VideoConfig**: `codec` (WebCodecs string), `container`, `description?` (`avcC`/`av1C` bytes — CBOR byte string, hex in JSON), `codedWidth`, `codedHeight`, `displayAspectWidth?`/`displayAspectHeight?`, and playback hints (`framerate?`, `bitrate?`, …).
-   **AudioConfig**: `codec`, `container`, `description?` (`dOps`/`esds`), `sampleRate`, `numberOfChannels`, and playback hints.
-   **container**: `{ kind: "cmaf", timescale: u32, trackId: u32 }` — currently the only framing MUXL defines; others may be added later.

Boundaries: a new segment begins at every video sync sample; audio samples join the GoP they overlap; audio-only streams cut at 1-second spans.

## Self-certifying Format: S2PA

The full methodology for signing is part of the C2PA and S2PA (\[[s2pa](#ref-s2pa)\]) specs and exceeds this documentation; all we need to know is that they're going to include another `uuid` atom containing the signing and provenance data. So, our format is now:

```
[uuid-c2pa][uuid-muxl][moof][mdat][moof][mdat]....
```

This constitutes the only optionality in the MUXL spec: segments may be prepended with additional `uuid` atoms as required by the use case. This allows the MUXL spec itself to stay minimal while providing the necessary extension points.

Technical details

Prepended `uuid` boxes sit ahead of the MUXL `uuid`; the segment's `moof+mdat` bytes are unchanged, and the manifest's BMFF hash assertion covers them. Signature construction is specified by \[[s2pa](#ref-s2pa)\].

## Presentation Formats: MP4 and fMP4

What we have now are `.m4s` files: CMAF fragment data alongside the catalog data necessary to play them. But we just invented this format so no video players are actually capable of playing it yet. To facilitate actual playback, we introduce two presentation formats: fMP4 and Flat MP4. Both presentation formats work by reading the catalog data from the segments and synthesizing an MP4 header that is prepended to the MUXL segments. The bytes of the segments themselves remain unaltered and are easily recoverable by stripping all of the generated metadata through to the first `uuid` atom. Because neither format actually modifies the canonical MUXL segments, any hash or signature over that segment stays valid as soon as you discard the presentation header.

### fMP4

This is the most "MP4-native" way to present MUXL data, and fits perfectly with our MUXL segments. An "empty" `moov` atom is synthesized that provides the track codec data. This makes the `[moof][mdat]` fragments intelligible to software as a regular CMAF stream. This is a useful format as it's fully-streamable: an fMP4 header may be followed by an arbitrary and increasing number of MUXL segments and is primarily useful in livestreaming use cases. There's no finalization step, either: the file is a valid, playable MP4 at every moment, even mid-broadcast — so a 24-hour stream, or one cut short by a crash, is always a complete file right up to its last whole segment.

The downside of fMP4 is that it's a much newer format, less compatible with media software. And even when software does support them, they're not very nice to work with; seeking around a large fMP4 file is very slow because there's no index of segments. Wouldn't it be nice if we could just have a regular MP4 file?

Technical details

Init segment = `ftyp` + `moov` with empty sample tables.

-   `ftyp`: `major_brand = muxl`, `minor_version = 0`, `compatible_brands = [muxl, isom, iso2]`.
-   `moov` = `mvhd` + one `trak` per track (sorted by `track_id`) + `mvex`. No `udta`, `meta`, `iods`, `free`/`skip`.
-   `mvhd`: `version 0`, zero timestamps, `timescale = 1000`, `duration = 0`, identity matrix, `next_track_id = max(track_id) + 1`.
-   `mvex`: one `trex` per track, `default_sample_description_index = 1`, all other defaults `0` (every sample value is explicit in `trun`).
-   `trak` = `tkhd` (`flags = 3`; `width`/`height` for video, `0` for audio) + `mdia`.
-   `mdia` = `mdhd` (`timescale` passed through from source, `language = "und"`) + `hdlr` (`vide`/`soun`, empty name) + `minf`.
-   `minf` = `vmhd` (video) or `smhd` (audio), `dinf`\>`dref`\>`url` (self-contained), and `stbl` with `stsd` populated and all other tables empty.

No `edts`: a track's presentation offset rides on its first fragment's `tfdt`.

### Flat MP4

(Also known as "just a regular MP4 file.") MUXL MP4s build off a format developed for OBS called "Hybrid MP4" (\[[obs-hybrid-mp4](#ref-obs-hybrid-mp4)\]). This type of synthesized MP4 header performs a full scan of the file and builds a sample index: a table of the precise byte offset of every frame, letting playback software seek smoothly around the file. All the less-compatible fMP4 apparatus (the `[moof][mdat]` pairs) are stepped right over by that index, resulting in an extremely compatible media format without any alteration of the actual MUXL byte stream.

Technical details

Same `ftyp` as the fMP4. The `moov` reuses the init-segment boxes but with populated sample tables, real durations, and _no_ `mvex`, followed by one outer `mdat` envelope.

-   `stbl` per track: `stsd` (as init); `stts` (run-length durations); `ctts` (only if any composition offset ≠ 0; version 1, signed); `stsz` (uniform or per-sample); `stsc` (single entry, one sample per chunk); `co64` (one offset per sample, always 64-bit); `stss` (sync indices, video only, omitted when every sample is a sync sample).
-   `co64` offsets point _inside_ the envelope — past each segment's leading `uuid` and each fragment's `moof` — straight at the sample bytes.
-   Outer `mdat`: always the 64-bit `largesize` form (16-byte header). Payload is the canonical-segment stream, verbatim.
-   `elst`: synthesized only for a track with a non-zero presentation offset — two entries (empty edit `media_time = -1`, then normal play `media_time = 0`); otherwise no `edts`.

Interleaving: for each GoP, all tracks' segments contiguously (ordered by `track_id`), then the next GoP.

## References

<dfn id="ref-bdasl">\[bdasl\]</dfn>

Robin Berjon, Brendan O'Brien, & Juan Caballero. [Big DASL (BDASL)](https://dasl.ing/bdasl.html). 2026-07-14. URL: [https://dasl.ing/bdasl.html](https://dasl.ing/bdasl.html)

<dfn id="ref-blake3">\[blake3\]</dfn>

J-P. Aumasson, S. Neves, J. O'Connor, Z. Wilcox. [The BLAKE3 Hashing Framework](https://www.ietf.org/archive/id/draft-aumasson-blake3-00.html). July 2024. URL: [https://www.ietf.org/archive/id/draft-aumasson-blake3-00.html](https://www.ietf.org/archive/id/draft-aumasson-blake3-00.html)

<dfn id="ref-cid">\[cid\]</dfn>

Robin Berjon & Juan Caballero. [Content IDs (CIDs)](https://dasl.ing/cid.html). 2026-07-14. URL: [https://dasl.ing/cid.html](https://dasl.ing/cid.html)

<dfn id="ref-drisl">\[drisl\]</dfn>

Robin Berjon & Juan Caballero. [DRISL — Deterministic Representation for Interoperable Structures & Links](https://dasl.ing/drisl.html). 2026-07-14. URL: [https://dasl.ing/drisl.html](https://dasl.ing/drisl.html)

<dfn id="ref-hang">\[hang\]</dfn>

L. Curley. [Hang: a simple, WebCodecs-based media format utilizing MoQ](https://doc.moq.dev/concept/layer/hang). URL: [https://doc.moq.dev/concept/layer/hang](https://doc.moq.dev/concept/layer/hang)

<dfn id="ref-obs-hybrid-mp4">\[obs-hybrid-mp4\]</dfn>

Rodney. [Writing an MP4 Muxer for Fun and Profit](https://obsproject.com/blog/obs-studio-hybrid-mp4). OBS Project, July 2024. URL: [https://obsproject.com/blog/obs-studio-hybrid-mp4](https://obsproject.com/blog/obs-studio-hybrid-mp4)

<dfn id="ref-s2pa">\[s2pa\]</dfn>

Eli Mallon. [S2PA — Simple Standard for Provenance and Authenticity](https://dasl.ing/s2pa.html). 2026-07-14. URL: [https://dasl.ing/s2pa.html](https://dasl.ing/s2pa.html)