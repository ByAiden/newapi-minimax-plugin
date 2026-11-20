// Records hook outputs into test/golden.json for `new-api plugin test --fixture`.
// Usage: node scripts/gen_golden.mjs [repo]  (default: the current directory)
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2] || ".");
globalThis.utils = {
  fetch: () => {
    throw new Error("utils.fetch is not available");
  },
};
const p = await import(pathToFileURL(repo + "/plugin.js").href);
const BASE = "https://api.minimaxi.com";
const cases = [];
const headers = { "Content-Type": "application/json", Accept: "" };
const drv = (intent, extra) =>
  Object.assign(
    {
      requestBody: intent.requestBody,
      requestHeaders: headers,
      action: intent.action,
      model: intent.model,
      upstreamModel: intent.model,
      baseUrl: BASE,
      apiKey: "test-key",
      authHeader: "test-key",
      upstream: { kind: "vendor" },
      config: {},
      files: [],
      publicTaskId: "task_public",
    },
    extra || {},
  );
const qctx = (extra) => Object.assign({ taskId: "mm1", publicTaskId: "task_public", action: "text_to_video", model: "MiniMax-H3", upstreamModel: "MiniMax-H3", baseUrl: BASE, apiKey: "test-key", authHeader: "test-key", upstream: { kind: "vendor" }, config: {} }, extra || {});
const json = (value, extra) => Object.assign({ method: "POST", path: "/", params: {}, query: {}, requestHeaders: headers, body: { kind: "json", value: value } }, extra || {});

function add(name, hook, args) {
  const result = p[hook](...JSON.parse(JSON.stringify(args)));
  cases.push({ name, hook, args, expected: JSON.parse(JSON.stringify(result === undefined ? null : result)) });
}
function addError(name, hook, args) {
  try {
    p[hook](...JSON.parse(JSON.stringify(args)));
  } catch (e) {
    cases.push({ name, hook, args, expectedError: e.message.slice(0, 60) });
    return;
  }
  throw new Error("expected an error: " + name);
}

// H3 video (the protocols' decoded bodies)
const fox = { requestBody: { prompt: "A fox in snow", seconds: 6, duration: 6, model: "MiniMax-H3" }, action: "text_to_video", model: "MiniMax-H3" };
add("video request sends the mapped model", "buildSubmitRequest", [drv(fox, { model: "video", upstreamModel: "MiniMax-H3" })]);
add("video reserves seconds and resolution", "extractUsage", [drv(fox)]);
add("video submit keeps the task id", "parseSubmitResponse", [drv(fox), { statusCode: 200, headers: {}, body: { task_id: "mm1" } }]);
add("query on the vendor path", "buildQueryRequest", [qctx()]);
add("video running", "parseTaskResult", [qctx(), { task: { status: "running" } }, { status: 200, headers: {} }]);
add("video failed", "parseTaskResult", [qctx(), { task: { status: "failed", error: { message: "bad" } } }, { status: 200, headers: {} }]);
add("unknown state is UNKNOWN", "parseTaskResult", [qctx(), { task: { status: "teleporting" } }, { status: 200, headers: {} }]);
const videoDone = { task: { id: "mm1", status: "succeeded", resolution: "768P", task_type: "generation", content: { url: "https://cdn.example/v.mp4" }, usage: { output_seconds: 6, input_image_count: 0, input_seconds: 0 } } };
add("video settles on MiniMax's usage", "extractUsageOnComplete", [qctx(), { status: "SUCCESS" }, videoDone]);
add("video artifact", "listArtifacts", [{ status: "SUCCESS", data: videoDone }]);
add("video artifact from another gateway's reply without a link", "listArtifacts", [{ status: "SUCCESS", data: { task: { id: "task_mid", status: "succeeded", modality: "video", task_type: "generation", resolution: "768P" } } }]);
add("another gateway's reply settles on its usage", "extractUsageOnComplete", [qctx({ upstream: { kind: "new_api" } }), { status: "SUCCESS" }, { task: { id: "task_mid", status: "succeeded", resolution: "768P", modality: "video", usage: { output_seconds: 6, input_image_count: 0, input_seconds: 0 } } }]);
add("download falls back to the stored link", "buildContentRequest", [{ artifactKey: "video", baseUrl: BASE, apiKey: "test-key", upstream: { kind: "vendor" }, data: videoDone, clientRequest: { method: "GET" } }]);
add("download through another gateway", "buildContentRequest", [{ artifactKey: "video", baseUrl: "https://mid.example", apiKey: "sk-mid", authHeader: "Bearer sk-mid", upstreamTaskId: "task_mid", upstream: { kind: "new_api" }, data: {}, clientRequest: { method: "GET" } }]);

// H3-Image
const image = { requestBody: { model: "MiniMax-H3-Image", imageOperation: "generate", imageBody: { prompt: "A cat", n: 1 } }, action: "text_to_image", model: "MiniMax-H3-Image" };
add("image request", "buildSubmitRequest", [drv(image)]);
add("image reservation", "extractUsage", [drv(image)]);

// H3-Context-IR
const cir = p.native.createContextIR(json({ model: "MiniMax-H3", content: [{ type: "text", text: "A boy playing basketball by the sea" }], duration: 5 }));
add("context-ir request runs on MiniMax-H3", "buildSubmitRequest", [drv(cir)]);
add("context-ir reservation", "extractUsage", [drv(cir)]);
const cirDone = { task: { id: "cir1", status: "succeeded", task_type: "h3_context_ir", content: { prompt: "Structured prompt" }, usage: { prompt_tokens: 5664, completion_tokens: 3426, total_tokens: 9090 } } };
add("context-ir settles on tokens", "extractUsageOnComplete", [qctx({ action: "h3_context_ir", model: "MiniMax-H3-Context-IR", upstreamModel: "MiniMax-H3-Context-IR" }), { status: "SUCCESS" }, cirDone]);
add("context-ir has no download", "listArtifacts", [{ status: "SUCCESS", action: "h3_context_ir", data: cirDone }]);

// Regeneration
const regen = p.native.createRegeneration(json({ model: "MiniMax-H3", source_task_id: "task_src" }));
const origin = { originTasks: [{ taskId: "task_src", upstreamTaskId: "mm-src", action: "text_to_video", status: "SUCCESS", data: videoDone }] };
add("regeneration sends MiniMax's source id", "buildSubmitRequest", [drv(regen, origin)]);
add("regeneration reserves the source's facts", "extractUsage", [drv(regen, origin)]);
addError("regeneration without its source task", "buildSubmitRequest", [drv(regen)]);

// Cancel or delete
const cancel = p.native.cancelTask({ method: "DELETE", path: "/v2/video_generation/task_v", params: { task_id: "task_v" }, query: {}, requestHeaders: headers, body: { kind: "json", value: {} } });
const cancelOrigin = { originTasks: [{ taskId: "task_v", upstreamTaskId: "424010985738629", action: "text_to_video", status: "QUEUED", data: { task_id: "424010985738629" } }] };
add("cancel deletes at MiniMax", "buildSubmitRequest", [drv(cancel, cancelOrigin)]);
add("cancel costs nothing", "extractUsage", [drv(cancel, cancelOrigin)]);
add("cancel completes at once", "parseSubmitResponse", [drv(cancel, cancelOrigin), { statusCode: 200, headers: {}, body: { task_id: "424010985738629", action: "cancelled", status: "cancelled" } }]);

// H3-Image-Context-IR
const prompt = p.native.enhanceImagePrompt(json({ model: "MiniMax-H3-Image", prompt: "A ginger cat on a windowsill" }));
add("image prompt request", "buildSubmitRequest", [drv(prompt)]);
add("image prompt completes at once", "parseSubmitResponse", [drv(prompt), { statusCode: 200, headers: {}, body: { revised_prompt: "A ginger tabby cat", usage: { input_tokens: 3489, total_tokens: 3489 } } }]);
add("image prompt settles on input tokens", "extractUsageOnComplete", [qctx({ action: "image_prompt", model: "MiniMax-H3-Image" }), { status: "SUCCESS" }, { revised_prompt: "A ginger tabby cat", usage: { input_tokens: 3489 } }]);

// Music
const music = p.native.createMusic(json({ model: "music-3.0", prompt: "Indie folk", lyrics: "[verse]\nStreetlights flicker", output_format: "url" }));
add("music request", "buildSubmitRequest", [drv(music)]);
add("music reserves one track", "extractUsage", [drv(music)]);
addError("music business error fails the request", "parseSubmitResponse", [drv(music), { statusCode: 200, headers: {}, body: { base_resp: { status_code: 2013, status_msg: "invalid params" } } }]);

// Provider part
const speech = { baseUrl: BASE, path: "/v1/audio/speech", config: { defaultVoice: "English_Graceful_Lady" } };
add("speech request", "convertRequest", [speech, { model: "speech-2.8-turbo", stream: false, body: { model: "speech-2.8-turbo", input: "Hello", voice: "alloy" } }]);
const st = { kind: "speech", format: "mp3", clientStream: false, chunks: 0, characters: 0 };
add("speech hex chunk becomes bytes", "convertStreamEvent", [Object.assign({ state: st }, speech), { data: JSON.stringify({ data: { audio: "494433", status: 1 }, base_resp: { status_code: 0 } }) }]);
add("speech without audio fails", "convertStreamEvent", [Object.assign({ state: st }, speech), { done: true }]);
add("speech business error", "convertStreamEvent", [Object.assign({ state: st }, speech), { data: JSON.stringify({ base_resp: { status_code: 1004, status_msg: "login fail" } }) }]);
const stt = { baseUrl: BASE, path: "/v1/audio/transcriptions", config: {} };
add("transcription request", "convertRequest", [stt, { model: "asr-1.0", stream: false, form: { fields: { model: ["asr-1.0"], language: ["en"] }, files: [{ field: "file", filename: "a.mp3", contentType: "audio/mpeg", size: 9 }] } }]);
add("transcription bills seconds", "convertResponse", [Object.assign({ state: { kind: "transcription", responseFormat: "json", language: "en" } }, stt), { status: 200, headers: {}, body: JSON.stringify({ text: "Hello.", duration: 2.04 }) }]);
const models = { baseUrl: BASE, path: "/v1/models", config: {}, state: null };
add("model list adds the media models", "convertResponse", [models, { status: 200, headers: {}, body: JSON.stringify({ object: "list", data: [{ id: "MiniMax-M3.1-Flash", object: "model" }] }) }]);

// OpenAI-compatible relay upstream type
const RELAY = "https://relay.example";
const relayCfg = { upstreamType: "openai", defaultVoice: "English_Graceful_Lady" };
const rdrv = (intent, extra) => drv(intent, Object.assign({ baseUrl: RELAY, config: relayCfg }, extra || {}));
add("relay image goes to the relay's images endpoint", "buildSubmitRequest", [rdrv(image, { upstreamModel: "relay-image" })]);
add("relay image keeps the estimate of one image", "parseSubmitResponse", [rdrv(image), { statusCode: 200, headers: {}, body: { created: 1, data: [{ url: "https://cdn.relay.example/a.png" }] } }]);
add("relay image settles on OpenAI usage", "extractUsageOnComplete", [Object.assign(qctx({ action: "text_to_image", model: "MiniMax-H3-Image", upstreamModel: "MiniMax-H3-Image", baseUrl: RELAY, config: relayCfg }), { state: { relay: true, perImage: { image_input_text_tokens: 8197, image_input_image_tokens: 0, image_output_tokens: 16384 } } }), { status: "SUCCESS" }, { data: [{ url: "https://x/a.png" }], usage: { input_tokens: 40, output_tokens: 4096 } }]);
addError("relay channel refuses video", "buildSubmitRequest", [rdrv(fox)]);
addError("relay channel refuses video before reserving", "extractUsage", [rdrv(fox)]);
addError("relay channel refuses music", "buildSubmitRequest", [rdrv(music)]);
add("another gateway ignores the upstream type", "buildSubmitRequest", [rdrv(fox, { baseUrl: "https://mid.example", upstream: { kind: "new_api" }, authHeader: "Bearer test-key" })]);
const rspeech = { baseUrl: RELAY, path: "/v1/audio/speech", config: relayCfg };
add("relay speech passes the OpenAI body", "convertRequest", [rspeech, { model: "speech-2.8-turbo", stream: false, body: { model: "speech-2.8-turbo", input: "Hello", voice: "alloy" } }]);
add("relay speech bytes pass through", "convertResponse", [Object.assign({ state: { kind: "speech", relay: true, format: "mp3", clientStream: false } }, rspeech), { status: 200, headers: { "Content-Type": "audio/mpeg" }, bodyBase64: "SUQz" }]);
const rstt = { baseUrl: RELAY, path: "/v1/audio/transcriptions", config: relayCfg };
add("relay transcription bills its seconds", "convertResponse", [Object.assign({ state: { kind: "transcription", relay: true } }, rstt), { status: 200, headers: {}, body: JSON.stringify({ text: "Hi.", usage: { type: "duration", seconds: 7 } }) }]);
add("relay model list as it is", "convertResponse", [{ baseUrl: RELAY, path: "/v1/models", config: relayCfg, state: null }, { status: 200, headers: {}, body: JSON.stringify({ object: "list", data: [{ id: "gpt-x", object: "model", owned_by: "relay" }] }) }]);
add("relay messages path", "prepareRequest", [{ baseUrl: RELAY, path: "/v1/messages", config: relayCfg }, { path: "/v1/messages", upstreamPath: "/anthropic/v1/messages", model: "MiniMax-M3", stream: false, body: {}, headers: {} }]);
add("relay channel needs the relay's address", "checkKey", [{ baseUrl: "https://api.minimaxi.com", config: relayCfg }, "k"]);

// billable_input_images
const max9 = p.native.createH3Task(json({ model: "MiniMax-H3-Max", content: [{ type: "text", text: "x" }].concat(Array.from({ length: 9 }, (_, i) => ({ type: "image_url", image_url: { url: "https://img.example/" + i + ".png" }, role: "reference_image" }))), duration: 5, resolution: "768P" }));
add("H3-Max charges images beyond the first 2", "extractUsage", [drv(max9)]);
add("settlement recomputes the billable images", "extractUsageOnComplete", [qctx(), { status: "SUCCESS" }, { task: { status: "succeeded", resolution: "768P", usage: { output_seconds: 6, input_image_count: 8, input_seconds: 0 } } }]);

writeFileSync(repo + "/test/golden.json", JSON.stringify({ cases }, null, 2) + "\n");
console.log(cases.length, "cases");
