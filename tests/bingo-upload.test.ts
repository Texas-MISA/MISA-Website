import { describe, expect, it } from "vitest";

import {
  declaredLengthWithin,
  fileExtension,
  isSameOriginRequest,
  MAX_UPLOAD_REQUEST_BYTES,
  proofKindOf,
  readBodyWithin,
  withVideoType,
} from "@/lib/bingo";

// House bingo's upload decisions (migration 33), pure: the proof form's file
// typing, and the two gates /admin/bingo/upload puts in front of the write
// cores. No database and no request context; the route's own wiring is pinned
// in tests/bingo-admin.test.ts and was exercised against a dev server.

function file(name: string, type: string, bytes: number[] = [1, 2, 3]): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

// ---------------------------------------------------------------------------
// The uploader's file decisions
// ---------------------------------------------------------------------------

describe("fileExtension", () => {
  it("lowercases what follows the last dot", () => {
    expect(fileExtension("IMG_1234.MOV")).toBe("mov");
    expect(fileExtension("clip.final.v2.Mp4")).toBe("mp4");
  });

  it("is empty with no dot, or nothing after it", () => {
    expect(fileExtension("README")).toBe("");
    expect(fileExtension("trailing.")).toBe("");
    expect(fileExtension("")).toBe("");
  });
});

describe("withVideoType", () => {
  it("keeps a file the browser already typed as a bucket type, as the same object", () => {
    const mp4 = file("clip.mp4", "video/mp4");
    expect(withVideoType(mp4)).toBe(mp4);
    const mov = file("IMG_1.MOV", "video/quicktime");
    expect(withVideoType(mov)).toBe(mov);
  });

  it("types an untyped .MOV as video/quicktime, and .mp4 as video/mp4, in a new File", () => {
    const mov = file("IMG_1.MOV", "", [9, 8, 7, 6]);
    const typedMov = withVideoType(mov);
    expect(typedMov).not.toBe(mov);
    expect(typedMov?.type).toBe("video/quicktime");
    // The same bytes and the same name: only the type Storage will record moves.
    expect(typedMov?.name).toBe("IMG_1.MOV");
    expect(typedMov?.size).toBe(4);

    expect(withVideoType(file("clip.mp4", ""))?.type).toBe("video/mp4");
  });

  it("reads the extension case-insensitively and after the last dot", () => {
    expect(withVideoType(file("CLIP.MP4", ""))?.type).toBe("video/mp4");
    expect(withVideoType(file("trip.2026.10.10.mov", ""))?.type).toBe("video/quicktime");
    // A video extension buried mid-name is not the extension.
    expect(withVideoType(file("clip.mp4.txt", ""))).toBeNull();
  });

  it("refuses a type the bucket does not take, never overriding a reported type", () => {
    expect(withVideoType(file("clip.m4v", "video/x-m4v"))).toBeNull();
    // Even when the extension alone would have passed.
    expect(withVideoType(file("clip.mp4", "video/x-m4v"))).toBeNull();
    expect(withVideoType(file("clip.webm", "video/webm"))).toBeNull();
  });

  it("refuses HEIC and anything else that is not a video", () => {
    expect(withVideoType(file("IMG_1.HEIC", "image/heic"))).toBeNull();
    expect(withVideoType(file("IMG_1.heic", ""))).toBeNull();
    expect(withVideoType(file("notes.pdf", "application/pdf"))).toBeNull();
  });

  it("refuses an untyped file with no extension", () => {
    expect(withVideoType(file("clip", ""))).toBeNull();
  });
});

describe("proofKindOf", () => {
  it("follows the browser's type when there is one", () => {
    expect(proofKindOf(file("a.jpg", "image/jpeg"))).toBe("photo");
    expect(proofKindOf(file("a.png", "image/png"))).toBe("photo");
    expect(proofKindOf(file("a.mp4", "video/mp4"))).toBe("video");
  });

  it("calls HEIC a photo, so the browser's decoder decides whether it opens", () => {
    // Safari decodes HEIC and Chrome cannot; the form words a failed decode.
    expect(proofKindOf(file("IMG_1.HEIC", "image/heic"))).toBe("photo");
    expect(proofKindOf(file("IMG_1.heic", ""))).toBe("photo");
  });

  it("calls any video type a video, which withVideoType then judges", () => {
    // Unchanged from the form: the kind is video, and the bucket's type list
    // is withVideoType's to apply, with its own message.
    expect(proofKindOf(file("clip.m4v", "video/x-m4v"))).toBe("video");
  });

  it("refuses a type that is neither image nor video", () => {
    expect(proofKindOf(file("notes.pdf", "application/pdf"))).toBeNull();
    expect(proofKindOf(file("notes.txt", "text/plain"))).toBeNull();
  });

  it("falls back to the extension, in any case, when the browser reports no type", () => {
    expect(proofKindOf(file("IMG_1.JPG", ""))).toBe("photo");
    expect(proofKindOf(file("scan.page.2.webp", ""))).toBe("photo");
    expect(proofKindOf(file("IMG_1.MOV", ""))).toBe("video");
    expect(proofKindOf(file("clip.mp4", ""))).toBe("video");
    expect(proofKindOf(file("notes.pdf", ""))).toBeNull();
    expect(proofKindOf(file("clip", ""))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The upload request: the host check
// ---------------------------------------------------------------------------

describe("isSameOriginRequest", () => {
  const allowed = (headers: Record<string, string>) =>
    isSameOriginRequest(new Headers(headers));

  it("accepts an Origin whose host is the request's Host", () => {
    expect(allowed({ origin: "http://localhost:3000", host: "localhost:3000" })).toBe(true);
    // Next fills x-forwarded-host from Host when it is absent, so locally the
    // two agree for any address the dev server answers on.
    expect(
      allowed({
        origin: "http://127.0.0.1:3000",
        host: "127.0.0.1:3000",
        "x-forwarded-host": "127.0.0.1:3000",
      })
    ).toBe(true);
    expect(allowed({ origin: "https://www.txmisa.org", host: "www.txmisa.org" })).toBe(true);
  });

  it("holds Origin against the FIRST x-forwarded-host value, trimmed, over Host", () => {
    expect(
      allowed({
        origin: "https://www.txmisa.org",
        "x-forwarded-host": " www.txmisa.org , internal.example",
        host: "internal.example",
      })
    ).toBe(true);
    // A forwarded host that does not match refuses, even when Host would have
    // matched: the same precedence Next's Server Action check uses.
    expect(
      allowed({
        origin: "https://www.txmisa.org",
        "x-forwarded-host": "elsewhere.example",
        host: "www.txmisa.org",
      })
    ).toBe(false);
    // A later forwarded value is not consulted.
    expect(
      allowed({
        origin: "https://www.txmisa.org",
        "x-forwarded-host": "elsewhere.example, www.txmisa.org",
        host: "www.txmisa.org",
      })
    ).toBe(false);
  });

  it("falls back to Host when x-forwarded-host is absent or its first value is empty", () => {
    expect(allowed({ origin: "http://localhost:3000", host: "localhost:3000" })).toBe(true);
    expect(
      allowed({
        origin: "http://localhost:3000",
        "x-forwarded-host": " , localhost:3000",
        host: "localhost:3000",
      })
    ).toBe(true);
  });

  it("refuses a missing Origin, which Next would let through", () => {
    expect(allowed({ host: "localhost:3000" })).toBe(false);
  });

  it('refuses the literal "null" origin', () => {
    expect(allowed({ origin: "null", host: "localhost:3000" })).toBe(false);
    expect(allowed({ origin: "null", host: "null" })).toBe(false);
  });

  it("refuses an Origin that is not a URL", () => {
    expect(allowed({ origin: "not a url", host: "localhost:3000" })).toBe(false);
    expect(allowed({ origin: "localhost:3000", host: "localhost:3000" })).toBe(false);
    expect(allowed({ origin: "", host: "localhost:3000" })).toBe(false);
  });

  it("refuses a different host, or the same host on another port", () => {
    expect(allowed({ origin: "https://evil.example", host: "www.txmisa.org" })).toBe(false);
    expect(allowed({ origin: "http://localhost:3001", host: "localhost:3000" })).toBe(false);
    expect(allowed({ origin: "https://txmisa.org", host: "www.txmisa.org" })).toBe(false);
  });

  it("refuses when the request names no host at all", () => {
    expect(allowed({ origin: "http://localhost:3000" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The upload request: the body cap
// ---------------------------------------------------------------------------

describe("declaredLengthWithin", () => {
  it("lets a missing header through, since the body is counted regardless", () => {
    expect(declaredLengthWithin(null, MAX_UPLOAD_REQUEST_BYTES)).toBe(true);
  });

  it("accepts a plain integer up to the cap, and nothing over it", () => {
    expect(declaredLengthWithin("0", 10)).toBe(true);
    expect(declaredLengthWithin("10", 10)).toBe(true);
    expect(declaredLengthWithin("11", 10)).toBe(false);
    expect(declaredLengthWithin(String(MAX_UPLOAD_REQUEST_BYTES + 1), MAX_UPLOAD_REQUEST_BYTES)).toBe(
      false
    );
    expect(declaredLengthWithin("9".repeat(400), MAX_UPLOAD_REQUEST_BYTES)).toBe(false);
  });

  it("refuses a malformed value rather than ignoring it", () => {
    for (const value of ["", "abc", "-1", "1e3", " 10", "10 ", "0x10", "1.5"]) {
      expect(declaredLengthWithin(value, 100), JSON.stringify(value)).toBe(false);
    }
  });
});

/**
 * A body that arrives in `chunks`, one per read: highWaterMark 0, so nothing
 * is pulled until the reader asks. Counts the pulls, and whether it was
 * cancelled, and can fail part-way like a dropped connection.
 */
function arriving(chunks: number[][], failAt?: number) {
  let pulls = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (failAt !== undefined && pulls === failAt) {
          controller.error(new Error("connection reset"));
          return;
        }
        if (pulls < chunks.length) controller.enqueue(new Uint8Array(chunks[pulls]));
        else controller.close();
        pulls++;
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  return { stream, pulls: () => pulls, cancelled: () => cancelled };
}

describe("readBodyWithin", () => {
  it("returns every byte of a chunked body under the cap, in order", async () => {
    const { stream } = arriving([[1, 2, 3], [4], [5, 6, 7]]);
    const read = await readBodyWithin(stream, 10);
    expect(read.kind).toBe("ok");
    if (read.kind !== "ok") return;
    expect([...read.bytes]).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("accepts a body of exactly the cap", async () => {
    const { stream } = arriving([[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]]);
    expect((await readBodyWithin(stream, 10)).kind).toBe("ok");
  });

  it("refuses a chunked body over the cap at the chunk that crosses it, and reads no further", async () => {
    const body = arriving([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13], [14], [15]]);
    const read = await readBodyWithin(body.stream, 10);
    expect(read.kind).toBe("too_large");
    // The third chunk takes the total to 12: three reads, then a cancel.
    await Promise.resolve();
    expect(body.pulls()).toBe(3);
    expect(body.cancelled()).toBe(true);
  });

  it("calls a stream that fails part-way unreadable", async () => {
    const { stream } = arriving([[1, 2], [3, 4], [5, 6]], 1);
    expect((await readBodyWithin(stream, 10)).kind).toBe("unreadable");
  });

  it("reads no body as empty", async () => {
    const read = await readBodyWithin(null, 10);
    expect(read.kind).toBe("ok");
    if (read.kind === "ok") expect(read.bytes.byteLength).toBe(0);
  });

  it("hands the route bytes that parse back into the form that was sent", async () => {
    // The route reads the body through readBodyWithin and parses the bytes
    // with the request's own Content-Type. Sent in seven-byte pieces here, as
    // a chunked request with no Content-Length would arrive.
    const photoBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const sent = new FormData();
    sent.set("kind", "photo");
    sent.set("house", "m");
    sent.set("position", "7");
    sent.set("expectedUpdatedAt", "");
    sent.set("photo", new File([photoBytes], "photo.jpg", { type: "image/jpeg" }));
    const request = new Request("http://localhost/admin/bingo/upload", {
      method: "POST",
      body: sent,
    });
    const contentType = request.headers.get("content-type") ?? "";
    const raw = [...new Uint8Array(await request.arrayBuffer())];
    const pieces: number[][] = [];
    for (let at = 0; at < raw.length; at += 7) pieces.push(raw.slice(at, at + 7));

    const read = await readBodyWithin(arriving(pieces).stream, MAX_UPLOAD_REQUEST_BYTES);
    expect(read.kind).toBe("ok");
    if (read.kind !== "ok") return;
    const form = await new Response(read.bytes, {
      headers: { "content-type": contentType },
    }).formData();
    expect(form.get("kind")).toBe("photo");
    expect(form.get("house")).toBe("m");
    expect(form.get("position")).toBe("7");
    expect(form.get("expectedUpdatedAt")).toBe("");
    const photo = form.get("photo");
    expect(photo).toBeInstanceOf(File);
    expect((photo as File).type).toBe("image/jpeg");
    expect(new Uint8Array(await (photo as File).arrayBuffer())).toEqual(photoBytes);
  });

  it("caps under the 10 MB Next buffers a proxied body to, so a cut-off body is refused first", () => {
    // proxy.ts matches /admin/bingo/upload, and Next keeps only the first
    // proxyClientMaxBodySize bytes (10 MB by default) of a proxied body. Under
    // that, the counter refuses a body long before truncation could make it
    // look complete.
    expect(MAX_UPLOAD_REQUEST_BYTES).toBeLessThan(10 * 1024 * 1024);
  });
});
