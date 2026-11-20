// 2.1: the upstream type channel setting (MiniMax API or an OpenAI-compatible
// relay) and the billable input image fact.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.utils = {
  fetch: () => {
    throw new Error("utils.fetch is not available");
  },
};

const plugin = await import("../plugin.js");
const { meta, native, protocols } = plugin;

const RELAY = "https://relay.example";
const RELAY_CONFIG = { upstreamType: "openai", defaultVoice: "English_Graceful_Lady" };

function driver(intent, extra) {
  return Object.assign(
    {
      requestBody: intent.requestBody,
      action: intent.action,
      model: intent.model,
      upstreamModel: intent.model,
      baseUrl: RELAY,
      apiKey: "test-key",
      authHeader: "test-key",
      upstream: { kind: "vendor" },
      config: RELAY_CONFIG,
      files: [],
      publicTaskId: "task_pub",
    },
    extra || {},
  );
}

function jsonCtx(value, extra) {
  return Object.assign({ method: "POST", path: "/", params: {}, query: {}, requestHeaders: {}, body: { kind: "json", value: value } }, extra || {});
}

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

const imageIntent = (value, operation, model) =>
  protocols.openai_image.decodeRequest(Object.assign({ model: model || "MiniMax-H3-Image", operation: operation || "generate" }, jsonCtx(value)));
const videoIntent = (model, value) => protocols.openai_video.decodeRequest(jsonCtx(Object.assign({ prompt: "A fox" }, value || {}), { model: model }));

// ---------------------------------------------------------------------------
// The setting

test("the upstream type setting has xAI's shape with MiniMax as the default", () => {
  const setting = meta.channelConfig.properties.upstreamType;
  assert.equal(setting.type, "string");
  assert.deepEqual(setting.enum, ["minimax", "openai"]);
  assert.equal(setting.default, "minimax");
  assert.equal(setting.enumTitles.length, 2);
  assert.deepEqual(setting.title, { en: "Upstream type", zh: "上游类型" });
  assert.equal(meta.channelConfig.properties.defaultVoice.default, "English_Graceful_Lady");
  assert.equal(plugin.upstreamType({ config: {} }), "minimax");
  assert.equal(plugin.upstreamType({ config: { upstreamType: "minimax" } }), "minimax");
  assert.equal(plugin.upstreamType({ config: { upstreamType: "openai" } }), "openai");
  assert.equal(plugin.upstreamType({}), "minimax");
  // The relay routes keep MiniMax's paths; the relay type picks its own.
  assert.equal(meta.relay.find((r) => r.incoming_path === "/v1/messages").upstream_path, "/anthropic/v1/messages");
});

test("a relay channel needs the relay's Base URL; MiniMax channels are not checked", () => {
  for (const base of ["", "https://api.minimaxi.com", "https://api.minimax.io/", "https://API.MINIMAX.IO"]) {
    const result = plugin.checkKey({ baseUrl: base, config: { upstreamType: "openai" } }, "k");
    assert.ok(result && result.error && /relay/.test(result.error.en) && result.error.zh, base);
  }
  assert.equal(plugin.checkKey({ baseUrl: RELAY, config: { upstreamType: "openai" } }, "k"), undefined);
  for (const base of ["", "https://api.minimaxi.com", "https://api.minimax.io", RELAY]) assert.equal(plugin.checkKey({ baseUrl: base, config: {} }, "k"), undefined);
});

// ---------------------------------------------------------------------------
// Text

test("Anthropic Messages go to the relay's /v1/messages; chat and Responses keep their paths", () => {
  const relayCtx = (path) => ({ baseUrl: RELAY, path: path, config: RELAY_CONFIG });
  const request = { path: "/v1/messages", upstreamPath: "/anthropic/v1/messages", model: "MiniMax-M3", stream: false, body: {}, headers: {} };
  assert.deepEqual(plugin.prepareRequest(relayCtx("/v1/messages"), request), { path: "/v1/messages" });
  assert.equal(plugin.prepareRequest(relayCtx("/v1/chat/completions"), Object.assign({}, request, { path: "/v1/chat/completions", upstreamPath: "/v1/chat/completions" })), null);
  assert.equal(plugin.prepareRequest(relayCtx("/v1/responses"), Object.assign({}, request, { path: "/v1/responses", upstreamPath: "/v1/responses" })), null);
  // Default mode leaves every request where the route sends it.
  assert.equal(plugin.prepareRequest({ baseUrl: "https://api.minimaxi.com", path: "/v1/messages", config: {} }, request), null);
});

test("Fetch models returns the relay's list as it is", () => {
  const list = { object: "list", data: [{ id: "MiniMax-M3", object: "model", owned_by: "relay-a" }, { id: "gpt-x", object: "model" }, { id: "MiniMax-M3" }] };
  const result = plugin.convertResponse({ baseUrl: RELAY, path: "/v1/models", config: RELAY_CONFIG, state: null }, { status: 200, headers: {}, body: JSON.stringify(list) });
  assert.deepEqual(result.body.data, [
    { id: "MiniMax-M3", object: "model", owned_by: "relay-a" },
    { id: "gpt-x", object: "model", owned_by: "openai-compatible" },
  ]);
  const error = plugin.convertResponse({ baseUrl: RELAY, path: "/v1/models", config: RELAY_CONFIG, state: null }, { status: 401, headers: {}, body: JSON.stringify({ error: { message: "bad key" } }) });
  assert.equal(error.error.status, 401);
  assert.match(error.error.message, /^Relay: bad key/);
});

// ---------------------------------------------------------------------------
// Speech and transcription

const SPEECH = { baseUrl: RELAY, path: "/v1/audio/speech", config: RELAY_CONFIG };

test("speech goes to the relay's /v1/audio/speech as the client sent it", () => {
  const body = deepFreeze({ model: "speech-2.8-hd", input: "Hello", voice: "alloy", response_format: "wav", speed: 1.1, instructions: "calm" });
  const request = plugin.convertRequest(SPEECH, { model: "mapped-speech", stream: false, body: body });
  assert.deepEqual(request, {
    path: "/v1/audio/speech",
    method: "POST",
    body: Object.assign({}, body, { model: "mapped-speech" }),
    stream: false,
    state: { kind: "speech", relay: true, format: "wav", clientStream: false },
  });
  const sse = plugin.convertRequest(SPEECH, { model: "speech-2.8-hd", stream: false, body: { model: "speech-2.8-hd", input: "Hi", stream_format: "sse" } });
  assert.equal(sse.stream, true);
  assert.equal(sse.state.clientStream, true);
  assert.throws(() => plugin.convertRequest(SPEECH, { model: "speech-2.8-hd", body: { model: "speech-2.8-hd", input: "" } }), /input is required/);
});

test("the relay's audio bytes and speech events pass through; its errors keep their status", () => {
  const state = { kind: "speech", relay: true, format: "mp3", clientStream: false };
  const audio = plugin.convertResponse(Object.assign({ state: state }, SPEECH), { status: 200, headers: { "Content-Type": "audio/mpeg" }, bodyBase64: "SUQz" });
  assert.deepEqual(audio, { bodyBase64: "SUQz", contentType: "audio/mpeg" });
  const typed = plugin.convertResponse(Object.assign({ state: Object.assign({}, state, { format: "wav" }) }, SPEECH), { status: 200, headers: {}, bodyBase64: "UklG" });
  assert.equal(typed.contentType, "audio/wav");
  const json = plugin.convertResponse(Object.assign({ state: state }, SPEECH), { status: 200, headers: {}, body: "{}" });
  assert.equal(json.error.status, 502);
  const error = plugin.convertResponse(Object.assign({ state: state }, SPEECH), { status: 429, headers: {}, body: JSON.stringify({ error: { message: "slow down", type: "rate_limit" } }) });
  assert.equal(error.error.status, 429);
  assert.match(error.error.message, /^Relay: slow down/);
  const streamState = Object.assign({}, state, { clientStream: true });
  const ctx = Object.assign({ state: streamState }, SPEECH);
  const delta = JSON.stringify({ type: "speech.audio.delta", audio: "SUQz" });
  assert.deepEqual(plugin.convertStreamEvent(ctx, { data: delta }), { events: [{ data: delta }] });
  const done = JSON.stringify({ type: "speech.audio.done", usage: { input_tokens: 5, output_tokens: 0, total_tokens: 5 } });
  assert.deepEqual(plugin.convertStreamEvent(ctx, { event: "speech.audio.done", data: done }), { events: [{ event: "speech.audio.done", data: done }] });
  assert.deepEqual(plugin.convertStreamEvent(ctx, { done: true }), {});
  assert.equal(plugin.convertStreamEvent(ctx, { data: JSON.stringify({ error: { message: "boom" } }) }).error.message, "Relay: boom");
});

const STT = { baseUrl: RELAY, path: "/v1/audio/transcriptions", config: RELAY_CONFIG };
const FILE = [{ field: "file", filename: "a.mp3", contentType: "audio/mpeg", size: 9 }];

test("transcription goes to the relay's /v1/audio/transcriptions and bills its seconds", () => {
  const request = plugin.convertRequest(STT, deepFreeze({ model: "asr-1.0", stream: false, form: { fields: { model: ["asr-1.0"], response_format: ["verbose_json"], prompt: ["names"] }, files: FILE } }));
  assert.deepEqual(request, {
    path: "/v1/audio/transcriptions",
    method: "POST",
    form: { fields: { model: "asr-1.0", response_format: ["verbose_json"], prompt: ["names"] }, files: [{ field: "file", from: "file" }] },
    stream: false,
    state: { kind: "transcription", relay: true },
  });
  const ctx = Object.assign({ state: request.state }, STT);
  const usage = (seconds) => ({ type: "tokens", input_tokens: seconds, output_tokens: 0, total_tokens: seconds, prompt_tokens: seconds, completion_tokens: 0, seconds: seconds });
  const verbose = plugin.convertResponse(ctx, { status: 200, headers: {}, body: JSON.stringify({ text: "Hi.", duration: 2.04, segments: [] }) });
  assert.deepEqual(verbose.body, { text: "Hi.", duration: 2.04, segments: [], usage: usage(3) });
  const openai = plugin.convertResponse(ctx, { status: 200, headers: {}, body: JSON.stringify({ text: "Hi.", usage: { type: "duration", seconds: 7 } }) });
  assert.deepEqual(openai.body.usage, usage(7));
  // Another gateway with this plugin reports the seconds itself.
  const gateway = plugin.convertResponse(ctx, { status: 200, headers: {}, body: JSON.stringify({ text: "Hi.", usage: usage(4) }) });
  assert.deepEqual(gateway.body.usage, usage(4));
  const plain = plugin.convertResponse(ctx, { status: 200, headers: { "Content-Type": "text/plain" }, body: "Hi." });
  assert.deepEqual(plain, { body: "Hi.", contentType: "text/plain" });
  assert.equal(plugin.convertResponse(ctx, { status: 400, headers: {}, body: JSON.stringify({ error: { message: "bad file" } }) }).error.status, 400);
});

// ---------------------------------------------------------------------------
// Tasks

test("image generation goes to the relay's /v1/images/generations with the upstream model name", () => {
  const intent = imageIntent({ prompt: "A cat", n: 2, size: "1024x1024", output_format: "png" });
  const ctx = driver(intent, { upstreamModel: "relay-image-name" });
  const reserved = plugin.extractUsage(ctx);
  assert.deepEqual(reserved, { image_input_text_tokens: 2 * (5 + 8192), image_input_image_tokens: 0, image_output_tokens: 2 * 4096, image_count: 2 });
  const request = plugin.buildSubmitRequest(ctx);
  assert.equal(request.url, RELAY + "/v1/images/generations");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization, "Bearer test-key");
  assert.deepEqual(request.body, { prompt: "A cat", n: 2, size: "1024x1024", output_format: "png", model: "relay-image-name" });
  assert.equal(request.action, "text_to_image");
  const reply = { created: 1, data: [{ url: "https://cdn.relay.example/a.png" }, { b64_json: "AAAA" }] };
  const parsed = plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: reply });
  assert.equal(parsed.taskId, "task_pub");
  assert.equal(parsed.immediate.status, "SUCCESS");
  assert.deepEqual(parsed.state, { relay: true, perImage: { image_input_text_tokens: 8197, image_input_image_tokens: 0, image_output_tokens: 4096 } });
  const rendered = protocols.openai_image.render({}, { data: reply });
  assert.deepEqual(rendered.data, [{ url: "https://cdn.relay.example/a.png" }, { b64_json: "AAAA" }]);
  assert.throws(() => plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { data: [{ error: { message: "blocked", code: "1026" } }] } }), /blocked/);
});

test("relay image settlement uses the relay's OpenAI usage, else the delivered images at the estimate", () => {
  const intent = imageIntent({ prompt: "A cat", n: 3, size: "1024x1024" });
  const ctx = driver(intent);
  const state = plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { data: [{ url: "https://x/a.png" }] } }).state;
  const task = Object.assign({}, ctx, { state: state });
  const two = [{ url: "https://x/a.png" }, { url: "https://x/b.png" }];
  // MiniMax's own usage shape, as another gateway with this plugin passes it on.
  assert.deepEqual(
    plugin.extractUsageOnComplete(task, {}, { data: two, usage: { generated_images: 2, input_tokens: 6000, output_tokens: 8192, input_tokens_details: { text_tokens: 6000, image_tokens: 0 }, output_tokens_details: { image_tokens: 8192 } } }),
    { image_input_text_tokens: 6000, image_input_image_tokens: 0, image_output_tokens: 8192, image_count: 2 },
  );
  // OpenAI's shape without per-modality output details.
  assert.deepEqual(plugin.extractUsageOnComplete(task, {}, { data: two, usage: { input_tokens: 50, output_tokens: 9000, input_tokens_details: { text_tokens: 40, image_tokens: 10 } } }), {
    image_input_text_tokens: 40,
    image_input_image_tokens: 10,
    image_output_tokens: 9000,
    image_count: 2,
  });
  assert.deepEqual(plugin.extractUsageOnComplete(task, {}, { data: two, usage: { input_tokens: 50, output_tokens: 9000 } }), {
    image_input_text_tokens: 50,
    image_input_image_tokens: 0,
    image_output_tokens: 9000,
    image_count: 2,
  });
  // No usage: two delivered images of the three requested.
  assert.deepEqual(plugin.extractUsageOnComplete(task, {}, { data: two }), { image_input_text_tokens: 2 * 8197, image_input_image_tokens: 0, image_output_tokens: 2 * 4096, image_count: 2 });
  // The state may also arrive as the result's plugin_state.
  assert.deepEqual(plugin.extractUsageOnComplete(ctx, { plugin_state: state }, { data: two }).image_count, 2);
  // Default mode keeps MiniMax's own usage parsing.
  const vendor = driver(intent, { baseUrl: "https://api.minimaxi.com", config: {} });
  assert.equal(plugin.parseSubmitResponse(vendor, { statusCode: 200, headers: {}, body: { data: two } }).state, undefined);
  assert.deepEqual(plugin.extractUsageOnComplete(vendor, {}, { data: two }), { image_count: 2 });
});

test("a relay channel refuses video, edits, Context-IR, regeneration, cancel, prompt enhancement and music before billing", () => {
  const cases = [
    [videoIntent("MiniMax-H3", { seconds: 5 }), /Video generation is not available on this channel/],
    [videoIntent("MiniMax-H3-Max", { seconds: 5 }), /Video generation/],
    [native.createH3Task(jsonCtx({ model: "MiniMax-H3-Lite", content: [{ type: "text", text: "x" }] })), /Video generation/],
    [imageIntent({ prompt: "x", image: "https://img.example/a.png" }, "edit"), /Image editing/],
    [native.createContextIR(jsonCtx({ model: "MiniMax-H3", content: [{ type: "text", text: "x" }], duration: 5 })), /H3-Context-IR/],
    [native.createRegeneration(jsonCtx({ model: "MiniMax-H3", source_task_id: "task_src" })), /Video regeneration/],
    [native.cancelTask(Object.assign(jsonCtx({}), { params: { task_id: "task_x" } })), /Task cancel and delete/],
    [native.enhanceImagePrompt(jsonCtx({ model: "MiniMax-H3-Image", prompt: "x" })), /H3-Image-Context-IR/],
    [native.createMusic(jsonCtx({ model: "music-3.0", lyrics: "[verse]\nla" })), /Music generation/],
  ];
  for (const [intent, pattern] of cases) {
    const ctx = driver(intent, { originTasks: [{ taskId: "task_src", upstreamTaskId: "mm-src", action: "text_to_video", status: "SUCCESS", data: {} }] });
    assert.throws(() => plugin.extractUsage(ctx), pattern, intent.action);
    assert.throws(() => plugin.buildSubmitRequest(ctx), /upstream type is OpenAI-compatible relay/, intent.action);
    assert.throws(() => plugin.buildSubmitRequest(ctx), /upstream type MiniMax API/, intent.action);
  }
});

test("another New API gateway forwards as before whatever the upstream type says", () => {
  const intent = videoIntent("MiniMax-H3", { seconds: 5 });
  const ctx = driver(intent, { baseUrl: "https://mid.example", upstream: { kind: "new_api" }, authHeader: "Bearer gw-token" });
  assert.equal(plugin.buildSubmitRequest(ctx).url, "https://mid.example/byaiden_minimax/v2/video_generation");
  assert.equal(plugin.extractUsage(ctx).seconds, 5);
});

test("default mode is unchanged: MiniMax hosts and paths", () => {
  const intent = imageIntent({ prompt: "A cat" });
  const ctx = driver(intent, { baseUrl: "https://api.minimaxi.com", config: {} });
  assert.equal(plugin.buildSubmitRequest(ctx).url, "https://api.minimaxi.com/v1/images/generations");
  const video = driver(videoIntent("MiniMax-H3", { seconds: 5 }), { baseUrl: "https://api.minimax.io", config: { upstreamType: "minimax" } });
  assert.equal(plugin.buildSubmitRequest(video).url, "https://api.minimax.io/v2/video_generation");
  const speech = plugin.convertRequest({ baseUrl: "https://api.minimaxi.com", path: "/v1/audio/speech", config: {} }, { model: "speech-2.8-hd", stream: false, body: { model: "speech-2.8-hd", input: "hi" } });
  assert.equal(speech.path, undefined);
  assert.equal(speech.body.text, "hi");
});

// ---------------------------------------------------------------------------
// billable_input_images

const IMAGES = (n) => Array.from({ length: n }, (_, i) => ({ type: "image_url", image_url: { url: "https://img.example/" + i + ".png" }, role: "reference_image" }));

test("billable_input_images is what MiniMax charges: beyond 5 images, beyond 2 on H3-Max", () => {
  const vendor = (model, n) => driver(native.createH3Task(jsonCtx({ model: model, content: [{ type: "text", text: "x" }].concat(IMAGES(n)), duration: 5, resolution: "768P" })), { baseUrl: "https://api.minimaxi.com", config: {} });
  for (const [model, n, billable] of [
    ["MiniMax-H3", 9, 4],
    ["MiniMax-H3", 5, 0],
    ["MiniMax-H3", 0, 0],
    ["MiniMax-H3-Highspeed", 6, 1],
    ["MiniMax-H3-Lite", 9, 4],
    ["MiniMax-H3-Max", 9, 7],
    ["MiniMax-H3-Max", 2, 0],
    ["MiniMax-H3-Max", 3, 1],
  ]) {
    const facts = plugin.extractUsage(vendor(model, n));
    assert.equal(facts.input_images, n, model);
    assert.equal(facts.billable_input_images, billable, model + " " + n);
  }
  // A mapped upstream name decides the allowance.
  const mapped = vendor("MiniMax-H3", 9);
  mapped.upstreamModel = "MiniMax-H3-Max";
  mapped.model = "my-video";
  assert.equal(plugin.extractUsage(mapped).billable_input_images, 7);
});

test("settlement recomputes billable_input_images from MiniMax's reported image count", () => {
  const done = (count) => ({ task: { status: "succeeded", resolution: "768P", usage: { output_seconds: 5, input_seconds: 0, input_image_count: count } } });
  assert.deepEqual(plugin.extractUsageOnComplete({ model: "MiniMax-H3", upstreamModel: "MiniMax-H3" }, {}, done(8)), { resolution: "768P", seconds: 5, input_images: 8, input_video_seconds: 0, billable_input_images: 3 });
  assert.equal(plugin.extractUsageOnComplete({ model: "MiniMax-H3-Max", upstreamModel: "MiniMax-H3-Max" }, {}, done(8)).billable_input_images, 6);
  // No reported count: the reservation stands for both facts.
  const none = plugin.extractUsageOnComplete({ model: "MiniMax-H3", upstreamModel: "MiniMax-H3" }, {}, { task: { status: "succeeded", resolution: "768P", usage: { output_seconds: 5 } } });
  assert.deepEqual(none, { resolution: "768P", seconds: 5 });
  const regen = { task: { status: "succeeded", task_type: "regeneration", usage: { output_seconds: 6, input_seconds: 0, input_image_count: 7 } } };
  assert.equal(plugin.extractUsageOnComplete({ action: "video_regeneration", model: "MiniMax-H3-Regeneration" }, {}, regen).billable_input_images, 2);
});

test("every video profile and example carries billable_input_images consistent with input_images", () => {
  const free = { "MiniMax-H3": 5, "MiniMax-H3-Highspeed": 5, "MiniMax-H3-Lite": 5, "MiniMax-H3-Max": 2, "MiniMax-H3-Regeneration": 5 };
  for (const profile of meta.usageProfiles) {
    if (!profile.schema.input_images) continue;
    assert.deepEqual(profile.schema.billable_input_images, { type: "number", unit: "count", description: { en: "Billable input image unit price", zh: "计费输入图片单价" } });
    for (const model of profile.models) {
      for (const example of profile.examples) assert.equal(example.facts.billable_input_images, Math.max(example.facts.input_images - free[model], 0), model + " " + example.label);
    }
  }
  assert.ok(meta.usageSchema.billable_input_images);
});
