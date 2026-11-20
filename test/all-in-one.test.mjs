// The 2.x endpoints: text passthrough, model list, speech, transcription,
// H3-Context-IR, regeneration, cancel/delete, image prompt enhancement, music.
import { test } from "node:test";
import assert from "node:assert/strict";

const fetched = [];
let fetchReply = null;
globalThis.utils = {
  fetch: (request) => {
    fetched.push(request);
    if (!fetchReply) throw new Error("utils.fetch is not available");
    return fetchReply;
  },
};

const plugin = await import("../plugin.js");
const { meta, native } = plugin;

const BASE = "https://api.minimaxi.com";
const KEY_PATH = "/" + meta.key;

function driver(intent, extra) {
  return Object.assign(
    {
      requestBody: intent.requestBody,
      action: intent.action,
      model: intent.model,
      upstreamModel: intent.model,
      baseUrl: BASE,
      apiKey: "sk-test",
      authHeader: "sk-test",
      upstream: { kind: "vendor" },
      config: {},
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

const relay = (path) => meta.relay.find((route) => route.incoming_path === path);

// ---------------------------------------------------------------------------
// Text and the model list

test("text routes pass any model through to MiniMax's compatible endpoints", () => {
  assert.deepEqual(relay("/v1/chat/completions"), { incoming_path: "/v1/chat/completions", upstream_path: "/v1/chat/completions" });
  assert.deepEqual(relay("/v1/responses"), { incoming_path: "/v1/responses", upstream_path: "/v1/responses" });
  assert.deepEqual(relay("/v1/messages"), { incoming_path: "/v1/messages", upstream_path: "/anthropic/v1/messages" });
  for (const route of meta.relay) assert.equal(route.models, undefined, route.incoming_path);
  assert.equal(relay("/v1/models").converter, "plugin");
  assert.equal(relay("/v1/audio/speech").upstream_path, "/v1/t2a_v2");
  assert.equal(relay("/v1/audio/transcriptions").upstream_path, "/v1/speech_to_text");
  for (const model of plugin.TEXT_MODELS) assert.ok(meta.models.includes(model));
});

test("Fetch models lists MiniMax's models plus the plugin's media models", () => {
  const vendor = { object: "list", data: [{ id: "MiniMax-M3.1-Flash", object: "model" }, { id: "MiniMax-M3", object: "model" }, { id: "MiniMax-M3" }] };
  const ctx = { baseUrl: BASE, path: "/v1/models", config: {}, state: null };
  const result = plugin.convertResponse(ctx, { status: 200, headers: {}, body: JSON.stringify(vendor) });
  const ids = result.body.data.map((item) => item.id);
  assert.deepEqual(ids.slice(0, 2), ["MiniMax-M3.1-Flash", "MiniMax-M3"]);
  assert.deepEqual(ids.slice(2), plugin.MEDIA_MODELS);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(plugin.convertResponse(ctx, { status: 401, headers: {}, body: JSON.stringify({ type: "error", error: { type: "authorized_error", message: "login fail (1004)", http_code: "401" } }) }).error.status, 401);
  assert.equal(plugin.convertResponse(ctx, { status: 200, headers: {}, body: "nope" }).error.status, 502);
});

// ---------------------------------------------------------------------------
// Speech

const SPEECH_CTX = { baseUrl: BASE, path: "/v1/audio/speech", config: { defaultVoice: "Chinese (Mandarin)_Lyrical_Voice" } };

test("speech asks MiniMax for its hex stream with OpenAI fields mapped", () => {
  const request = plugin.convertRequest(SPEECH_CTX, {
    model: "speech-2.8-turbo",
    stream: false,
    body: deepFreeze({ model: "speech-2.8-turbo", input: "你好", voice: "alloy", response_format: "wav", speed: 1.2, metadata: { emotion: "happy", sample_rate: 32000, language_boost: "auto" } }),
  });
  assert.equal(request.method, "POST");
  assert.equal(request.stream, true);
  assert.deepEqual(request.body, {
    model: "speech-2.8-turbo",
    text: "你好",
    stream: true,
    stream_options: { exclude_aggregated_audio: true },
    voice_setting: { voice_id: "Chinese (Mandarin)_Lyrical_Voice", speed: 1.2, emotion: "happy" },
    audio_setting: { format: "wav", sample_rate: 32000 },
    language_boost: "auto",
  });
  assert.deepEqual(request.state, { kind: "speech", format: "wav", clientStream: false, chunks: 0, characters: 0 });
  const own = plugin.convertRequest({ baseUrl: BASE, path: "/v1/audio/speech", config: {} }, { model: "speech-2.8-hd", stream: false, body: { model: "speech-2.8-hd", input: "hi", voice: "English_radiant_girl" } });
  assert.equal(own.body.voice_setting.voice_id, "English_radiant_girl");
  assert.equal(own.body.audio_setting.format, "mp3");
  const fallback = plugin.convertRequest({ baseUrl: BASE, path: "/v1/audio/speech", config: {} }, { model: "speech-2.8-hd", stream: false, body: { model: "speech-2.8-hd", input: "hi" } });
  assert.equal(fallback.body.voice_setting.voice_id, "English_Graceful_Lady");
  assert.equal(plugin.convertRequest(SPEECH_CTX, { model: "speech-2.8-hd", stream: true, body: { model: "speech-2.8-hd", input: "hi", stream_format: "sse" } }).state.clientStream, true);
  const bad = [
    [{ input: "" }, /input is required/],
    [{ input: "x", response_format: "aac" }, /response_format/],
    [{ input: "x", instructions: "cheerful" }, /instructions are not supported/],
    [{ input: "x", speed: 3 }, /speed/],
    [{ input: "x", metadata: { seed: 1 } }, /metadata.seed/],
    [{ input: "x", foo: 1 }, /foo is not supported/],
    [{ input: "x".repeat(10000) }, /shorter than 10000/],
  ];
  for (const [body, pattern] of bad) assert.throws(() => plugin.convertRequest(SPEECH_CTX, { model: "speech-2.8-hd", stream: false, body: Object.assign({ model: "speech-2.8-hd" }, body) }), pattern);
});

test("hex audio becomes the same bytes in base64", () => {
  for (const size of [0, 1, 2, 3, 4, 5, 255, 1000]) {
    const bytes = Buffer.from(Array.from({ length: size }, (_, i) => (i * 37 + 11) & 255));
    assert.equal(plugin.hexToBase64(bytes.toString("hex")), bytes.toString("base64"));
    assert.equal(plugin.hexToBase64(bytes.toString("hex").toUpperCase()), bytes.toString("base64"));
  }
  assert.throws(() => plugin.hexToBase64("abc"), /invalid hex/);
  assert.throws(() => plugin.hexToBase64("zz"), /invalid hex/);
});

test("speech stream events become audio bytes, without the repeated whole file", () => {
  const state = { kind: "speech", format: "mp3", clientStream: false, chunks: 0, characters: 0 };
  const ctx = (s) => Object.assign({ state: s }, SPEECH_CTX);
  const event = (audio, status, extra) => ({ data: JSON.stringify(Object.assign({ data: { audio: audio, status: status }, base_resp: { status_code: 0, status_msg: "" } }, extra || {})) });
  const first = plugin.convertStreamEvent(ctx(state), event("494433", 1));
  assert.deepEqual(first.chunks, [{ bodyBase64: Buffer.from("494433", "hex").toString("base64") }]);
  assert.equal(first.contentType, "audio/mpeg");
  assert.equal(first.state.chunks, 1);
  const last = plugin.convertStreamEvent(ctx(first.state), event("4944330000", 2, { extra_info: { usage_characters: 7 } }));
  assert.equal(last.chunks, undefined);
  assert.equal(last.state.characters, 7);
  assert.deepEqual(plugin.convertStreamEvent(ctx(last.state), { done: true }), { state: last.state });
  assert.equal(plugin.convertStreamEvent(ctx(state), { done: true }).error.status, 502);
  // A single final event carries the audio.
  assert.ok(plugin.convertStreamEvent(ctx(state), event("4944", 2)).chunks);
  const error = plugin.convertStreamEvent(ctx(state), { data: JSON.stringify({ base_resp: { status_code: 2054, status_msg: "voice id not exist" } }) });
  assert.match(error.error.message, /voice id not exist \(2054\)/);
  assert.equal(error.error.status, 400);
  assert.equal(plugin.convertStreamEvent(ctx(state), { data: JSON.stringify({ base_resp: { status_code: 1004, status_msg: "login fail" } }) }).error.status, 401);
  // Streaming clients get OpenAI speech events and the billed characters.
  const sse = Object.assign({}, state, { clientStream: true });
  const delta = plugin.convertStreamEvent(ctx(sse), event("4944", 1));
  assert.deepEqual(delta.events, [{ data: { type: "speech.audio.delta", audio: "SUQ=" } }]);
  const done = plugin.convertStreamEvent(ctx(delta.state), event("", 2, { extra_info: { usage_characters: 4 } }));
  assert.deepEqual(done.events, [{ data: { type: "speech.audio.done", usage: { input_tokens: 4, output_tokens: 0, total_tokens: 4 } } }]);
});

test("a whole JSON speech reply is converted, and errors keep MiniMax's message", () => {
  const ctx = Object.assign({ state: { kind: "speech", format: "mp3", clientStream: false, chunks: 0, characters: 0 } }, SPEECH_CTX);
  const ok = plugin.convertResponse(ctx, { status: 200, headers: {}, body: JSON.stringify({ data: { audio: "4944", status: 2 }, base_resp: { status_code: 0 } }) });
  assert.deepEqual(ok, { bodyBase64: "SUQ=", contentType: "audio/mpeg" });
  const err = plugin.convertResponse(ctx, { status: 200, headers: {}, body: JSON.stringify({ base_resp: { status_code: 1008, status_msg: "insufficient balance" } }) });
  assert.equal(err.error.status, 402);
  assert.match(err.error.message, /^MiniMax: insufficient balance \(1008\)/);
  const http = plugin.convertResponse(ctx, { status: 429, headers: {}, body: JSON.stringify({ type: "error", error: { type: "rate_limit_error", message: "rate limit (1002)", http_code: "429" } }) });
  assert.equal(http.error.status, 429);
});

// ---------------------------------------------------------------------------
// Transcription

const STT_CTX = { baseUrl: BASE, path: "/v1/audio/transcriptions", config: {} };
const FILE = [{ field: "file", filename: "a.mp3", contentType: "audio/mpeg", size: 9 }];

test("transcription forwards the upload as MiniMax's multipart form", () => {
  const request = plugin.convertRequest(STT_CTX, deepFreeze({ model: "asr-1.0", stream: false, form: { fields: { model: ["asr-1.0"], language: ["en"], temperature: ["0"] }, files: FILE } }));
  assert.deepEqual(request.form, { fields: { model: "asr-1.0", response_format: "json" }, files: [{ field: "file", from: "file" }] });
  assert.deepEqual(request.headers, { language: "en" });
  assert.equal(request.stream, false);
  const words = plugin.convertRequest(STT_CTX, { model: "asr-1.0", form: { fields: { response_format: ["verbose_json"], "timestamp_granularities[]": ["segment", "word"] }, files: FILE } });
  assert.deepEqual(words.form.fields, { model: "asr-1.0", response_format: "verbose_json", timestamp_level: "word" });
  assert.deepEqual(words.headers, {});
  const bad = [
    [{ response_format: ["srt"] }, FILE, /json or verbose_json/],
    [{ prompt: ["names"] }, FILE, /prompt is not supported/],
    [{ "timestamp_granularities[]": ["word"] }, FILE, /verbose_json/],
    [{}, [], /exactly one audio file/],
    [{ foo: ["1"] }, FILE, /foo is not supported/],
  ];
  for (const [fields, files, pattern] of bad) assert.throws(() => plugin.convertRequest(STT_CTX, { model: "asr-1.0", form: { fields: fields, files: files } }), pattern);
});

test("transcription bills the audio seconds as tokens", () => {
  const ctx = Object.assign({ state: { kind: "transcription", responseFormat: "json", language: "" } }, STT_CTX);
  const reply = plugin.convertResponse(ctx, { status: 200, headers: {}, body: JSON.stringify({ text: "Hello there.", duration: 2.04, trace_id: "t" }) });
  assert.deepEqual(reply.body, { text: "Hello there.", usage: { type: "tokens", input_tokens: 3, output_tokens: 0, total_tokens: 3, prompt_tokens: 3, completion_tokens: 0, seconds: 3 } });
  const verbose = plugin.convertResponse(Object.assign({}, ctx, { state: { kind: "transcription", responseFormat: "verbose_json", language: "en" } }), {
    status: 200,
    headers: {},
    body: JSON.stringify({ text: "Hi.", duration: 1.5, n_speakers: 1, segments: [{ id: 0, start: 0, end: 1.5, speaker: "S1", text: "Hi." }] }),
  });
  assert.equal(verbose.body.task, "transcribe");
  assert.equal(verbose.body.language, "en");
  assert.equal(verbose.body.duration, 1.5);
  assert.equal(verbose.body.segments.length, 1);
  assert.equal(verbose.body.usage.total_tokens, 2);
  const err = plugin.convertResponse(ctx, { status: 400, headers: {}, body: JSON.stringify({ type: "error", error: { type: "bad_request_error", message: "audio duration 623.4s exceeds the limit of 500s (2013)", http_code: "400" } }) });
  assert.equal(err.error.status, 400);
  assert.match(err.error.message, /exceeds the limit/);
});

// ---------------------------------------------------------------------------
// H3-Context-IR

test("H3-Context-IR runs on MiniMax-H3 under its own price model", () => {
  const value = { model: "MiniMax-H3", content: [{ type: "text", text: "A boy playing basketball by the sea" }], duration: 5 };
  const intent = native.createContextIR(jsonCtx(deepFreeze(value)));
  assert.equal(intent.model, "MiniMax-H3-Context-IR");
  assert.equal(intent.action, "h3_context_ir");
  const request = plugin.buildSubmitRequest(driver(intent));
  assert.equal(request.url, BASE + "/v2/h3_context_ir");
  assert.deepEqual(request.body, { model: "MiniMax-H3", content: value.content, duration: 5, ratio: "16:9" });
  assert.deepEqual(plugin.extractUsage(driver(intent)), { context_ir_input_tokens: 16384 + 35, context_ir_output_tokens: 16384 });
  assert.equal(plugin.extractUsage(Object.assign(driver(intent), { usagePurpose: "billing_ratios" })), null);
  assert.equal(native.createContextIR(jsonCtx(Object.assign({}, value, { model: "MiniMax-H3-Context-IR" }))).model, "MiniMax-H3-Context-IR");
  // Reference media keep the adaptive ratio MiniMax defaults to.
  const refs = native.createContextIR(jsonCtx({ model: "MiniMax-H3", duration: 6, content: [{ type: "text", text: "x" }, { type: "image_url", role: "reference_image", image_url: { url: "https://a/b.png" } }] }));
  const refBody = plugin.buildSubmitRequest(driver(refs)).body;
  assert.equal(refBody.ratio, undefined);
  assert.equal(plugin.extractUsage(driver(refs)).context_ir_input_tokens, 16384 + 1 + 16384);
  // Created and polled like any /v2 task; the prompt is the result.
  assert.deepEqual(plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: { task_id: "cir1" } }), { taskId: "cir1", taskData: { task_id: "cir1" } });
  const done = { task: { id: "cir1", status: "succeeded", task_type: "h3_context_ir", modality: "text", content: { prompt: "Structured prompt" }, usage: { total_tokens: 9090, prompt_tokens: 5664, completion_tokens: 3426 } } };
  assert.deepEqual(plugin.parseTaskResult({ action: "h3_context_ir" }, done), { code: 0, status: "SUCCESS", progress: "100%" });
  assert.deepEqual(plugin.extractUsageOnComplete({ action: "h3_context_ir", model: "MiniMax-H3-Context-IR" }, {}, done), { context_ir_input_tokens: 5664, context_ir_output_tokens: 3426 });
  assert.deepEqual(plugin.listArtifacts({ status: "SUCCESS", action: "h3_context_ir", data: done }), []);
  assert.equal(native.h3TaskStatus({}, { task_id: "task_x", status: "SUCCESS", data: done }).task.content.prompt, "Structured prompt");
  const bad = [
    [{ content: value.content }, /duration is required/],
    [{ content: value.content, duration: 20 }, /between 4 and 15/],
    [{ content: value.content, duration: 5, callback_url: "https://x" }, /callback_url/],
    [{ content: value.content, duration: 5, resolution: "2K" }, /resolution is not supported/],
    [{ content: [{ type: "image_url", image_url: { url: "https://a" } }], duration: 5 }, /non-empty text/],
  ];
  for (const [body, pattern] of bad) assert.throws(() => native.createContextIR(jsonCtx(Object.assign({ model: "MiniMax-H3" }, body))), pattern);
});

test("Context-IR through another New API gateway keeps the gateway's model name", () => {
  const intent = native.createContextIR(jsonCtx({ model: "MiniMax-H3-Context-IR", content: [{ type: "text", text: "x" }], duration: 4, ratio: "1:1" }));
  const request = plugin.buildSubmitRequest(driver(intent, { upstream: { kind: "new_api" }, authHeader: "Bearer sk-mid" }));
  assert.equal(request.url, BASE + KEY_PATH + "/v2/h3_context_ir");
  assert.equal(request.body.model, "MiniMax-H3-Context-IR");
  assert.equal(request.headers.Authorization, "Bearer sk-mid");
});

// ---------------------------------------------------------------------------
// Video regeneration

const SOURCE_DONE = { task: { id: "mm-src", status: "succeeded", resolution: "768P", duration: 6, task_type: "generation", content: { url: "https://cdn/s.mp4" }, usage: { output_seconds: 6, input_image_count: 7, input_seconds: 0 } } };

test("regeneration by a gateway task id sends MiniMax's id and reserves the source's facts", () => {
  const intent = native.createRegeneration(jsonCtx(deepFreeze({ model: "MiniMax-H3", source_task_id: "task_src", generate_audio: false })));
  assert.equal(intent.model, "MiniMax-H3-Regeneration");
  assert.deepEqual(intent.originTaskIds, ["task_src"]);
  const ctx = driver(intent, { originTasks: [{ taskId: "task_src", upstreamTaskId: "mm-src", action: "text_to_video", status: "SUCCESS", data: SOURCE_DONE }] });
  const request = plugin.buildSubmitRequest(ctx);
  assert.equal(request.url, BASE + "/v2/video_regeneration");
  assert.deepEqual(request.body, { model: "MiniMax-H3", source_task_id: "mm-src", resolution: "2K", generate_audio: false });
  assert.deepEqual(plugin.extractUsage(ctx), { seconds: 6, input_images: 7, billable_input_images: 2, input_video_seconds: 0 });
  // Without the source's data the longest video is held.
  assert.deepEqual(plugin.extractUsage(driver(intent)), { seconds: 15, input_images: 0, billable_input_images: 0, input_video_seconds: 15 });
  const done = { task: { id: "rg1", status: "succeeded", task_type: "regeneration", resolution: "2K", content: { url: "https://cdn/r.mp4" }, usage: { output_seconds: 6, input_image_count: 7, input_seconds: 0 } } };
  assert.deepEqual(plugin.extractUsageOnComplete({ action: "video_regeneration", model: "MiniMax-H3-Regeneration" }, {}, done), { seconds: 6, input_images: 7, input_video_seconds: 0, billable_input_images: 2 });
  assert.deepEqual(plugin.listArtifacts({ status: "SUCCESS", data: done }), [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  // On a New API channel the other gateway resolves its own task id.
  const mid = plugin.buildSubmitRequest(Object.assign({}, ctx, { upstream: { kind: "new_api" }, authHeader: "Bearer sk-mid" }));
  assert.equal(mid.url, BASE + KEY_PATH + "/v2/video_regeneration");
  assert.equal(mid.body.source_task_id, "mm-src");
  assert.equal(mid.body.model, "MiniMax-H3-Regeneration");
});

test("regeneration by source video needs exactly one base_video", () => {
  const content = [
    { type: "text", text: "final prompt" },
    { type: "video_url", role: "base_video", video_url: { url: "https://a/base.mp4" } },
    { type: "image_url", role: "reference_image", image_url: { url: "https://a/r.png" } },
    { type: "video_url", role: "reference_video", video_url: { url: "https://a/r.mp4" } },
  ];
  const intent = native.createRegeneration(jsonCtx({ model: "MiniMax-H3-Regeneration", content: content }));
  assert.equal(intent.originTaskIds, undefined);
  const body = plugin.buildSubmitRequest(driver(intent)).body;
  assert.deepEqual(body, { model: "MiniMax-H3", content: content, resolution: "2K" });
  assert.deepEqual(plugin.extractUsage(driver(intent)), { seconds: 15, input_images: 1, billable_input_images: 0, input_video_seconds: 15 });
  const bad = [
    [{ content: content, source_task_id: "t" }, /either source_task_id or content/],
    [{}, /either source_task_id or content/],
    [{ content: [{ type: "text", text: "x" }] }, /exactly one video_url item with role base_video/],
    [{ source_task_id: "t", resolution: "768P" }, /resolution must be 2K/],
    [{ source_task_id: "t", callback_url: "https://x" }, /callback_url/],
    [{ source_task_id: "t", generate_audio: "no" }, /generate_audio must be true or false/],
  ];
  for (const [value, pattern] of bad) assert.throws(() => native.createRegeneration(jsonCtx(Object.assign({ model: "MiniMax-H3" }, value))), pattern);
});

// ---------------------------------------------------------------------------
// Cancel or delete

test("cancel or delete names the gateway task and costs nothing", () => {
  const intent = native.cancelTask(deepFreeze({ method: "DELETE", path: "/v2/video_generation/task_v", params: { task_id: "task_v" }, query: {}, requestHeaders: {}, body: { kind: "json", value: {} } }));
  assert.deepEqual(intent.originTaskIds, ["task_v"]);
  assert.equal(intent.model, "MiniMax-H3");
  assert.equal(intent.action, "cancel_task");
  const ctx = driver(intent, { originTasks: [{ taskId: "task_v", upstreamTaskId: "424010985738629", action: "text_to_video", status: "QUEUED", data: { task_id: "424010985738629" } }] });
  const request = plugin.buildSubmitRequest(ctx);
  assert.deepEqual(request, { url: BASE + "/v2/video_generation/424010985738629", method: "DELETE", headers: { Accept: "application/json", Authorization: "Bearer sk-test" }, action: "cancel_task" });
  assert.deepEqual(plugin.extractUsage(ctx), { seconds: 0, resolution: "768P", input_images: 0, billable_input_images: 0, input_video_seconds: 0 });
  assert.deepEqual(plugin.extractUsage(Object.assign({}, ctx, { usagePurpose: "billing_ratios" })), { seconds: 0 });
  const parsed = plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { task_id: "424010985738629", action: "cancelled", status: "cancelled" } });
  assert.deepEqual(parsed, { taskId: "task_pub", taskData: { task_id: "task_v", action: "cancelled", status: "cancelled" }, immediate: { status: "SUCCESS", progress: "100%" } });
  assert.deepEqual(native.taskCancelled({}, { task_id: "task_pub", data: parsed.taskData }), { task_id: "task_v", action: "cancelled", status: "cancelled" });
  assert.equal(plugin.extractUsageOnComplete({ action: "cancel_task" }, {}, parsed.taskData), null);
  assert.equal(plugin.extractUsageOnSubmit(ctx, parsed.taskData), null);
  assert.throws(() => plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { base_resp: { status_code: 2013, status_msg: "running task" } } }), /running task/);
  // Other models pick their own zero profile; image and music tasks are not MiniMax /v2 tasks.
  const cir = native.cancelTask({ params: { task_id: "t" }, body: { kind: "json", value: { model: "MiniMax-H3-Context-IR" } } });
  assert.deepEqual(plugin.extractUsage(driver(cir)), { context_ir_input_tokens: 0, context_ir_output_tokens: 0 });
  const lite = native.cancelTask({ params: { task_id: "t" }, body: { kind: "json", value: { model: "MiniMax-H3-Lite" } } });
  assert.equal(plugin.extractUsage(driver(lite)).resolution, "480P");
  assert.throws(() => native.cancelTask({ params: { task_id: "t" }, body: { kind: "json", value: { model: "MiniMax-H3-Image" } } }), /no task to cancel/);
  assert.throws(() => native.cancelTask({ params: { task_id: "t" }, body: { kind: "json", value: { force: true } } }), /force is not supported/);
  assert.throws(() => plugin.buildSubmitRequest(driver(intent)), /not found/);
});

test("cancel through another New API gateway sends its route a JSON body", () => {
  const intent = native.cancelTask({ params: { task_id: "task_v" }, body: { kind: "json", value: { model: "MiniMax-H3" } } });
  const ctx = driver(intent, { upstream: { kind: "new_api" }, authHeader: "Bearer sk-mid", originTasks: [{ taskId: "task_v", upstreamTaskId: "task_mid", data: {} }] });
  const request = plugin.buildSubmitRequest(ctx);
  assert.equal(request.url, BASE + KEY_PATH + "/v2/video_generation/task_mid");
  assert.equal(request.method, "DELETE");
  assert.deepEqual(request.body, { model: "MiniMax-H3" });
  assert.equal(request.headers.Authorization, "Bearer sk-mid");
  // The other gateway answers with its presenter's reply.
  assert.equal(plugin.parseSubmitResponse(ctx, { statusCode: 200, headers: {}, body: { task_id: "task_mid", action: "deleted", status: "deleted" } }).taskData.action, "deleted");
});

// ---------------------------------------------------------------------------
// H3-Image-Context-IR

test("image prompt enhancement bills its input tokens at the image text price", () => {
  const value = { model: "MiniMax-H3-Image", prompt: "A ginger cat", images: [{ image_url: "https://a/c.jpg" }], aspect_ratio: "auto" };
  const intent = native.enhanceImagePrompt(jsonCtx(deepFreeze(value)));
  assert.equal(intent.action, "image_prompt");
  const request = plugin.buildSubmitRequest(driver(intent));
  assert.equal(request.url, BASE + "/v1/h3_image_context_ir");
  assert.deepEqual(request.body, value);
  assert.deepEqual(plugin.extractUsage(driver(intent)), { image_input_text_tokens: 12 + 6144, image_input_image_tokens: 0, image_output_tokens: 0, image_count: 0 });
  assert.equal(plugin.extractUsage(Object.assign(driver(intent), { usagePurpose: "billing_ratios" })), null);
  const reply = { created: 1794023743, revised_prompt: "A ginger tabby cat ...", aspect_ratio: "3:2", usage: { total_tokens: 3489, input_tokens: 3489 }, request_id: "r" };
  const parsed = plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: reply });
  assert.deepEqual(parsed.immediate, { status: "SUCCESS", progress: "100%" });
  assert.deepEqual(plugin.extractUsageOnComplete({ action: "image_prompt", model: "MiniMax-H3-Image" }, parsed.immediate, reply), { image_input_text_tokens: 3489, image_input_image_tokens: 0, image_output_tokens: 0, image_count: 0 });
  assert.equal(plugin.extractUsageOnSubmit(driver(intent), reply), null);
  // MiniMax's trace id stays at the gateway.
  const { request_id: _trace, ...untraced } = reply;
  assert.deepEqual(native.imagePromptEnhanced({}, { data: reply }), untraced);
  assert.throws(() => plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: { usage: {} } }), /no enhanced prompt/);
  assert.throws(() => native.enhanceImagePrompt(jsonCtx({ model: "MiniMax-H3-Image-Highspeed", prompt: "x" })), /MiniMax-H3-Image only/);
  assert.throws(() => native.enhanceImagePrompt(jsonCtx({ model: "MiniMax-H3-Image", prompt: "x", n: 2 })), /n is not supported/);
  assert.throws(() => native.enhanceImagePrompt(jsonCtx({ model: "MiniMax-H3-Image", prompt: " " })), /prompt is required/);
  assert.equal(plugin.buildSubmitRequest(driver(intent, { upstream: { kind: "new_api" } })).url, BASE + KEY_PATH + "/v1/h3_image_context_ir");
});

// ---------------------------------------------------------------------------
// Music

test("music generation is one billed track, answered with MiniMax's body", () => {
  const value = { model: "music-3.0", prompt: "Indie folk", lyrics: "[verse]\nStreetlights flicker", output_format: "url", audio_setting: { format: "mp3", sample_rate: 44100 } };
  const intent = native.createMusic(jsonCtx(deepFreeze(value)));
  assert.equal(intent.action, "music_generation");
  const request = plugin.buildSubmitRequest(driver(intent));
  assert.equal(request.url, BASE + "/v1/music_generation");
  assert.deepEqual(request.body, value);
  assert.deepEqual(plugin.extractUsage(driver(intent)), { music_tracks: 1 });
  const reply = { data: { audio: "https://cdn.example/song.mp3", status: 2 }, extra_info: { music_duration: 25364 }, base_resp: { status_code: 0, status_msg: "success" } };
  const parsed = plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: reply });
  assert.deepEqual(parsed.immediate, { status: "SUCCESS", progress: "100%", url: "https://cdn.example/song.mp3" });
  assert.deepEqual(plugin.extractUsageOnComplete({ action: "music_generation", model: "music-3.0" }, {}, reply), { music_tracks: 1 });
  assert.deepEqual(native.musicCreated({}, { data: Object.assign({ trace_id: "04ede0ab" }, reply) }), reply);
  const hex = plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: { data: { audio: "494433", status: 2 }, base_resp: { status_code: 0 } } });
  assert.deepEqual(hex.immediate, { status: "SUCCESS", progress: "100%" });
  assert.throws(() => plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: { base_resp: { status_code: 2013, status_msg: "invalid params" } } }), /invalid params \(2013\)/);
  assert.throws(() => plugin.parseSubmitResponse(driver(intent), { statusCode: 200, headers: {}, body: { data: {}, base_resp: { status_code: 0 } } }), /no audio/);
  const cover = native.createMusic(jsonCtx({ model: "music-cover", prompt: "Jazz cover, warm", audio_url: "https://a/ref.mp3" }));
  assert.equal(plugin.buildSubmitRequest(driver(cover)).body.audio_url, "https://a/ref.mp3");
  const bad = [
    [{ model: "music-3.0", prompt: "x" }, /lyrics are required/],
    [{ model: "music-3.0", is_instrumental: true }, /prompt is required/],
    [{ model: "music-3.0", lyrics: "x", stream: true }, /stream is not supported/],
    [{ model: "music-3.0", lyrics: "x", output_format: "wav" }, /output_format/],
    [{ model: "music-3.0", lyrics: "x", audio_url: "https://a" }, /only valid on music-cover/],
    [{ model: "music-cover", prompt: "x" }, /exactly one of audio_url/],
    [{ model: "music-3.0", lyrics: "x", callback_url: "https://x" }, /callback_url is not supported/],
  ];
  for (const [body, pattern] of bad) assert.throws(() => native.createMusic(jsonCtx(body)), pattern);
  assert.doesNotThrow(() => native.createMusic(jsonCtx({ model: "music-2.6", prompt: "x", lyrics_optimizer: true })));
});

// ---------------------------------------------------------------------------
// Downloads

test("downloads ask MiniMax for a fresh link, or use the other gateway's artifact", () => {
  fetched.length = 0;
  fetchReply = { status: 200, headers: {}, body: { task: { status: "succeeded", content: { url: "https://cdn/fresh.mp4" } } } };
  const ctx = { artifactKey: "video", baseUrl: BASE, apiKey: "sk-test", upstreamTaskId: "mm1", upstream: { kind: "vendor" }, data: SOURCE_DONE, clientRequest: { method: "GET" } };
  assert.deepEqual(plugin.buildContentRequest(ctx), { url: "https://cdn/fresh.mp4", method: "GET", credentialless: true });
  assert.equal(fetched[0].url, BASE + "/v2/query/video_generation/mm1");
  assert.equal(fetched[0].headers.Authorization, "Bearer sk-test");
  fetchReply = { status: 500, headers: {}, body: {} };
  assert.equal(plugin.buildContentRequest(ctx).url, "https://cdn/s.mp4");
  fetchReply = null;
  assert.equal(plugin.buildContentRequest(Object.assign({}, ctx, { clientRequest: { method: "HEAD" } })).method, "HEAD");
  const mid = plugin.buildContentRequest(Object.assign({}, ctx, { upstream: { kind: "new_api" }, authHeader: "Bearer sk-mid", upstreamTaskId: "task_mid" }));
  assert.deepEqual(mid, { url: BASE + "/v1/tasks/task_mid/artifacts/video/content", method: "GET", headers: { Authorization: "Bearer sk-mid" } });
  assert.throws(() => plugin.buildContentRequest(Object.assign({}, ctx, { artifactKey: "audio" })), /artifact_not_found/);
});

// ---------------------------------------------------------------------------
// Hooks treat their arguments as read-only

test("hooks never change their arguments", () => {
  const regen = native.createRegeneration(jsonCtx({ model: "MiniMax-H3", source_task_id: "task_src" }));
  const ctx = deepFreeze(driver(regen, { originTasks: [{ taskId: "task_src", upstreamTaskId: "mm-src", data: SOURCE_DONE }] }));
  plugin.buildSubmitRequest(ctx);
  plugin.extractUsage(ctx);
  const cancel = deepFreeze(driver(native.cancelTask({ params: { task_id: "t" }, body: { kind: "json", value: {} } }), { originTasks: [{ taskId: "t", upstreamTaskId: "mm", data: {} }] }));
  plugin.buildSubmitRequest(cancel);
  plugin.parseSubmitResponse(cancel, deepFreeze({ statusCode: 200, headers: {}, body: { action: "deleted", status: "deleted" } }));
  const music = deepFreeze(driver(native.createMusic(jsonCtx({ model: "music-3.0", lyrics: "x" }))));
  plugin.buildSubmitRequest(music);
  const prompt = deepFreeze(driver(native.enhanceImagePrompt(jsonCtx({ model: "MiniMax-H3-Image", prompt: "x" }))));
  plugin.buildSubmitRequest(prompt);
  plugin.extractUsageOnComplete(deepFreeze({ action: "video_regeneration" }), {}, deepFreeze({ task: { task_type: "regeneration", usage: { output_seconds: 5 } } }));
  plugin.convertResponse(deepFreeze({ baseUrl: BASE, path: "/v1/models", config: {}, state: null }), deepFreeze({ status: 200, headers: {}, body: JSON.stringify({ data: [] }) }));
  const speechState = deepFreeze({ kind: "speech", format: "mp3", clientStream: false, chunks: 0, characters: 0 });
  plugin.convertStreamEvent(deepFreeze(Object.assign({ state: speechState }, SPEECH_CTX)), deepFreeze({ data: JSON.stringify({ data: { audio: "49", status: 1 } }) }));
  assert.equal(speechState.chunks, 0);
});
