const cloud = require("wx-server-sdk");
const https = require("https");
const http = require("http");
const { URL } = require("url");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const BASE = "https://techsz.aoscdn.com";
const MAX_POLL = 50;
const POLL_MS = 1000;

function loadApiKey() {
  if (process.env.PICWISH_API_KEY) return String(process.env.PICWISH_API_KEY).trim();
  try {
    const secret = require("./secret.js");
    return (secret && secret.PICWISH_API_KEY) || "";
  } catch (e) {
    return "";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestRaw(method, urlStr, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === "http:" ? http : https;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + u.search,
        method,
        headers,
        timeout: 55000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers || {},
            buffer: buf,
            text: buf.toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("请求超时"));
    });
    if (body) req.write(body);
    req.end();
  });
}

function guessExt(fileID) {
  const m = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(fileID || "");
  const ext = (m && m[1] && m[1].toLowerCase()) || "jpg";
  if (ext === "jpeg") return "jpg";
  if (["png", "jpg", "webp", "bmp", "tif", "tiff"].indexOf(ext) >= 0) return ext;
  return "jpg";
}

function mimeOf(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  return "image/jpeg";
}

function buildMultipartFile(fields, fileField, filename, mime, fileBuffer) {
  const boundary = "----DresiaCutout" + Date.now();
  const chunks = [];

  Object.keys(fields).forEach((key) => {
    const val = fields[key] == null ? "" : String(fields[key]);
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`,
        "utf8"
      )
    );
  });

  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
      "utf8"
    )
  );
  chunks.push(fileBuffer);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"));

  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function createTask(apiKey, fileBuffer, filename, mime) {
  const form = buildMultipartFile(
    {
      sync: "0",
      type: "object",
      format: "png",
      return_type: "1",
      output_type: "2",
      crop: "1",
    },
    "image_file",
    filename,
    mime,
    fileBuffer
  );

  const res = await requestRaw("POST", `${BASE}/api/tasks/visual/segmentation`, {
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": form.contentType,
      "Content-Length": form.body.length,
    },
    body: form.body,
  });

  let json;
  try {
    json = JSON.parse(res.text || "{}");
  } catch (e) {
    throw new Error("抠图接口返回异常");
  }

  if (res.statusCode !== 200 || json.status !== 200) {
    throw new Error((json && json.message) || `创建抠图任务失败(${res.statusCode})`);
  }

  const taskId = json.data && json.data.task_id;
  if (!taskId) throw new Error("未返回 task_id");
  return taskId;
}

async function getTask(apiKey, taskId) {
  const res = await requestRaw(
    "GET",
    `${BASE}/api/tasks/visual/segmentation/${encodeURIComponent(taskId)}`,
    {
      headers: { "X-API-KEY": apiKey },
    }
  );

  let json;
  try {
    json = JSON.parse(res.text || "{}");
  } catch (e) {
    throw new Error("查询抠图结果异常");
  }

  if (res.statusCode !== 200 || json.status !== 200) {
    throw new Error((json && json.message) || `查询失败(${res.statusCode})`);
  }

  return json.data || {};
}

async function pollTask(apiKey, taskId) {
  for (let i = 0; i < MAX_POLL; i++) {
    await sleep(POLL_MS);
    const data = await getTask(apiKey, taskId);
    const state = Number(data.state);
    if (state === 1) {
      if (!data.image) throw new Error("抠图成功但无结果图");
      return data;
    }
    if (state < 0) {
      throw new Error(`抠图失败(state=${state})`);
    }
  }
  throw new Error("抠图超时，请稍后重试");
}

async function downloadBuffer(urlStr) {
  const res = await requestRaw("GET", urlStr);
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    return downloadBuffer(res.headers.location);
  }
  if (res.statusCode !== 200 || !res.buffer || !res.buffer.length) {
    throw new Error("下载抠图结果失败");
  }
  return res.buffer;
}

function randomId() {
  return Math.random().toString(36).slice(2, 8);
}

exports.main = async (event) => {
  const fileID = (event && event.fileID) || "";
  if (!fileID) {
    return { ok: false, message: "缺少 fileID" };
  }

  const apiKey = loadApiKey();
  if (!apiKey || apiKey === "YOUR_API_KEY") {
    return { ok: false, message: "未配置佐糖 API Key" };
  }

  try {
    const dl = await cloud.downloadFile({ fileID });
    const fileContent = dl.fileContent;
    if (!fileContent || !fileContent.length) {
      return { ok: false, message: "下载原图失败" };
    }

    const ext = guessExt(fileID);
    const taskId = await createTask(
      apiKey,
      fileContent,
      `cloth.${ext}`,
      mimeOf(ext)
    );
    const done = await pollTask(apiKey, taskId);
    const png = await downloadBuffer(done.image);

    const cloudPath = `clothes/cutout-${Date.now()}-${randomId()}.png`;
    const upload = await cloud.uploadFile({
      cloudPath,
      fileContent: png,
    });

    if (!upload.fileID) {
      return { ok: false, message: "抠图结果上传失败" };
    }

    return {
      ok: true,
      cutoutFileId: upload.fileID,
      originalFileId: fileID,
    };
  } catch (err) {
    return {
      ok: false,
      message: (err && err.message) || "抠图失败",
      originalFileId: fileID,
    };
  }
};
