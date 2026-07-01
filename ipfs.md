# IPFS Interoperability Considerations

DASL components are designed to be small and to the extent possible self-contained. Because of that, despite having roots in IPFS, no DASL component depends on traditional IPFS implementations. In many cases, systems produced to work with DASL will interoperate with IPFS, but DASL's independence means that there can occasionally be impedance mismatch. This document is a non-normative list of things to consider when using DASL with IPFS systems, particularly with ones based on the DHT and Bitswap.

## Amino / Bitswap Compatibility

If you're interoperating with Amino (or other DHTs with similar properties) or need to use Bitswap:

Block size

Nothing in DASL assumes a maximum block size, but Bitswap does. DASL does not have a built-in solution to break files into blocks (and we intend to keep it that way). In order to plan for interop with Bitswap, you will want to do your own splitting and probably to have a metadata wrapper to keep track of the split.