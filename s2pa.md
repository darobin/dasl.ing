# S2PA — Simple Standard for Provenance and Authenticity

S2PA — the Simple Standard for Provenance and Authenticity — extends best-in-class media signing to support the needs of decentralized identity systems. It adds just two things to C2PA: signing with the secp256k1 curve, and a recipe for generating the X.509 certificate C2PA expects directly from a decentralized identifier.

## Introduction

The Coalition for Content Provenance and Authenticity (C2PA) is a media-industry project for embedded provenance metadata. A C2PA manifest is embedded directly in the asset and signed with a private key whose X.509 certificate travels alongside the signature (\[[c2pa](#ref-c2pa)\]).

C2PA is fundamentally a good idea carrying some dated assumptions. The embedded JUMBF manifest and the signature format are solid; the weak link is where trust comes from. A standard C2PA verifier chains the embedded certificate up to a configured certificate authority on a bespoke "trust list". That is the wrong shape for the decentralized web, where we have "user-generated authority, enabled by self-certifying web protocols" (\[[self-certifying](#ref-self-certifying)\]). Identities here are decentralized identifiers (\[[did-core](#ref-did-core)\]): the public key behind one comes either from the identifier itself — a `did:key` (\[[did-key](#ref-did-key)\]) _is_ a public key — or from resolving it, such as with `did:web` (\[[did-web](#ref-did-web)\]). There is no certificate authority to chain to.

S2PA is a narrow extension that makes C2PA work in that world. It is _only_ two things:

-   **secp256k1 signing**, so the keypairs decentralized identity systems already use can sign C2PA manifests directly.
-   **self-certifying certificate generation**: a deterministic recipe for the X.509 leaf certificate C2PA carries, built from a DID and its public key, self-signed, with nothing to chain to.

## secp256k1

The signing change is small. In COSE terms it is ES256K — ECDSA over the secp256k1 curve with SHA-256, COSE algorithm `-47` (\[[rfc8812](#ref-rfc8812)\]) — and the signature is the 64-byte `r ‖ s` P1363 form C2PA already uses for its other ECDSA algorithms, not ASN.1 DER. Concretely, S2PA adds the secp256k1 curve to the two places the C2PA specification enumerates allowed algorithms and key types:

**§13.2.1. Signature Algorithms**

> ECDSA requires elliptic curve keys on the P-256, K-256, P-384, or P-521 elliptic curves.

**§14.5.1.1.**

> If the algorithm field of the certificate's `subjectPublicKeyInfo` is `id-ecPublicKey`, the parameters field shall be one of the following named curves: `prime256v1`, `secp256k1`, `secp384r1`, `secp521r1`.

Signing implementations are encouraged to normalize to the low-S form of the signature for maximal compatibility with secp256k1 verifiers.

## Leaf Certificate

C2PA's manifest format embeds an X.509 leaf certificate alongside the signature. S2PA's leaf is a self-signed, self-issued X.509 v3 certificate whose only meaningful payload is the public key. Every field is either fixed by this specification, derived from the public key, or chosen freely by the signer; no field needs to be trusted by a verifier.

Use the following steps to <dfn id="dfn-build-an-s2pa-leaf-certificate">build an S2PA leaf certificate</dfn> from a 65-byte uncompressed SEC1 secp256k1 public key <var>pubkey</var> (`0x04 || X || Y`) and its corresponding private key:

1.  Accept an additional input <var>did</var>: a DID string (\[[did-core](#ref-did-core)\]) that the signer wishes to bind to the certificate. If <var>did</var> is omitted, set it to the `did:key` (\[[did-key](#ref-did-key)\]) of <var>pubkey</var> — a DID that is itself an encoding of the public key, so verification needs no resolution (see § Identity Binding).
2.  Compute <var>key_id</var> as the SHA-1 hash of the bytes of <var>pubkey</var>, per the `subjectKeyIdentifier` "method 1" of \[[rfc5280](#ref-rfc5280)\] § 4.2.1.2.
3.  Construct an X.509 v3 certificate (\[[rfc5280](#ref-rfc5280)\]) with the following fields:
    -   **version**: `2` (X.509 v3).
    -   **serialNumber**: a positive integer of at most 20 octets. Random or any stable derivation is acceptable; the serial has no S2PA semantics.
    -   **signatureAlgorithm**: `ecdsa-with-SHA256` (`1.2.840.10045.4.3.2`).
    -   **issuer**: a Distinguished Name containing exactly one `commonName` attribute set to <var>did</var>. Other DN attributes (e.g. `organizationName`) are permitted but have no S2PA meaning; some C2PA libraries expect at least one such attribute alongside `commonName` in their cert profile check, and signers targeting those libraries may include one for compatibility.
    -   **subject**: identical to **issuer**.
    -   **validity.notBefore**: any value at or before the issuance time. **validity.notAfter**: any value after **notBefore**. S2PA verifiers do not enforce validity windows; freshness is established by the surrounding application's DID-resolution policy. A common choice is a 100-year window starting at issuance.
    -   **subjectPublicKeyInfo**: algorithm `id-ecPublicKey` (`1.2.840.10045.2.1`) with named-curve parameter `secp256k1` (`1.3.132.0.10`); the `subjectPublicKey` bit string carries <var>pubkey</var> in its 65-byte uncompressed form.
    -   **extensions**:
        -   `basicConstraints` (critical): `cA = FALSE`.
        -   `keyUsage` (critical): `digitalSignature`.
        -   `extendedKeyUsage`: `emailProtection` (`1.3.6.1.5.5.7.3.4`). This is one of the EKU OIDs C2PA accepts on a signing leaf and has no email-related semantic effect in this context.
        -   `subjectKeyIdentifier`: <var>key_id</var>.
        -   `authorityKeyIdentifier`: the same `keyIdentifier` value as `subjectKeyIdentifier` (<var>key_id</var>), since the certificate is self-issued.
4.  Sign the encoded TBSCertificate with the private key corresponding to <var>pubkey</var>, using ECDSA-SHA256.
5.  Return the DER-encoded certificate. C2PA's certificate chain field is set to a single-element chain containing only this certificate.

The certificate is self-issued, self-signed, and has no expected parent. Verifiers must not attempt to chain it to any trust anchor.

The certificate's identity-bearing payload is its public key and the DID in its `commonName`. A verifier must always confirm that the embedded public key validates the manifest signature; depending on the DID method, the verifier may also resolve the DID and confirm consistency with the public key.

## References

<dfn id="ref-c2pa">\[c2pa\]</dfn>

[C2PA Technical Specification](https://c2pa.org/specifications/). Coalition for Content Provenance and Authenticity. URL: [https://c2pa.org/specifications/](https://c2pa.org/specifications/)

<dfn id="ref-did-core">\[did-core\]</dfn>

M. Sporny, D. Longley, M. Sabadello, D. Reed, O. Steele, C. Allen. [Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/). W3C Recommendation, July 2022. URL: [https://www.w3.org/TR/did-core/](https://www.w3.org/TR/did-core/)

<dfn id="ref-did-key">\[did-key\]</dfn>

D. Longley, D. Zagidulin, M. Sporny. [The did:key Method](https://w3c-ccg.github.io/did-method-key/). W3C Credentials Community Group. URL: [https://w3c-ccg.github.io/did-method-key/](https://w3c-ccg.github.io/did-method-key/)

<dfn id="ref-did-web">\[did-web\]</dfn>

[did:web Method Specification](https://w3c-ccg.github.io/did-method-web/). W3C Credentials Community Group. URL: [https://w3c-ccg.github.io/did-method-web/](https://w3c-ccg.github.io/did-method-web/)

<dfn id="ref-rfc5280">\[rfc5280\]</dfn>

D. Cooper, S. Santesson, S. Farrell, S. Boeyen, R. Housley, W. Polk. [Internet X.509 Public Key Infrastructure Certificate and Certificate Revocation List (CRL) Profile](https://www.rfc-editor.org/rfc/rfc5280). May 2008. URL: [https://www.rfc-editor.org/rfc/rfc5280](https://www.rfc-editor.org/rfc/rfc5280)

<dfn id="ref-rfc8812">\[rfc8812\]</dfn>

M. Jones. [CBOR Object Signing and Encryption (COSE) and JSON Object Signing and Encryption (JOSE) Registrations for Web Authentication (WebAuthn) Algorithms](https://www.rfc-editor.org/rfc/rfc8812). August 2020. URL: [https://www.rfc-editor.org/rfc/rfc8812](https://www.rfc-editor.org/rfc/rfc8812)

<dfn id="ref-self-certifying">\[self-certifying\]</dfn>

J. Graber. [Web3 is Self-Certifying](https://jaygraber.medium.com/web3-is-self-certifying-9dad77fd8d81). URL: [https://jaygraber.medium.com/web3-is-self-certifying-9dad77fd8d81](https://jaygraber.medium.com/web3-is-self-certifying-9dad77fd8d81)