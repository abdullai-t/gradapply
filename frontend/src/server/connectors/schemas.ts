/**
 * Co-located zod schemas for the connectors API.
 *
 * Connectors are simple OAuth flows whose request payloads are URL-encoded
 * params from Google (handled inline in the callback handlers via
 * `URLSearchParams`), so there are no JSON body schemas to share with the
 * client today. This file exists for parity with other features and as the
 * landing spot if/when we add JSON-bodied connector mutations.
 */
export {};
