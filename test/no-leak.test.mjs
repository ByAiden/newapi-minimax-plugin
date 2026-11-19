// Native presenters answer with the gateway's task id and artifact address:
// MiniMax's task ids, file ids, trace ids and CDN links stay at the gateway,
// on a direct (vendor) channel and through another New API gateway.
import { test } from "node:test";
import assert from "node:assert/strict";

globalThis.utils = {
  fetch: () => {
    throw new Error("utils.fetch is not available");
  },
};

const plugin = await import("../plugin.js");
const { native } = plugin;

const CDN = "vendor-cdn.example";
const VENDOR_ID = "vendor-task-424010985738629";
const GATEWAY_URL = "https://gw.example/v1/tasks/task_pub/artifacts/video/content?access=sig";
const OUTER_URL = "https://outer.example/v1/tasks/task_out/artifacts/video/content?access=sig2";

function leaks(value, ...needles) {
  const text = JSON.stringify(value);
  return needles.filter((needle) => text.includes(needle));
}

const VENDOR_DONE = {
  task: {
    id: VENDOR_ID,
    model: "MiniMax-H3",
    status: "succeeded",
    created_at: 1785125529,
    updated_at: 1785125946,
    content: { url: "https://" + CDN + "/out/" + VENDOR_ID + ".mp4", cover_url: "https://" + CDN + "/c.jpg", file_id: "file-" + VENDOR_ID },
    file_id: "file-" + VENDOR_ID,
    resolution: "768P",
    duration: 6,
    usage: { total_seconds: 6, input_seconds: 0, output_seconds: 6, input_image_count: 1, total_tokens: 273890, prompt_tokens: 13500, completion_tokens: 260390 },
    ratio: "16:9",
    task_type: "generation",
    modality: "video",
    trace: { request_id: "trace-" + VENDOR_ID, links: ["https://" + CDN + "/x"] },
  },
  base_resp: { status_code: 0, status_msg: "success" },
  request_id: "trace-" + VENDOR_ID,
};

test("the query presenter swaps MiniMax's id and CDN link for the gateway's", () => {
  const view = { task_id: "task_pub", status: "SUCCESS", data: VENDOR_DONE };
  const reply = native.h3TaskStatus({ artifacts: { video: { key: "video", type: "video", url: GATEWAY_URL } } }, view);
  assert.deepEqual(leaks(reply, CDN, VENDOR_ID), []);
  assert.equal(reply.task.id, "task_pub");
  assert.equal(reply.task.content.url, GATEWAY_URL);
  // Everything else a client reads keeps MiniMax's shape.
  for (const key of ["model", "status", "created_at", "updated_at", "resolution", "duration", "ratio", "task_type", "modality"]) assert.equal(reply.task[key], VENDOR_DONE.task[key], key);
  assert.deepEqual(reply.task.usage, VENDOR_DONE.task.usage);
  assert.deepEqual(Object.keys(reply), ["task"]);
});

test("without a gateway artifact the link is left out, never MiniMax's", () => {
  const view = { task_id: "task_pub", status: "SUCCESS", data: VENDOR_DONE };
  for (const ctx of [{}, { artifacts: {} }, null]) {
    const reply = native.h3TaskStatus(ctx, view);
    assert.deepEqual(leaks(reply, CDN, VENDOR_ID), []);
    assert.equal(reply.task.content.url, undefined);
    assert.equal(reply.task.status, "succeeded");
  }
  // A dynamic route hands over a list of tasks and no artifacts.
  const listed = native.h3TaskStatus({ artifacts: {} }, [view]);
  assert.deepEqual(leaks(listed, CDN, VENDOR_ID), []);
  assert.equal(listed.task.id, "task_pub");
});

test("running, failed and error states carry no MiniMax ids", () => {
  const running = native.h3TaskStatus({}, { task_id: "task_pub", status: "IN_PROGRESS", data: { task: { id: VENDOR_ID, status: "running", model: "MiniMax-H3" } } });
  assert.deepEqual(running, { task: { id: "task_pub", status: "running", model: "MiniMax-H3" } });
  const created = native.h3TaskStatus({}, { task_id: "task_pub", status: "QUEUED", data: { task_id: VENDOR_ID } });
  assert.deepEqual(created, { task: { id: "task_pub", status: "queued" } });
  const failed = native.h3TaskStatus({}, { task_id: "task_pub", status: "FAILURE", fail_reason: "bad input", data: { task: { id: VENDOR_ID, status: "failed", error: { message: "bad input", code: "1026" } } } });
  assert.deepEqual(leaks(failed, VENDOR_ID), []);
  assert.deepEqual(failed.task.error, { message: "bad input", code: "1026" });
  const apiError = native.h3TaskStatus({}, { task_id: "task_pub", status: "FAILURE", data: { error: { type: "rate_limit_error", message: "busy", http_code: "429" }, request_id: "trace-" + VENDOR_ID } });
  assert.deepEqual(apiError, { error: { type: "rate_limit_error", message: "busy", http_code: "429" } });
});

test("Context-IR keeps its prompt; the create reply holds only the gateway's id", () => {
  const done = { task: { id: VENDOR_ID, status: "succeeded", task_type: "h3_context_ir", modality: "text", content: { prompt: "Structured prompt" }, usage: { prompt_tokens: 5664, completion_tokens: 3426 } } };
  const reply = native.h3TaskStatus({ artifacts: {} }, { task_id: "task_pub", status: "SUCCESS", data: done });
  assert.deepEqual(reply.task.content, { prompt: "Structured prompt" });
  assert.deepEqual(leaks(reply, VENDOR_ID), []);
  assert.deepEqual(native.taskCreated({}, { task_id: "task_pub", data: { task_id: VENDOR_ID, base_resp: { status_code: 0, status_msg: "success" }, request_id: "trace-x" } }), {
    task_id: "task_pub",
    base_resp: { status_code: 0, status_msg: "success" },
  });
  assert.deepEqual(native.taskCreated({}, { task_id: "task_pub", data: { task_id: VENDOR_ID } }), { task_id: "task_pub" });
});

test("another gateway's presenter output still lists, settles and downloads the video", () => {
  // The middle gateway's reply as the outer gateway stores it.
  const middle = native.h3TaskStatus({ artifacts: { video: { url: GATEWAY_URL } } }, { task_id: "task_mid", status: "SUCCESS", data: VENDOR_DONE });
  const outer = { model: "MiniMax-H3", upstreamModel: "MiniMax-H3", upstream: { kind: "new_api" } };
  assert.deepEqual(plugin.parseTaskResult(outer, middle), { code: 0, status: "SUCCESS", progress: "100%", url: GATEWAY_URL });
  assert.deepEqual(plugin.extractUsageOnComplete(outer, {}, middle), { resolution: "768P", seconds: 6, input_images: 1, input_video_seconds: 0 });
  assert.deepEqual(plugin.listArtifacts({ status: "SUCCESS", data: middle }), [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  // A middle gateway without a public address answers without a link.
  const bare = native.h3TaskStatus({ artifacts: {} }, { task_id: "task_mid", status: "SUCCESS", data: VENDOR_DONE });
  assert.equal(plugin.parseTaskResult(outer, bare).status, "SUCCESS");
  assert.deepEqual(plugin.listArtifacts({ status: "SUCCESS", data: bare }), [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  const download = plugin.buildContentRequest({ artifactKey: "video", baseUrl: "https://mid.example", upstreamTaskId: "task_mid", upstream: { kind: "new_api" }, authHeader: "Bearer sk-mid", data: bare, clientRequest: { method: "GET" } });
  assert.equal(download.url, "https://mid.example/v1/tasks/task_mid/artifacts/video/content");
  // The outer gateway's own reply names neither MiniMax nor the middle gateway.
  const outerReply = native.h3TaskStatus({ artifacts: { video: { url: OUTER_URL } } }, { task_id: "task_out", status: "SUCCESS", data: middle });
  assert.deepEqual(leaks(outerReply, CDN, VENDOR_ID, "gw.example", "task_mid"), []);
  assert.equal(outerReply.task.content.url, OUTER_URL);
  assert.equal(outerReply.task.id, "task_out");
  // Context-IR tasks have no video, through either gateway.
  const cir = native.h3TaskStatus({ artifacts: {} }, { task_id: "task_mid", status: "SUCCESS", data: { task: { id: VENDOR_ID, status: "succeeded", task_type: "h3_context_ir", modality: "text", content: { prompt: "p" } } } });
  assert.deepEqual(plugin.listArtifacts({ status: "SUCCESS", data: cir }), []);
});

test("synchronous replies drop MiniMax's trace ids", () => {
  const image = { created: 1, data: [{ url: "https://" + CDN + "/0.jpg", size: "1024x1024" }], output_format: "jpeg", usage: { generated_images: 1 }, request_id: "trace-" + VENDOR_ID };
  assert.equal(native.imageCreated({}, { task_id: "t", data: image }).request_id, undefined);
  assert.deepEqual(native.imageCreated({}, { task_id: "t", data: image }).usage, image.usage);
  const music = { data: { audio: "494433", status: 2 }, trace_id: "trace-" + VENDOR_ID, extra_info: { music_duration: 1 }, base_resp: { status_code: 0 } };
  assert.deepEqual(leaks(native.musicCreated({}, { task_id: "t", data: music }), VENDOR_ID), []);
  const prompt = { created: 1, revised_prompt: "p", usage: { input_tokens: 3 }, request_id: "trace-" + VENDOR_ID };
  assert.deepEqual(leaks(native.imagePromptEnhanced({}, { task_id: "t", data: prompt }), VENDOR_ID), []);
  assert.deepEqual(native.taskCancelled({}, { task_id: "t", data: { task_id: "task_pub", action: "cancelled", status: "cancelled" } }), { task_id: "task_pub", action: "cancelled", status: "cancelled" });
});

test("presenters leave the stored task untouched", () => {
  const data = JSON.parse(JSON.stringify(VENDOR_DONE));
  native.h3TaskStatus({ artifacts: { video: { url: GATEWAY_URL } } }, { task_id: "task_pub", status: "SUCCESS", data: data });
  assert.deepEqual(data, VENDOR_DONE);
});
