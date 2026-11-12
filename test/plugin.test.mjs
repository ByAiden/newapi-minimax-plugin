// Runs the plugin's hooks the way the gateway calls them: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.utils = {
  fetch: () => {
    throw new Error("utils.fetch is not available");
  },
};

const plugin = await import("../plugin.js");
const { meta, native, protocols } = plugin;

const BASE = "https://api.minimax.io";

function driver(intent, extra) {
  return Object.assign(
    { requestBody: intent.requestBody, action: intent.action, model: intent.model, upstreamModel: intent.model, baseUrl: BASE, apiKey: "sk-test", upstream: { kind: "vendor" }, config: {}, files: [], publicTaskId: "task_pub" },
    extra || {},
  );
}

function jsonCtx(value, extra) {
  return Object.assign({ body: { kind: "json", value: value } }, extra || {});
}

function imageProtocol(operation, value, model) {
  return protocols.openai_image.decodeRequest(jsonCtx(value, { operation: operation, model: model || "MiniMax-H3-Image" }));
}

const SUCCESS_BODY = {
  created: 1792308678,
  data: [
    { url: "https://cdn.example.com/0.jpg", size: "2720x1536", revised_prompt: "a cat, warm light" },
    { error: { code: "1027", message: "output image failed content safety check" } },
  ],
  output_format: "jpeg",
  usage: {
    generated_images: 1,
    total_tokens: 7254,
    input_tokens: 3174,
    output_tokens: 4080,
    input_tokens_details: { text_tokens: 3174, image_tokens: 0 },
    output_tokens_details: { image_tokens: 4080 },
  },
  request_id: "req",
};

test("manifest declares the H3 video and H3 image models only", () => {
  assert.equal(meta.apiVersion, 1);
  assert.equal(meta.key, "hailuo");
  assert.match(meta.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(meta.models, ["MiniMax-H3", "MiniMax-H3-Image", "MiniMax-H3-Image-Highspeed"]);
  for (const name of ["MiniMax-Hailuo-2.3", "MiniMax-Hailuo-02", "T2V-01", "I2V-01"]) assert.ok(!JSON.stringify(meta).includes(name));
  const keys = Object.keys(meta.usageSchema).sort();
  for (const example of meta.usageExamples) assert.deepEqual(Object.keys(example.facts).sort(), keys);
  for (const profile of meta.usageProfiles) {
    assert.ok(profile.examples.length);
    for (const model of profile.models) assert.ok(meta.models.includes(model));
    for (const example of profile.examples) assert.deepEqual(Object.keys(example.facts).sort(), Object.keys(profile.schema).sort());
  }
  const covered = meta.usageProfiles.flatMap((profile) => profile.models).sort();
  assert.deepEqual(covered, meta.models.slice().sort());
  assert.ok(!JSON.stringify(meta.description).includes("$"));
  assert.deepEqual(
    meta.protocols.map((p) => [p.name, p.models]),
    [
      ["openai_responses", ["MiniMax-H3"]],
      ["openai_video", ["MiniMax-H3"]],
      ["openai_image", ["MiniMax-H3-Image", "MiniMax-H3-Image-Highspeed"]],
    ],
  );
  assert.ok(!meta.routes.some((route) => route.path.startsWith("/v1/video") || route.path.includes("/files/") || route.path.includes("/v1/query")));
});

test("text to image sends MiniMax's body and reserves the requested output", () => {
  const intent = imageProtocol("generate", { model: "MiniMax-H3-Image", prompt: "A cat", size: "2720x1536", n: 2, response_format: "b64_json", user: "u1" });
  assert.equal(intent.action, "text_to_image");
  const request = plugin.buildSubmitRequest(driver(intent));
  assert.equal(request.url, BASE + "/v1/images/generations");
  assert.equal(request.headers.Authorization, "Bearer sk-test");
  // The host answers b64_json itself, so MiniMax always returns URLs.
  assert.deepEqual(request.body, { model: "MiniMax-H3-Image", prompt: "A cat", n: 2, size: "2720x1536" });
  const facts = plugin.extractUsage(driver(intent));
  assert.deepEqual(facts, { image_input_text_tokens: 2 * (5 + 8192), image_input_image_tokens: 0, image_output_tokens: 2 * 4080, image_count: 2 });
  assert.deepEqual(plugin.extractUsage(Object.assign(driver(intent), { usagePurpose: "billing_ratios" })), { image_count: 2 });
});

test("auto size reserves the area level, 4K by default", () => {
  const facts = (value) => plugin.extractUsage(driver(imageProtocol("generate", Object.assign({ model: "MiniMax-H3-Image", prompt: "x" }, value))));
  assert.equal(facts({}).image_output_tokens, 16384);
  assert.equal(facts({ area: "2K", aspect_ratio: "16:9" }).image_output_tokens, 4096);
  assert.equal(facts({ size: "auto", area: "1K" }).image_output_tokens, 1024);
});

test("image requests MiniMax would reject fail before billing", () => {
  const bad = [
    [{ prompt: " " }, /prompt is required/],
    [{ prompt: "x", n: 11 }, /n must be an integer between 1 and 10/],
    [{ prompt: "x", size: "100x100" }, /pixels/],
    [{ prompt: "x", size: "4000x1000" }, /aspect ratio/],
    [{ prompt: "x", size: "2048x2048", area: "2K" }, /cannot be set/],
    [{ prompt: "x", aspect_ratio: "4:1" }, /aspect_ratio/],
    [{ prompt: "x", area: "8K" }, /area/],
    [{ prompt: "x", output_format: "gif" }, /output_format/],
    [{ prompt: "x", disable_prompt_enhanced: true }, /requires a WIDTHxHEIGHT size/],
    [{ prompt: "x", stream: true }, /stream is not supported/],
    [{ prompt: "x", image: "https://a/b.png" }, /only valid on \/v1\/images\/edits/],
    [{ prompt: "x", mask: "m" }, /mask/],
    [{ prompt: "x", background: "transparent" }, /background/],
    [{ prompt: "x", seed: 3 }, /seed is not supported/],
  ];
  for (const [value, pattern] of bad) assert.throws(() => imageProtocol("generate", Object.assign({ model: "MiniMax-H3-Image" }, value)), pattern);
  assert.doesNotThrow(() => imageProtocol("generate", { model: "MiniMax-H3-Image", prompt: "x", disable_prompt_enhanced: true, aspect_ratio: "3:4" }));
});

test("JSON edits send references as images[].image_url", () => {
  const intent = imageProtocol("edit", {
    model: "MiniMax-H3-Image-Highspeed",
    prompt: "Swap the cat for the dog",
    image: ["https://example.com/cat.jpg", "mm_file://123"],
    images: [{ image_url: "data:image/png;base64,AAAA" }],
    size: "auto",
  }, "MiniMax-H3-Image-Highspeed");
  assert.equal(intent.action, "image_to_image");
  const request = plugin.buildSubmitRequest(driver(intent));
  assert.equal(request.url, BASE + "/v1/images/edits");
  assert.deepEqual(request.body.images, [{ image_url: "https://example.com/cat.jpg" }, { image_url: "mm_file://123" }, { image_url: "data:image/png;base64,AAAA" }]);
  assert.equal(request.body.model, "MiniMax-H3-Image-Highspeed");
  const facts = plugin.extractUsage(driver(intent));
  assert.equal(facts.image_input_image_tokens, 3 * 6144);
  assert.equal(facts.image_input_text_tokens, 24 + 3 * 6144);
  assert.throws(() => imageProtocol("edit", { model: "MiniMax-H3-Image", prompt: "x" }), /images must hold 1 to 16/);
  assert.throws(() => imageProtocol("edit", { model: "MiniMax-H3-Image", prompt: "x", image: "ftp://a" }), /HTTP\(S\) URL/);
  assert.throws(() => imageProtocol("edit", { model: "MiniMax-H3-Image", prompt: "x", image: "https://a/b.png", disable_prompt_enhanced: true }), /not supported on image edits/);
  const many = Array.from({ length: 17 }, (_, i) => "https://a/" + i + ".png");
  assert.throws(() => imageProtocol("edit", { model: "MiniMax-H3-Image", prompt: "x", image: many }), /1 to 16/);
});

test("multipart edits turn uploads into data URL placeholders", () => {
  const intent = protocols.openai_image.decodeRequest({
    operation: "edit",
    model: "MiniMax-H3-Image",
    body: {
      kind: "multipart",
      fields: { prompt: ["Make it night"], n: ["2"], output_compression: ["80"], "image[]": ["https://example.com/ref.png"] },
      files: [
        { field: "image[]", ref: "request_file:image[]", mimeType: "image/JPEG" },
        { field: "image[]", ref: "request_file:image[]#1", mimeType: "" },
      ],
    },
  });
  const body = plugin.buildSubmitRequest(driver(intent)).body;
  assert.equal(body.n, 2);
  assert.equal(body.output_compression, 80);
  assert.deepEqual(body.images, [
    { image_url: "https://example.com/ref.png" },
    { image_url: { __fileRef: "request_file:image[]", encoding: "dataUrl", mimeType: "image/jpeg", maxBytes: 67108864 } },
    { image_url: { __fileRef: "request_file:image[]#1", encoding: "dataUrl", mimeType: "image/png", maxBytes: 67108864 } },
  ]);
});

test("a synchronous reply completes at once and settles on MiniMax's usage", () => {
  const intent = imageProtocol("generate", { model: "MiniMax-H3-Image", prompt: "A cat", n: 2 });
  const ctx = driver(intent);
  const parsed = plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: SUCCESS_BODY });
  assert.equal(parsed.taskId, "task_pub");
  assert.deepEqual(parsed.immediate, { status: "SUCCESS", progress: "100%", url: "https://cdn.example.com/0.jpg" });
  const query = { taskId: "task_pub", publicTaskId: "task_pub", model: "MiniMax-H3-Image", upstreamModel: "MiniMax-H3-Image", data: SUCCESS_BODY };
  assert.deepEqual(plugin.extractUsageOnComplete(query, parsed.immediate, SUCCESS_BODY), {
    image_input_text_tokens: 3174,
    image_input_image_tokens: 0,
    image_output_tokens: 4080,
    image_count: 1,
  });
  assert.deepEqual(plugin.extractUsageOnSubmit(ctx, SUCCESS_BODY), { image_count: 1 });
  const rendered = protocols.openai_image.render({}, { task_id: "task_pub", status: "SUCCESS", data: SUCCESS_BODY });
  assert.deepEqual(rendered, { data: [{ url: "https://cdn.example.com/0.jpg", revised_prompt: "a cat, warm light" }], created: 1792308678, output_format: "jpeg" });
  // The native reply carries every image and failure as MiniMax sent it.
  assert.deepEqual(native.imageCreated({}, { data: SUCCESS_BODY }), SUCCESS_BODY);
});

test("a reply without images fails with MiniMax's reason", () => {
  const intent = imageProtocol("generate", { model: "MiniMax-H3-Image", prompt: "A cat" });
  const body = { data: [{ error: { code: "1027", message: "output image failed content safety check" } }], usage: { generated_images: 0 } };
  assert.throws(() => plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: body }), /content safety check \(1027\)/);
});

test("usage without details counts the delivered images", () => {
  const body = { data: [{ url: "https://a/0.jpg" }, { url: "https://a/1.jpg" }] };
  assert.deepEqual(plugin.extractUsageOnComplete({ model: "MiniMax-H3-Image", upstreamModel: "MiniMax-H3-Image" }, {}, body), { image_count: 2 });
});

test("native image routes pass MiniMax's body through", () => {
  const value = { model: "MiniMax-H3-Image", prompt: "A cat", response_format: "b64_json", output_format: "png", n: 1, size: "2048x2048" };
  const intent = native.createImage(jsonCtx(value));
  const request = plugin.buildSubmitRequest(driver(intent));
  assert.deepEqual(request.body, value);
  const edit = native.editImage(jsonCtx({ model: "MiniMax-H3-Image", prompt: "x", images: [{ image_url: "https://a/b.png" }] }));
  assert.equal(plugin.buildSubmitRequest(driver(edit)).url, BASE + "/v1/images/edits");
  assert.throws(() => native.createImage(jsonCtx({ model: "MiniMax-H3-Image", prompt: "x", stream: true })), /stream/);
  assert.throws(() => native.createImage({ body: { kind: "multipart", fields: {}, files: [] } }), /JSON body required/);
});

test("a mapped image model sends the upstream name", () => {
  const intent = imageProtocol("generate", { model: "my-image", prompt: "x" }, "my-image");
  const request = plugin.buildSubmitRequest(driver(intent, { model: "my-image", upstreamModel: "MiniMax-H3-Image-Highspeed" }));
  assert.equal(request.body.model, "MiniMax-H3-Image-Highspeed");
  assert.equal(request.url, BASE + "/v1/images/generations");
});

test("a New API upstream is called under /hailuo", () => {
  const image = imageProtocol("generate", { model: "MiniMax-H3-Image", prompt: "x" });
  assert.equal(plugin.buildSubmitRequest(driver(image, { upstream: { kind: "new_api" } })).url, BASE + "/hailuo/v1/images/generations");
  const video = protocols.openai_video.decodeRequest(jsonCtx({ prompt: "A fox" }, { model: "MiniMax-H3" }));
  assert.equal(plugin.buildSubmitRequest(driver(video, { upstream: { kind: "new_api" } })).url, BASE + "/hailuo/v2/video_generation");
  assert.equal(plugin.buildQueryRequest({ taskId: "abc", baseUrl: BASE, apiKey: "k", upstream: { kind: "new_api" } }).url, BASE + "/hailuo/v2/query/video_generation/abc");
});

test("H3 text to video builds the /v2 body and reserves the request", () => {
  const intent = protocols.openai_video.decodeRequest(jsonCtx({ prompt: "A fox in snow", seconds: 8, size: "2K" }, { model: "MiniMax-H3" }));
  assert.equal(intent.action, "text_to_video");
  const request = plugin.buildSubmitRequest(driver(intent));
  assert.equal(request.url, BASE + "/v2/video_generation");
  assert.deepEqual(request.body, { model: "MiniMax-H3", content: [{ type: "text", text: "A fox in snow" }], resolution: "2K", duration: 8, ratio: "16:9" });
  assert.deepEqual(plugin.extractUsage(driver(intent)), { seconds: 8, resolution: "2K", input_images: 0, input_video_seconds: 0 });
  assert.equal(plugin.extractUsage(Object.assign(driver(intent), { usagePurpose: "billing_ratios" })), null);
  assert.throws(() => protocols.openai_video.decodeRequest(jsonCtx({ prompt: "x", seconds: 20 }, { model: "MiniMax-H3" })), /between 4 and 15/);
  assert.throws(() => protocols.openai_video.decodeRequest(jsonCtx({ prompt: "x", size: "1080P" }, { model: "MiniMax-H3" })), /768P or 2K/);
});

test("H3 image to video uses an uploaded input_reference as the first frame", () => {
  const intent = protocols.openai_video.decodeRequest({ model: "MiniMax-H3", body: { kind: "multipart", fields: { prompt: ["Wave"], seconds: ["6"] }, files: [{ field: "input_reference" }] } });
  assert.equal(intent.action, "image_to_video");
  const body = plugin.buildSubmitRequest(driver(intent)).body;
  assert.equal(body.ratio, "adaptive");
  assert.deepEqual(body.content[1], { type: "image_url", role: "first_frame", image_url: { url: { __fileRef: "request_file:input_reference", encoding: "dataUrl", maxBytes: 20971520 } } });
});

test("Responses requests make H3 videos", () => {
  const intent = protocols.openai_responses.decodeRequest(jsonCtx({ model: "MiniMax-H3", input: [{ role: "user", content: [{ type: "input_text", text: "A fox" }, { type: "input_image", image_url: "https://a/f.png" }] }] }));
  assert.equal(intent.action, "image_to_video");
  assert.equal(plugin.buildSubmitRequest(driver(intent)).body.content[1].role, "first_frame");
});

test("native H3 tasks submit, poll and download as before", () => {
  const value = { model: "MiniMax-H3", content: [{ type: "text", text: "A fox" }], duration: 6, resolution: "768P" };
  const intent = native.createH3Task(jsonCtx(value));
  assert.deepEqual(plugin.buildSubmitRequest(driver(intent)).body, value);
  assert.deepEqual(plugin.extractUsage(driver(intent)), { seconds: 6, resolution: "768P", input_images: 0, input_video_seconds: 0 });
  assert.throws(() => native.createH3Task(jsonCtx(Object.assign({ callback_url: "https://x" }, value))), /callback_url/);
  const created = plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: { task_id: "mm1" } });
  assert.deepEqual(created, { taskId: "mm1", taskData: { task_id: "mm1" } });
  assert.equal(plugin.buildQueryRequest({ taskId: "mm1", baseUrl: BASE, apiKey: "k", upstream: { kind: "vendor" } }).url, BASE + "/v2/query/video_generation/mm1");
  const done = { task: { status: "succeeded", resolution: "768P", content: { url: "https://cdn/v.mp4" }, usage: { output_seconds: 6, input_image_count: 0, input_seconds: 0 } } };
  assert.deepEqual(plugin.parseTaskResult({}, done), { code: 0, status: "SUCCESS", progress: "100%", url: "https://cdn/v.mp4" });
  assert.deepEqual(plugin.parseTaskResult({}, { task: { status: "running" } }).status, "IN_PROGRESS");
  assert.equal(plugin.parseTaskResult({}, { task: { status: "failed", error: { message: "bad" } } }).reason, "bad");
  assert.throws(() => plugin.parseTaskResult({}, { error: { message: "busy", http_code: "429" } }), /busy/);
  assert.equal(plugin.parseTaskResult({}, { status: "Success" }).status, "UNKNOWN");
  assert.deepEqual(plugin.extractUsageOnComplete({ model: "MiniMax-H3", upstreamModel: "MiniMax-H3" }, {}, done), { resolution: "768P", seconds: 6, input_images: 0, input_video_seconds: 0 });
  const task = { status: "SUCCESS", data: done };
  assert.deepEqual(plugin.listArtifacts(task), [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  assert.deepEqual(plugin.buildContentRequest({ artifactKey: "video", data: done, clientRequest: { method: "GET" } }), { url: "https://cdn/v.mp4", method: "GET", credentialless: true });
  assert.deepEqual(native.h3TaskStatus({}, { task_id: "task_x", status: "IN_PROGRESS", data: { task_id: "mm1" } }), { task: { id: "task_x", status: "running" } });
});

test("errors come back in MiniMax's typed format", () => {
  assert.deepEqual(native.error({ path: "/v1/images/generations" }, { httpStatus: 400, message: "bad", requestId: "r" }), {
    type: "error",
    error: { type: "bad_request_error", message: "bad", http_code: "400" },
    request_id: "r",
  });
  assert.equal(native.error({}, { httpStatus: 402, message: "m" }).error.type, "insufficient_balance_error");
  assert.equal(native.error({}, { httpStatus: 503, message: "m" }).error.type, "server_error");
});
