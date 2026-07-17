# RASL — Retrieval of Arbitrary Structures & Links

RASL is a URL scheme used to identify content-addressed DASL resources along with a simple HTTP-based retrieval method.

## Introduction

Content-addressed resources are "self-certifying," which is to say that you don't need any external authority to certify that the content you have when you resolve the identifier is correct: because the identifier contains a hash, you can (and should) verify that you obtained the right content yourself (\[[ipfs-principles](#ref-ipfs-principles)\]). The identifier is enough to certify the content. This has several implications, but two are particularly relevant for this specification:

-   When resolving a content-addressed identifier, you can obtain the content from anyone. It doesn't have to be the content's author. You can even obtain it from entirely untrusted sources — given that you can always certify it, you don't need to trust whoever gives it to you. As a result, the authority part of a URL — the part that can certify the content you get, which is the domain part in an `https` URL — is the CID itself (\[[cid](#ref-cid)\]).
-   Because it doesn't matter where you get content from, content-addressed URLs are inherently transport-independent. There are benefits to agreeing on transport (if only so that people can find one another's content) but as a client, if you know of several potential ways of obtaining a CID you are free to use whichever you prefer or to try several in whatever order.

Taking these aspects into consideration, this specification defines a URL scheme in which the CID is the authority, along with optional hints of potential look-up locations, and defines a retrieval method but does not mandate that RASL retrieval rely on it.

## The `rasl` URL Scheme

RASL URLs look like this: `rasl://bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4/?hint=berjon.com&hint=bsky.app`. This breaks down into the following components:

-   The `rasl` scheme. This is simply used as an entry point into RASL semantics.
-   An authority, which is simply a DASL CID (\[[cid](#ref-cid)\]), here `bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4`.
-   A path (here just `/`) that is empty or `/` and that is expected to be ignored since RASL is only used for raw data retrieval.
-   A query string part, that is parsed according to CGI rules and that contains zero or more `hint` entries, each of which is a host from which that CID can be obtained.

Use the following steps to <dfn id="dfn-parse-a-rasl-url">parse a RASL URL</dfn>:

1.  Accept a string <var>url</var> and parse it according to the [URL Standard](https://url.spec.whatwg.org/#url-parsing) (\[[url](#ref-url)\]).
2.  If that's a failure, return the failure.
3.  Read the `host` part of the parsed URL and store that in <var>cid</var>.
4.  If <var>cid</var> is not a valid CID (\[[cid](#ref-cid)\]), return failure.
5.  Select all the tuples in the query object associated with the URL (\[[url](#ref-url)\]) whose name is exactly `hint`. Each value must match the syntax of a valid host for the `https` scheme and values which do not match this syntax must be ignored and removed from this list. Store the remaining values in <var>hints</var>. If there were none then <var>hints</var> is an empty array.
6.  Return the URL's parts as well as <var>cid</var> and <var>hints</var>.

## Fetching RASL

A user agent may retrieve a CID in whichever way it prefers. This section provides a simple standard for HTTP-based CID retrieval, to make it easy for authors to publish content to their own sites and have it retrieved, without having to worry about operating any infrastructure beyond the web server they already have.

Use the following steps to <dfn id="dfn-fetch-a-rasl-url">fetch a RASL URL</dfn>:

1.  Accept a string <var>url</var> and parse it according to the steps to [parse a RASL URL](#dfn-parse-a-rasl-url).
2.  Construct a <var>request</var> using <var>cid</var> from the <var>url</var> as well as <var>hints</var> that may be from the URL or from elsewhere (this is entirely up to you):
    1.  For each hint, construct a request URL that is the concatenation of `https://`, the hint as host, `/.well-known/rasl/`, and the <var>cid</var>.
    2.  Prepare the request such that it has a method of either `GET` or `HEAD`, that it is stateless (no cookies, no credentials of any kind), and that it uses no content negotiation.
3.  Fetch the <var>request</var>s. How these get prioritised is entirely up to the implementation. It is common to run them all in parallel and abort them with the first success response. Note that the `.well-known` path may redirect, so be ready to handle that. This makes it possible to create sites that are published the usual way and to have a RASL that is simply a redirect to the resource. So for instance, you may have an existing `https://berjon.com/kitten.jpg` the CID for which is `bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4`. This can be published as this RASL URL: `rasl://bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4/?hint=berjon.com`. A client can retrieve it by constructing a request to this URL: `https://berjon.com/.well-known/rasl/bafkreifn5yxi7nkftsn46b6x26grda57ict7md2xuvfbsgkiahe2e7vnq4`. In turn, the latter may simply return a 307 redirect back to `https://berjon.com/kitten.jpg`. (Yes, this is HTTP with extra steps, but the extra steps get you self-certifying content.)
4.  If the response is a redirect but not a 307, the client should treat it as if it had been a 307 anyway.
5.  If none of the responses are successful, return failure.
6.  Set the response's media type to `application/octet-stream`. (The server should have done that already, but may not have done so, notably if it relied on a redirect.) The purpose of RASL is to retrieve data in ways that are independent of the server — any media type processing must therefore take place at another layer. Without this, we lose the self-certifying nature of the system. (Note that servers are encouraged to enforce that so as not to have their RASL endpoints used for general-purpose web serving, which can be a security vector depending on where the data being served came from.)
7.  Produce a CID for the retrieved data. If that CID does not match the requested <var>cid</var>, return failure.
8.  Return the data.

## RASL Pathing

Implementations should ignore paths in RASL URLs. They may be used in a future iteration of this specification.

## References

<dfn id="ref-cid">\[cid\]</dfn>

Robin Berjon & Juan Caballero. [Content IDs (CIDs)](https://dasl.ing/cid.html). 2026-07-17. URL: [https://dasl.ing/cid.html](https://dasl.ing/cid.html)

<dfn id="ref-ipfs-principles">\[ipfs-principles\]</dfn>

Robin Berjon. [IPFS Principles](https://specs.ipfs.tech/architecture/principles/). march 2023. URL: [https://specs.ipfs.tech/architecture/principles/](https://specs.ipfs.tech/architecture/principles/)

<dfn id="ref-url">\[url\]</dfn>

WHATWG. [URL](https://url.spec.whatwg.org/). Living Standard. URL: [https://url.spec.whatwg.org/](https://url.spec.whatwg.org/)